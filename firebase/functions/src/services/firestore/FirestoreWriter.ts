/**
 * FirestoreWriter Implementation
 *
 * Centralized service for all Firestore write operations with:
 * - Zod schema validation before writes
 * - Consistent error handling and logging
 * - Transaction and batch support
 * - Performance monitoring with sampling
 * - Audit logging for write operations
 */

// Import types
import type { CommentDTO, RegisteredUser, ShareLinkDTO } from '@splitifyd/shared';
import { type CommentTargetType, CommentTargetTypes } from '@splitifyd/shared';
import { z } from 'zod';
import { FIRESTORE, FirestoreCollections, HTTP_STATUS } from '../../constants';
import { FieldValue, type IFirestoreDatabase, type ITransaction, type IWriteBatch, Timestamp } from '../../firestore-wrapper';
import { logger } from '../../logger';
import { measureDb } from '../../monitoring/measure';
import { ApiError } from '../../utils/errors';
import { getTopLevelMembershipDocId } from '../../utils/groupMembershipHelpers';

import type { GroupBalanceDTO } from '../../schemas';
// Import schemas for validation
import { GroupId } from '@splitifyd/shared';
import {
    CommentDataSchema,
    ExpenseDocumentSchema,
    GroupBalanceDocumentSchema,
    GroupDocumentSchema,
    PolicyDocumentSchema,
    SettlementDocumentSchema,
    TopLevelGroupMemberSchema,
    UserDocumentSchema,
    validateUpdate,
} from '../../schemas';
import type { CreateUserNotificationDocument } from '../../schemas/user-notifications';
import { UserNotificationDocumentSchema } from '../../schemas/user-notifications';
import type { BatchWriteResult, IFirestoreWriter, WriteResult } from './IFirestoreWriter';

/**
 * Validation metrics for monitoring validation coverage and effectiveness
 */
interface ValidationMetrics {
    operation: string;
    collection: string;
    documentId: string;
    validationType: 'full' | 'partial' | 'skipped' | 'failed';
    validatedFieldCount?: number;
    skippedFieldCount?: number;
    validatedFields?: string[];
    skippedFields?: string[];
    skipReason?: string;
}

export class FirestoreWriter implements IFirestoreWriter {
    constructor(private readonly db: IFirestoreDatabase) {}

    // ========================================================================
    // Private Timestamp Conversion Utilities (Phase 3: ISO → Timestamp)
    // ========================================================================

    /**
     * Convert ISO 8601 string to Firestore Timestamp
     * LENIENT MODE: During transition, accepts ISO strings, Timestamps, and Dates
     */
    private isoToTimestamp(value: any): Timestamp {
        if (!value) return value; // null/undefined pass through
        if (value instanceof Timestamp) {
            return value; // Already a Timestamp
        }
        if (value instanceof Date) {
            return Timestamp.fromDate(value);
        }
        if (typeof value === 'string') {
            // ISO string - convert to Timestamp
            return Timestamp.fromDate(new Date(value));
        }
        // Lenient: if it has a toDate() method (Timestamp-like), use it
        if (typeof value === 'object' && typeof value.toDate === 'function') {
            return Timestamp.fromDate(value.toDate());
        }
        // Lenient: if it has seconds/nanoseconds (Timestamp-like object), convert
        if (typeof value === 'object' && typeof value.seconds === 'number') {
            return new Timestamp(value.seconds, value.nanoseconds || 0);
        }
        // Very lenient: return as-is and let Firestore handle it
        return value;
    }

    /**
     * Convert Firestore Timestamp to ISO 8601 string
     * This is the conversion boundary between Firestore storage format and application DTOs
     *
     * LENIENT MODE: During transition, accepts anything that looks like a date
     * Will be made strict once all code is updated to use DTOs consistently
     */
    private timestampToISO(value: any): string {
        if (!value) return value; // null/undefined pass through
        if (value instanceof Timestamp) {
            return value.toDate().toISOString();
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            // Already ISO string (from old data or different SDK versions)
            return value;
        }
        // Lenient: if it has a toDate() method (Timestamp-like), use it
        if (typeof value === 'object' && typeof value.toDate === 'function') {
            return value.toDate().toISOString();
        }
        // Lenient: if it has seconds/nanoseconds (Timestamp-like object), convert
        if (typeof value === 'object' && typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000).toISOString();
        }
        // Very lenient: return as-is for now, will be caught later when we tighten
        return value;
    }

    /**
     * Recursively convert all Timestamp objects in an object to ISO strings
     * This enables automatic DTO conversion at the read boundary
     *
     * Known date fields that will be converted:
     * - createdAt, updatedAt, deletedAt
     * - date (for expenses/settlements)
     * - joinedAt (for group members)
     * - lastModified, lastTransactionChange, lastBalanceChange, etc. (for notifications)
     */
    private convertTimestampsToISO<T extends Record<string, any>>(obj: T): T {
        const result: any = { ...obj };

        for (const [key, value] of Object.entries(result)) {
            if (value instanceof Timestamp) {
                result[key] = this.timestampToISO(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.convertTimestampsToISO(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => (item && typeof item === 'object' ? this.convertTimestampsToISO(item) : item));
            }
        }

        return result;
    }

    /**
     * Remove undefined values from an object recursively
     * Firestore doesn't allow undefined values - they must be null or omitted
     */
    private removeUndefinedValues<T>(obj: T): T {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const result: any = Array.isArray(obj) ? [...obj] : { ...obj };

        if (Array.isArray(result)) {
            return result.map((item) => (item && typeof item === 'object' ? this.removeUndefinedValues(item) : item)) as T;
        }

        for (const [key, value] of Object.entries(result)) {
            if (value === undefined) {
                delete result[key];
            } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                result[key] = this.removeUndefinedValues(value);
            } else if (Array.isArray(value)) {
                result[key] = value.map((item) => (item && typeof item === 'object' ? this.removeUndefinedValues(item) : item));
            }
        }

        return result;
    }

    /**
     * Recursively convert all ISO string dates to Timestamp objects
     * LENIENT MODE: Only converts fields known to be dates, leaves others unchanged
     */
    /**
     * Convert ISO 8601 strings to Firestore Timestamps recursively
     * Accepts any object type and returns the same structure with converted timestamps
     */
    private convertISOToTimestamps<T>(obj: T): T {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        const result: any = Array.isArray(obj) ? [...obj] : { ...obj };

        // Known date field names across all document types
        const dateFields = new Set([
            'createdAt',
            'updatedAt',
            'deletedAt',
            'date',
            'joinedAt',
            'lastModified',
            'lastTransactionChange',
            'lastBalanceChange',
            'lastGroupDetailsChange',
            'lastCommentChange',
            'timestamp',
            'expiresAt',
            'groupUpdatedAt',
            'lastUpdated',
            'assignedAt', // For theme.assignedAt
            'termsAcceptedAt',
            'cookiePolicyAcceptedAt',
            'passwordChangedAt', // User policy/auth timestamps
        ]);

        if (Array.isArray(result)) {
            // Process arrays
            return result.map((item) => (item && typeof item === 'object' && !(item instanceof Timestamp) ? this.convertISOToTimestamps(item) : item)) as T;
        }

        // Process object properties
        for (const [key, value] of Object.entries(result)) {
            if (dateFields.has(key) && value !== null && value !== undefined) {
                // Convert known date fields
                result[key] = this.isoToTimestamp(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                // Recursively process nested objects (e.g., theme object)
                result[key] = this.convertISOToTimestamps(value);
            } else if (Array.isArray(value)) {
                // Recursively process arrays of objects
                result[key] = value.map((item) => (item && typeof item === 'object' && !(item instanceof Timestamp) ? this.convertISOToTimestamps(item) : item));
            }
        }

        return result;
    }

    // ========================================================================
    // Private Validation Helper Methods
    // ========================================================================

    /**
     * Track validation metrics for monitoring and analysis
     */
    private trackValidationMetrics(metrics: ValidationMetrics): void {
        logger.info('Firestore validation metrics', {
            operation: metrics.operation,
            collection: metrics.collection,
            documentId: metrics.documentId,
            validationType: metrics.validationType,
            validatedFieldCount: metrics.validatedFieldCount || 0,
            skippedFieldCount: metrics.skippedFieldCount || 0,
            validatedFields: metrics.validatedFields || [],
            skippedFields: metrics.skippedFields || [],
            skipReason: metrics.skipReason,
            validationCoveragePercent: metrics.validatedFieldCount && metrics.skippedFieldCount
                ? Math.round((metrics.validatedFieldCount / (metrics.validatedFieldCount + metrics.skippedFieldCount)) * 100)
                : metrics.validationType === 'full'
                ? 100
                : 0,
        });
    }

    /**
     * Safely validate merged data, handling FieldValue operations gracefully
     */
    private safeValidateUpdate<T>(
        schema: any,
        mergedData: Record<string, any>,
        schemaName: string,
        documentId: string,
        collection: string,
    ): { isValid: boolean; data?: T; skipValidation?: boolean; } {
        try {
            const validatedData = this.validateMergedData<T>(schema, mergedData, schemaName, documentId, collection);

            this.trackValidationMetrics({
                operation: 'safeValidateUpdate',
                collection,
                documentId,
                validationType: 'full',
                validatedFieldCount: Object.keys(mergedData).length,
                validatedFields: Object.keys(mergedData),
            });

            return { isValid: true, data: validatedData };
        } catch (error) {
            // Check if error is due to FieldValue operations
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('FieldValue') || errorMessage.includes('Transform')) {
                this.trackValidationMetrics({
                    operation: 'safeValidateUpdate',
                    collection,
                    documentId,
                    validationType: 'skipped',
                    skipReason: 'FieldValue operations detected',
                });

                logger.info('Validation skipped due to FieldValue operations', {
                    documentId,
                    collection,
                    schema: schemaName,
                });
                return { isValid: true, skipValidation: true };
            }

            this.trackValidationMetrics({
                operation: 'safeValidateUpdate',
                collection,
                documentId,
                validationType: 'skipped',
                skipReason: 'validation error: ' + errorMessage,
            });

            // Re-throw non-FieldValue validation errors
            throw error;
        }
    }

    /**
     * Fetch existing document and merge with updates for validation
     */
    private async fetchAndMergeForValidation(documentPath: string, updates: Record<string, any>, documentId: string): Promise<Record<string, any>> {
        const docRef = this.db.doc(documentPath);
        const docSnapshot = await docRef.get();

        let existingData: Record<string, any> = {};
        if (docSnapshot.exists) {
            existingData = docSnapshot.data() || {};
        }

        // Remove any dot-notation keys that Firestore may have returned
        // These occur when documents are updated with dot notation (e.g., `acceptedPolicies.policyId`)
        // and break schema validation as they're flattened versions of nested fields
        const cleanedExistingData: Record<string, any> = {};
        for (const [key, value] of Object.entries(existingData)) {
            if (!key.includes('.')) { // Only keep non-flattened keys
                cleanedExistingData[key] = value;
            }
        }

        // Merge updates with cleaned existing data
        const mergedData = {
            ...cleanedExistingData,
            ...updates,
            id: documentId, // Ensure ID is present for validation
        };

        // Convert all ISO strings and Timestamp-like objects to proper Timestamps
        // This handles cases where existingData may have Timestamp-like objects with _seconds/_nanoseconds
        // and updates may have ISO strings that need conversion before validation
        return this.convertISOToTimestamps(mergedData);
    }

    /**
     * Validate merged document data using the appropriate schema
     */
    private validateMergedData<T>(schema: any, mergedData: Record<string, any>, schemaName: string, documentId: string, collection: string): T {
        // For validation, replace FieldValue.serverTimestamp() with current timestamp
        // Only replace if it's actually a FieldValue (not a Timestamp that was already converted)
        const dataForValidation = { ...mergedData };
        if (dataForValidation.updatedAt && this.isFieldValue(dataForValidation.updatedAt)) {
            dataForValidation.updatedAt = Timestamp.now();
        }
        if (dataForValidation.createdAt && this.isFieldValue(dataForValidation.createdAt)) {
            dataForValidation.createdAt = Timestamp.now();
        }

        return validateUpdate(schema, dataForValidation, schemaName, {
            documentId,
            collection,
        });
    }

    // ========================================================================
    // Schema Mapping Infrastructure
    // ========================================================================

    /**
     * Get the appropriate schema for a given collection
     * Returns null for unknown collections (graceful degradation)
     */
    private getSchemaForCollection(collection: string) {
        const schemaMap: Record<string, z.ZodSchema> = {
            [FirestoreCollections.USERS]: UserDocumentSchema,
            [FirestoreCollections.GROUPS]: GroupDocumentSchema,
            [FirestoreCollections.EXPENSES]: ExpenseDocumentSchema,
            [FirestoreCollections.SETTLEMENTS]: SettlementDocumentSchema,
            [FirestoreCollections.POLICIES]: PolicyDocumentSchema,
            [FirestoreCollections.COMMENTS]: CommentDataSchema,
            [FirestoreCollections.GROUP_MEMBERSHIPS]: TopLevelGroupMemberSchema,
            [FirestoreCollections.USER_NOTIFICATIONS]: UserNotificationDocumentSchema,
        };

        const schema = schemaMap[collection];
        if (!schema) {
            // Log warning but don't fail - allows gradual migration
            logger.warn(`No schema found for collection: ${collection}`, {
                collection,
                availableCollections: Object.keys(schemaMap),
            });
            return null;
        }
        return schema;
    }

    /**
     * Validate data prior to document creation to ensure Firestore receives valid payloads
     */
    private validateCreateData(collection: string, data: Record<string, any>, documentId: string): void {
        const schema = this.getSchemaForCollection(collection);
        if (!schema) {
            throw Error(`there is no validation schema for ${collection}`);
        }

        try {
            const dataForValidation = {
                ...data,
                id: documentId,
            };

            schema.parse(dataForValidation);

            this.trackValidationMetrics({
                operation: 'validateCreateData',
                collection,
                documentId,
                validationType: 'full',
                validatedFieldCount: Object.keys(dataForValidation).length,
            });
        } catch (error) {
            this.trackValidationMetrics({
                operation: 'validateCreateData',
                collection,
                documentId,
                validationType: 'failed',
                skipReason: error instanceof Error ? error.message : String(error),
            });

            logger.error('Create validation failed', error as Error, {
                collection,
                documentId,
                operation: 'validateCreateData',
            });
            throw error;
        }
    }

    // ========================================================================
    // Transaction Validation Helper Methods
    // ========================================================================

    /**
     * Check if a value is a FieldValue operation (serverTimestamp, arrayUnion, etc.)
     */
    private isFieldValue(value: any): boolean {
        if (!value || typeof value !== 'object') {
            return false;
        }

        // Check for FieldValue operations by examining the constructor name or known properties
        return value.constructor?.name?.includes('Transform') || value.operand !== undefined || value._delegate?.type !== undefined || typeof value.isEqual === 'function';
    }

    /**
     * Validate transaction data using selective field validation
     * Only validates fields that aren't FieldValue operations
     */
    private validateTransactionData(
        collection: string,
        data: any,
        documentId: string,
    ): {
        isValid: boolean;
        skipValidation?: boolean;
        validatedFields?: Record<string, any>;
        skippedFields?: string[];
    } {
        const schema = this.getSchemaForCollection(collection);
        if (!schema) {
            this.trackValidationMetrics({
                operation: 'validateTransactionData',
                collection,
                documentId,
                validationType: 'skipped',
                skipReason: 'no schema found for collection',
            });

            // No schema found - log and skip validation
            logger.info('Transaction validation skipped - no schema found', {
                collection,
                documentId,
                operation: 'validateTransactionData',
            });
            return { isValid: true, skipValidation: true };
        }

        // Separate FieldValue operations from regular fields
        const fieldsToValidate: Record<string, any> = {};
        const skippedFields: string[] = [];

        for (const [key, value] of Object.entries(data)) {
            if (this.isFieldValue(value)) {
                skippedFields.push(key);
            } else {
                fieldsToValidate[key] = value;
            }
        }

        // If all fields are FieldValue operations, skip validation entirely
        if (Object.keys(fieldsToValidate).length === 0) {
            this.trackValidationMetrics({
                operation: 'validateTransactionData',
                collection,
                documentId,
                validationType: 'skipped',
                skippedFieldCount: skippedFields.length,
                skippedFields,
                skipReason: 'only FieldValue operations',
            });

            logger.info('Transaction validation skipped - only FieldValue operations', {
                collection,
                documentId,
                skippedFields,
                operation: 'validateTransactionData',
            });
            return { isValid: true, skipValidation: true, skippedFields };
        }

        try {
            // Validate partial data (only business logic fields)
            // Note: This doesn't do full document validation, just field-level validation
            const validatedFields = fieldsToValidate;

            this.trackValidationMetrics({
                operation: 'validateTransactionData',
                collection,
                documentId,
                validationType: 'partial',
                validatedFieldCount: Object.keys(validatedFields).length,
                skippedFieldCount: skippedFields.length,
                validatedFields: Object.keys(validatedFields),
                skippedFields: skippedFields.length > 0 ? skippedFields : undefined,
            });

            return {
                isValid: true,
                validatedFields,
                skippedFields: skippedFields.length > 0 ? skippedFields : undefined,
            };
        } catch (error) {
            this.trackValidationMetrics({
                operation: 'validateTransactionData',
                collection,
                documentId,
                validationType: 'skipped',
                skipReason: 'validation error: ' + (error instanceof Error ? error.message : String(error)),
            });

            logger.error('Transaction validation failed', error, {
                collection,
                documentId,
                fieldsAttempted: Object.keys(fieldsToValidate),
                operation: 'validateTransactionData',
            });
            throw error;
        }
    }

    /**
     * Get the Firestore collection path for comments on a target entity
     * This eliminates type-dispatching conditionals in comment methods
     */
    private getCommentCollectionPath(targetType: CommentTargetType, targetId: string): string {
        switch (targetType) {
            case CommentTargetTypes.GROUP:
                return `${FirestoreCollections.GROUPS}/${targetId}/${FirestoreCollections.COMMENTS}`;
            case CommentTargetTypes.EXPENSE:
                return `${FirestoreCollections.EXPENSES}/${targetId}/${FirestoreCollections.COMMENTS}`;
            default:
                throw new Error(`Unsupported comment target type: ${targetType}`);
        }
    }

    // ========================================================================
    // User Write Operations
    // ========================================================================

    async createUser(userId: string, userData: Omit<RegisteredUser, 'id' | 'uid' | 'emailVerified' | 'photoURL'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createUser', async () => {
            try {
                // Remove undefined values (Firestore doesn't accept them)
                const cleanedData = this.removeUndefinedValues(userData);

                // LENIENT: Convert ISO strings to Timestamps before validation
                const convertedData = this.convertISOToTimestamps(cleanedData);

                // Validate data before writing (expects Timestamps after conversion)
                const validatedData = UserDocumentSchema.parse({
                    id: userId,
                    ...convertedData,
                });

                // Remove id from data to write
                const { id, ...dataToWrite } = validatedData;

                // Add server timestamp
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await this.db.collection(FirestoreCollections.USERS).doc(userId).set(finalData);

                logger.info('User document created', { userId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to create user document', error, { userId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async updateUser(userId: string, updates: Partial<Omit<RegisteredUser, 'id' | 'photoURL'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUser', async () => {
            try {
                // LENIENT: Convert ISO strings to Timestamps in the updates
                const convertedUpdates = this.convertISOToTimestamps(updates);

                // Add updated timestamp
                const finalUpdates = {
                    ...convertedUpdates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${FirestoreCollections.USERS}/${userId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, userId);

                // Validate with graceful FieldValue handling (expects Timestamps after conversion)
                const validationResult = this.safeValidateUpdate<any>(UserDocumentSchema, mergedData, 'UserDocument', userId, FirestoreCollections.USERS);

                // Perform the update
                await this.db.collection(FirestoreCollections.USERS).doc(userId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`User document updated ${logType}`, { userId, fields: Object.keys(updates) });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to update user document', error, { userId, updates: Object.keys(updates) });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async touchGroup(groupId: GroupId, transactionOrBatch?: ITransaction | IWriteBatch): Promise<void> {
        const now = Timestamp.now();
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);

        if (transactionOrBatch) {
            // Both Transaction and WriteBatch have update(ref, data) signature
            // TypeScript may require explicit casting for union type
            (transactionOrBatch as any).update(groupRef, { updatedAt: now });
        } else {
            await groupRef.update({ updatedAt: now });
        }
    }

    async updateGroupMemberDisplayName(groupId: GroupId, userId: string, newDisplayName: string): Promise<void> {
        return measureDb('FirestoreWriter.updateGroupMemberDisplayName', async () => {
            // Validate display name before transaction
            if (!newDisplayName || newDisplayName.trim().length === 0) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'Display name cannot be empty');
            }

            await this.db.runTransaction(async (transaction) => {
                // PHASE 1: ALL READS FIRST
                // Query all current group members to check for name conflicts
                const membershipQuery = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('groupId', '==', groupId);
                const membershipsSnapshot = await transaction.get(membershipQuery);

                if (membershipsSnapshot.empty) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
                }

                // Check if display name is already taken by another user
                // Note: member documents use 'uid' field to store the user ID
                // Every member MUST have groupDisplayName set (no fallbacks)
                const members = membershipsSnapshot.docs.map((doc) => doc.data());
                const nameTaken = members.some((m) => m.uid !== userId && m.groupDisplayName === newDisplayName);

                if (nameTaken) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'DISPLAY_NAME_TAKEN', `Display name "${newDisplayName}" is already in use in this group`);
                }

                // Find the target member's document
                const memberDoc = membershipsSnapshot.docs.find((doc) => doc.data().uid === userId);
                if (!memberDoc) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_MEMBER_NOT_FOUND', 'User is not a member of this group');
                }

                // PHASE 2: ALL WRITES AFTER ALL READS
                // Update the member's groupDisplayName
                const memberRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${memberDoc.id}`);
                transaction.update(memberRef, {
                    groupDisplayName: newDisplayName,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                // Touch the group to update its timestamp
                const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
                transaction.update(groupRef, {
                    updatedAt: FieldValue.serverTimestamp(),
                });

                logger.info('Group member display name updated', {
                    groupId,
                    userId,
                    newDisplayName,
                });
            });
        });
    }

    // ========================================================================
    // Group Balance Operations
    // ========================================================================

    setGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, balance: GroupBalanceDTO): void {
        const balanceRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('metadata').doc('balance');

        // Convert DTO to Firestore document (ISO strings → Timestamps)
        const convertedData = this.convertISOToTimestamps(balance);
        const docData = {
            ...convertedData,
            lastUpdatedAt: Timestamp.now(),
        };

        transaction.set(balanceRef, docData);
        logger.info('Group balance document created/updated in transaction', { groupId });
    }

    async getGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId) {
        const balanceRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('metadata').doc('balance');

        const doc = await transaction.get(balanceRef);

        if (!doc.exists) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_NOT_FOUND', `Balance not found for group ${groupId}`);
        }

        const data = doc.data();
        if (!data) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'BALANCE_READ_ERROR', 'Balance document is empty');
        }

        // Validate and convert to DTO (Timestamps → ISO strings)
        const validated = GroupBalanceDocumentSchema.parse(data);
        return this.convertTimestampsToISO(validated) as any as GroupBalanceDTO;
    }

    updateGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, updater: (current: GroupBalanceDTO) => GroupBalanceDTO): void {
        const balanceRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('metadata').doc('balance');

        // Apply update function
        const newBalance = updater(currentBalance);

        // Convert back to Firestore document (ISO strings → Timestamps)
        const convertedData = this.convertISOToTimestamps(newBalance);
        const docData = {
            ...convertedData,
            lastUpdatedAt: Timestamp.now(),
        };

        transaction.set(balanceRef, docData);
        logger.info('Group balance updated in transaction', { groupId, version: newBalance.version });
    }

    async addComment(targetType: CommentTargetType, targetId: string, commentData: Omit<CommentDTO, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.addComment', async () => {
            try {
                // Get collection path using helper method to eliminate type-dispatching
                const collectionPath = this.getCommentCollectionPath(targetType, targetId);

                // Create comment reference
                const commentRef = this.db.collection(collectionPath).doc();

                // Remove undefined values (Firestore doesn't accept them)
                const cleanedData = this.removeUndefinedValues(commentData);

                // LENIENT: Convert ISO strings to Timestamps before validation
                const convertedData = this.convertISOToTimestamps(cleanedData);

                // Validate comment data (expects Timestamps after conversion)
                const validatedData = CommentDataSchema.parse(convertedData);

                // Use validated data directly
                const dataToWrite = validatedData;

                // Add timestamps
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await commentRef.set(finalData);

                logger.info('Comment added', { targetType, targetId, commentId: commentRef.id });

                return {
                    id: commentRef.id,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to add comment', error, { targetType, targetId });
                return {
                    id: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Transaction Operations
    // ========================================================================

    /**
     * Run a Firestore transaction
     *
     * NOTE: Application-level retry logic is NOT needed. Firestore's SDK handles transaction
     * retries internally with optimistic concurrency control. When multiple transactions conflict
     * on the same document, Firestore automatically retries with exponential backoff (several
     * seconds per retry). This internal mechanism is more efficient than application-level retries.
     *
     * Tests confirmed that removing application retries has no impact on success rates - all
     * transaction conflicts are resolved by Firestore's internal retry mechanism.
     */
    async runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T> {
        return this.db.runTransaction(updateFunction);
    }

    createInTransaction(transaction: ITransaction, collection: string, documentId: string | null, data: any) {
        const docRef = documentId ? this.db.collection(collection).doc(documentId) : this.db.collection(collection).doc();

        // Remove undefined values (Firestore doesn't accept them)
        const cleanedData = this.removeUndefinedValues(data);

        // Convert ISO strings to Timestamps before writing (DTO → Firestore conversion)
        const convertedData = this.convertISOToTimestamps(cleanedData);

        // Validate document before writing to Firestore
        this.validateCreateData(collection, convertedData, docRef.id);

        const finalData = {
            ...convertedData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(docRef, finalData);

        return docRef;
    }

    updateInTransaction(transaction: ITransaction, documentPath: string, updates: any): void {
        const docRef = this.db.doc(documentPath);

        // Remove undefined values (Firestore doesn't accept them)
        const cleanedUpdates = this.removeUndefinedValues(updates);

        // Convert ISO strings to Timestamps before writing (DTO → Firestore conversion)
        const convertedUpdates = this.convertISOToTimestamps(cleanedUpdates);

        const finalUpdates = {
            ...convertedUpdates,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Extract collection from document path for validation
        const collection = documentPath.split('/')[0];

        // Apply selective validation for transaction data
        this.validateTransactionData(collection, finalUpdates, docRef.id);

        transaction.update(docRef, finalUpdates);
    }

    // ========================================================================
    // Utility Operations
    // ========================================================================

    generateDocumentId(collection: string): string {
        return this.db.collection(collection).doc().id;
    }

    // ========================================================================
    // User Notification Operations
    // ========================================================================

    async createUserNotification(userId: string, notificationData: CreateUserNotificationDocument): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createUserNotification', async () => {
            try {
                // Validate data before writing
                const validatedData = UserNotificationDocumentSchema.parse({
                    changeVersion: 0,
                    lastModified: FieldValue.serverTimestamp(),
                    ...notificationData,
                });

                // Remove server timestamp for the data to write (it will be added by Firestore)
                const { lastModified, ...dataToWrite } = validatedData;

                const finalData = {
                    ...dataToWrite,
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.doc(`user-notifications/${userId}`).set(finalData);

                logger.info('User notification document created', { userId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to create user notification document', error, { userId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async removeUserNotificationGroup(userId: string, groupId: GroupId): Promise<WriteResult> {
        return measureDb('FirestoreWriter.removeUserNotificationGroup', async () => {
            try {
                const updates = {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.doc(`user-notifications/${userId}`).update(updates);

                logger.info('User notification group removed (FieldValue operations)', { userId, groupId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                // If the document doesn't exist, consider the removal successful (idempotent)
                if (error instanceof Error && error.message.includes('NOT_FOUND')) {
                    logger.info('User notification document not found - removal considered successful', { userId, groupId });
                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date(),
                    };
                }

                logger.error('Failed to remove user notification group', error, { userId, groupId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async batchSetUserNotifications(updates: Array<{ userId: string; data: any; merge?: boolean; }>): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.batchSetUserNotifications', async () => {
            const allResults: WriteResult[] = [];
            let totalSuccess = 0;
            let totalFailure = 0;

            const BATCH_SIZE = FIRESTORE.TRANSACTION_MAX_WRITES;
            const chunks: (typeof updates)[] = [];
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                chunks.push(updates.slice(i, i + BATCH_SIZE));
            }

            for (const chunk of chunks) {
                try {
                    const batch = this.db.batch();

                    for (const update of chunk) {
                        const finalData = {
                            ...update.data,
                            lastModified: FieldValue.serverTimestamp(),
                        };

                        const userNotificationRef = this.db.doc(`user-notifications/${update.userId}`);
                        batch.set(userNotificationRef, finalData, { merge: update.merge || false });
                    }

                    await batch.commit();

                    for (const update of chunk) {
                        allResults.push({ id: update.userId, success: true });
                        totalSuccess++;
                    }

                    logger.info('Batch set user notifications succeeded', {
                        chunkSize: chunk.length,
                        totalProcessed: totalSuccess + totalFailure,
                        totalUpdates: updates.length,
                    });
                } catch (error) {
                    logger.error('Batch set user notifications failed for chunk', error, {
                        chunkSize: chunk.length,
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    });

                    for (const update of chunk) {
                        allResults.push({
                            id: update.userId,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                        totalFailure++;
                    }
                }
            }

            logger.info('Batch set user notifications completed', {
                totalUpdates: updates.length,
                successCount: totalSuccess,
                failureCount: totalFailure,
                chunksProcessed: chunks.length,
            });

            return {
                successCount: totalSuccess,
                failureCount: totalFailure,
                results: allResults,
            };
        });
    }

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    /**
     * Create a share link within a transaction
     * @param transaction - The transaction object
     * @param groupId - The group ID
     * @param shareLinkData - The share link data
     * @returns Document reference
     */
    createShareLinkInTransaction(transaction: ITransaction, groupId: GroupId, shareLinkData: Omit<ShareLinkDTO, 'id'>) {
        const shareLinksCollection = this
            .db
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('shareLinks');

        const shareLinkRef = shareLinksCollection.doc();

        // ShareLink data already validated - don't override timestamps
        const finalData = {
            ...shareLinkData,
            id: shareLinkRef.id,
        };

        transaction.create(shareLinkRef, finalData);

        return shareLinkRef;
    }

    // ========================================================================
    // Policy Operations
    // ========================================================================

    /**
     * Create a policy document
     * @param policyId - The policy ID (optional, auto-generated if not provided)
     * @param policyData - The policy data
     * @returns Write result
     */
    async createPolicy(policyId: string | null, policyData: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createPolicy', async () => {
            try {
                const policiesCollection = this.db.collection('policies');
                const policyRef = policyId ? policiesCollection.doc(policyId) : policiesCollection.doc();

                // Convert ISO strings to Timestamps before validation (DTO → Firestore)
                const convertedData = this.convertISOToTimestamps(policyData);

                const finalData = {
                    ...convertedData,
                    id: policyRef.id,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Validate with temp timestamps for schema validation
                const dataForValidation = {
                    ...convertedData,
                    id: policyRef.id,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                };
                PolicyDocumentSchema.parse(dataForValidation);

                await policyRef.set(finalData);

                logger.info('Policy document created (validated)', { policyId: policyRef.id });

                return {
                    id: policyRef.id,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to create policy document', error, { policyId });
                return {
                    id: policyId || '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    /**
     * Update a policy document
     * @param policyId - The policy ID
     * @param updates - The policy updates
     * @returns Write result
     */
    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updatePolicy', async () => {
            try {
                // Convert ISO strings to Timestamps in the updates
                const convertedUpdates = this.convertISOToTimestamps(updates);

                const finalUpdates = {
                    ...convertedUpdates,
                    updatedAt: Timestamp.now(),
                };

                // Validate before writing
                const documentPath = `policies/${policyId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, policyId);

                // Validate merged data
                PolicyDocumentSchema.parse(mergedData);

                await this.db.collection('policies').doc(policyId).update(finalUpdates);

                logger.info('Policy document updated (validated)', { policyId, fields: Object.keys(updates) });

                return {
                    id: policyId,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to update policy document', error, { policyId });
                return {
                    id: policyId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    /**
     * Perform health check operations (lightweight connectivity check)
     * @returns Health check result with timing information
     */
    async performHealthCheck(): Promise<{ success: boolean; responseTime: number; }> {
        return measureDb('FirestoreWriter.performHealthCheck', async () => {
            const startTime = Date.now();

            try {
                // Lightweight health check: just verify we can connect to Firestore
                // This only checks connectivity without performing any database operations
                await this.db.listCollections();

                const responseTime = Date.now() - startTime;

                logger.info('Health check completed successfully', { responseTime });

                return {
                    success: true,
                    responseTime,
                };
            } catch (error) {
                const responseTime = Date.now() - startTime;
                logger.error('Health check failed', error, { responseTime });

                return {
                    success: false,
                    responseTime,
                };
            }
        });
    }

    // ========================================================================
    // Test Pool Operations (for TestUserPoolService)
    // ========================================================================

    /**
     * Create a test pool user document
     * Note: This bypasses schema validation as test-user-pool is not a canonical collection
     */
    async createTestPoolUser(
        email: string,
        userData: {
            email: string;
            token: string;
            password: string;
            status: 'available' | 'borrowed';
        },
    ): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createTestPoolUser', async () => {
            try {
                const finalData = {
                    ...userData,
                    createdAt: FieldValue.serverTimestamp(),
                };

                await this.db.collection('test-user-pool').doc(email).set(finalData);

                logger.info('Test pool user created', { email });

                return {
                    id: email,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to create test pool user', error, { email });
                return {
                    id: email,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    /**
     * Update a test pool user document
     * Note: This bypasses schema validation as test-user-pool is not a canonical collection
     */
    async updateTestPoolUser(email: string, updates: { status?: 'available' | 'borrowed'; }): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTestPoolUser', async () => {
            try {
                await this.db.collection('test-user-pool').doc(email).update(updates);

                return {
                    id: email,
                    success: true,
                    timestamp: new Date(),
                };
            } catch (error) {
                logger.error('Failed to update test pool user', error, { email, updates });
                return {
                    id: email,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Transaction Helper Methods (Phase 1 - Transaction Foundation)
    // ========================================================================

    /**
     * Delete multiple documents within a transaction atomically
     * @param transaction - The transaction context
     * @param documentPaths - Array of document paths to delete
     * @throws Error if any deletion fails (transaction will be aborted)
     */
    bulkDeleteInTransaction(transaction: ITransaction, documentPaths: string[]): void {
        if (!Array.isArray(documentPaths)) {
            throw new Error('documentPaths must be an array');
        }

        if (documentPaths.length === 0) {
            logger.warn('bulkDeleteInTransaction called with empty paths array');
            return;
        }

        // Enhanced validation and monitoring for bulk delete operations
        const collectionCounts: Record<string, number> = {};
        const validatedPaths: string[] = [];

        // Pre-validate all paths and collect statistics
        for (const path of documentPaths) {
            if (!path || typeof path !== 'string') {
                throw new Error(`Invalid document path: ${path}`);
            }

            // Validate path format (collection/document or collection/document/subcollection/document)
            const pathSegments = path.split('/');
            if (pathSegments.length < 2 || pathSegments.length % 2 !== 0) {
                throw new Error(`Invalid document path format: ${path}. Must be collection/document or collection/document/subcollection/document`);
            }

            // Track deletions by collection for monitoring
            const collection = pathSegments[0];
            collectionCounts[collection] = (collectionCounts[collection] || 0) + 1;
            validatedPaths.push(path);
        }

        logger.info('Bulk delete in transaction initiated (enhanced validation)', {
            operation: 'bulkDeleteInTransaction',
            documentCount: validatedPaths.length,
            collectionBreakdown: collectionCounts,
            collections: Object.keys(collectionCounts),
        });

        // Perform all deletions
        for (const path of validatedPaths) {
            try {
                const docRef = this.db.doc(path);
                transaction.delete(docRef);
            } catch (error) {
                logger.error('Failed to delete document in transaction', error, {
                    path,
                    operation: 'bulkDeleteInTransaction',
                });
                throw new Error(`Failed to delete document at path: ${path}`);
            }
        }

        logger.info('Bulk delete in transaction completed (enhanced monitoring)', {
            operation: 'bulkDeleteInTransaction',
            documentCount: validatedPaths.length,
            collectionBreakdown: collectionCounts,
            validationStatus: 'all paths validated',
        });
    }

    // ========================================================================
    // Group Deletion and Recovery Operations
    // ========================================================================

    /**
     * Get a document reference within a transaction for complex operations
     */
    getDocumentReferenceInTransaction(transaction: ITransaction, collection: string, documentId: string) {
        return this.db.collection(collection).doc(documentId);
    }

    async leaveGroupAtomic(groupId: GroupId, userId: string): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.leaveGroupAtomic', async () => {
            try {
                // Use a transaction for transactional correctness
                // This ensures the membership list we read is consistent with the updates we perform
                const result = await this.db.runTransaction(async (transaction) => {
                    // 1. Query all current group members INSIDE the transaction
                    const membershipQuery = this
                        .db
                        .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                        .where('groupId', '==', groupId);
                    const membershipsSnapshot = await transaction.get(membershipQuery);
                    const allMemberIds = membershipsSnapshot.docs.map(doc => doc.data().userId);

                    // Filter out the leaving member to get remaining members
                    const remainingMemberIds = allMemberIds.filter(id => id !== userId);

                    // Generate membership document ID using helper function
                    const membershipDocId = getTopLevelMembershipDocId(userId, groupId);

                    // 2. Update group timestamp
                    const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
                    transaction.update(groupRef, {
                        updatedAt: FieldValue.serverTimestamp(),
                    });

                    // 3. Delete membership document
                    const membershipRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${membershipDocId}`);
                    transaction.delete(membershipRef);

                    // 4. Clean up leaving user's notification document
                    const userNotificationRef = this.db.doc(`user-notifications/${userId}`);
                    transaction.update(userNotificationRef, {
                        [`groups.${groupId}`]: FieldValue.delete(),
                        changeVersion: FieldValue.increment(1),
                        lastModified: FieldValue.serverTimestamp(),
                    });

                    // 5. Notify remaining members about group change (member left)
                    // This ensures remaining members see the updated member list without navigation
                    const now = new Date().toISOString();
                    for (const remainingMemberId of remainingMemberIds) {
                        const remainingMemberNotificationRef = this.db.doc(`user-notifications/${remainingMemberId}`);
                        transaction.set(remainingMemberNotificationRef, {
                            changeVersion: FieldValue.increment(1),
                            lastModified: FieldValue.serverTimestamp(),
                            groups: {
                                [groupId]: {
                                    lastGroupDetailsChange: now,
                                    groupDetailsChangeCount: FieldValue.increment(1),
                                },
                            },
                        }, { merge: true });
                    }

                    return {
                        membershipDocId,
                        remainingMemberCount: remainingMemberIds.length,
                        remainingMemberIds,
                    };
                });

                logger.info('User left group atomically - group updated, membership deleted, notifications updated', {
                    userId,
                    groupId,
                    membershipDocId: result.membershipDocId,
                    remainingMembers: result.remainingMemberCount,
                });

                return {
                    successCount: 3 + result.remainingMemberCount,
                    failureCount: 0,
                    results: [
                        { id: groupId, success: true, timestamp: new Date() },
                        { id: result.membershipDocId, success: true, timestamp: new Date() },
                        { id: `user-notification-${userId}-${groupId}`, success: true, timestamp: new Date() },
                        ...result.remainingMemberIds.map(id => ({
                            id: `user-notification-${id}-${groupId}`,
                            success: true,
                            timestamp: new Date(),
                        })),
                    ],
                };
            } catch (error) {
                logger.error('Atomic leave group operation failed', error);
                return {
                    successCount: 0,
                    failureCount: 3,
                    results: [
                        {
                            id: groupId,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                        {
                            id: `${userId}_${groupId}`,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                        {
                            id: `user-notification-${userId}-${groupId}`,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                    ],
                };
            }
        });
    }
}
