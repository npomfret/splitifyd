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
import type { CommentDTO, DisplayName, Email, ShareLinkDTO, ShareLinkToken, TenantId, TenantImageDTO, TenantImageId, UserId } from '@billsplit-wl/shared';
import { normalizeDisplayNameForComparison } from '@billsplit-wl/shared';
// Import schemas for validation
import { CommentId, ExpenseId, GroupId, PolicyId, ShareLinkId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { ALLOWED_POLICY_IDS, FirestoreCollections } from '../../constants';
import { ApiError, ErrorDetail, Errors } from '../../errors';
import { FieldValue, type IDocumentReference, type IFirestoreDatabase, type ITransaction, type IWriteBatch, Timestamp } from '../../firestore-wrapper';
import { logger } from '../../logger';
import { measureDb } from '../../monitoring/measure';

import type { BrandingArtifactMetadata } from '@billsplit-wl/shared';
import { SystemUserRoles } from '@billsplit-wl/shared';
import { isoStringNow } from '@billsplit-wl/shared';
import type { MergeJobDocument, MergeJobStatus } from '../../merge/MergeService';
import type { GroupBalanceDTO } from '../../schemas';
import {
    ActivityFeedDocumentSchema,
    CommentDataSchema,
    ExpenseDocumentSchema,
    GroupBalanceDocumentSchema,
    GroupDocumentSchema,
    PolicyDocumentSchema,
    SettlementDocumentSchema,
    TenantDocumentSchema,
    TopLevelGroupMemberSchema,
    UserDocumentSchema,
    validateUpdate,
} from '../../schemas';
import type { FirestoreUserCreateData, FirestoreUserUpdateData, IFirestoreWriter, TenantDocumentUpsertData, WriteResult } from './IFirestoreWriter';

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
        ]);

        // Fields where ALL values in the record should be converted to Timestamps
        // (e.g., recentlyUsedLabels: Record<string, ISOString> where all values are timestamps)
        const timestampRecordFields = new Set([
            'recentlyUsedLabels',
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
            } else if (timestampRecordFields.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
                // Convert all values in timestamp record fields (e.g., recentlyUsedLabels)
                const convertedRecord: Record<string, any> = {};
                for (const [recordKey, recordValue] of Object.entries(value)) {
                    if (recordValue !== null && recordValue !== undefined) {
                        convertedRecord[recordKey] = this.isoToTimestamp(recordValue);
                    } else {
                        convertedRecord[recordKey] = recordValue;
                    }
                }
                result[key] = convertedRecord;
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
            [FirestoreCollections.ACTIVITY_FEED]: ActivityFeedDocumentSchema,
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

    private getGroupCommentCollectionPath(groupId: GroupId): string {
        return `${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}`;
    }

    private getExpenseCommentCollectionPath(expenseId: ExpenseId): string {
        return `${FirestoreCollections.EXPENSES}/${expenseId}/${FirestoreCollections.COMMENTS}`;
    }

    private buildCommentWriteData(commentData: Omit<CommentDTO, 'id'>) {
        const cleanedData = this.removeUndefinedValues(commentData);
        const convertedData = this.convertISOToTimestamps(cleanedData);
        const validatedData = CommentDataSchema.parse(convertedData);

        return {
            ...validatedData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
    }

    // ========================================================================
    // User Write Operations
    // ========================================================================

    async createUser(userId: UserId, userData: FirestoreUserCreateData): Promise<WriteResult> {
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

    async promoteUserToAdmin(userId: UserId): Promise<void> {
        await this.db.collection(FirestoreCollections.USERS).doc(userId).set({
            role: SystemUserRoles.SYSTEM_ADMIN,
        }, { merge: true });
    }

    async updateUser(userId: UserId, updates: FirestoreUserUpdateData): Promise<WriteResult> {
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
                throw error;
            }
        });
    }

    async touchGroupWithPreloadedRefs(
        groupId: GroupId,
        transaction: ITransaction,
        membershipRefs: IDocumentReference[],
    ): Promise<void> {
        const now = Timestamp.now();
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);

        // Update group document
        transaction.update(groupRef, { updatedAt: now });

        // Update all preloaded membership refs
        for (const ref of membershipRefs) {
            transaction.update(ref, { groupUpdatedAt: now });
        }
    }

    async updateGroupMemberDisplayName(groupId: GroupId, userId: UserId, newDisplayName: DisplayName): Promise<void> {
        return measureDb('FirestoreWriter.updateGroupMemberDisplayName', async () => {
            const trimmedDisplayName = newDisplayName?.trim() ?? '';

            // Validate display name before transaction
            if (!trimmedDisplayName) {
                throw Errors.validationError('displayName', ErrorDetail.MISSING_FIELD);
            }

            const normalizedNewDisplayName = normalizeDisplayNameForComparison(trimmedDisplayName);

            await this.db.runTransaction(async (transaction) => {
                // PHASE 1: ALL READS FIRST
                // Query all current group members to check for name conflicts
                const membershipQuery = this.db.collection(FirestoreCollections.GROUP_MEMBERSHIPS).where('groupId', '==', groupId);
                const membershipsSnapshot = await transaction.get(membershipQuery);

                if (membershipsSnapshot.empty) {
                    throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
                }

                // Check if display name is already taken by another user
                // Note: member documents use 'uid' field to store the user ID
                // Every member MUST have groupDisplayName set (no fallbacks)
                const members = membershipsSnapshot.docs.map((doc) => doc.data() as { uid?: string; groupDisplayName?: string; });
                const nameTaken = members.some((member) => {
                    if (!member?.uid || member.uid === userId) {
                        return false;
                    }

                    const existing = member.groupDisplayName ?? '';
                    if (!existing.trim()) {
                        return false;
                    }

                    return normalizeDisplayNameForComparison(existing) === normalizedNewDisplayName;
                });

                if (nameTaken) {
                    throw Errors.conflict(ErrorDetail.DISPLAY_NAME_TAKEN);
                }

                // Find the target member's document
                const memberDoc = membershipsSnapshot.docs.find((doc) => doc.data().uid === userId);
                if (!memberDoc) {
                    throw Errors.notFound('Member', ErrorDetail.MEMBER_NOT_FOUND);
                }

                // PHASE 2: ALL WRITES AFTER ALL READS
                // Update the member's groupDisplayName
                const memberRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${memberDoc.id}`);
                transaction.update(memberRef, {
                    groupDisplayName: trimmedDisplayName,
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
                    newDisplayName: trimmedDisplayName,
                });
            });
        });
    }

    // ========================================================================
    // Group Balance Operations
    // ========================================================================

    setGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, balance: GroupBalanceDTO): void {
        const balanceRef = this.db.collection(FirestoreCollections.BALANCES).doc(groupId);

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
        const balanceRef = this.db.collection(FirestoreCollections.BALANCES).doc(groupId);

        const doc = await transaction.get(balanceRef);

        if (!doc.exists) {
            throw Errors.notFound('Balance', ErrorDetail.BALANCE_NOT_FOUND);
        }

        const data = doc.data();
        if (!data) {
            throw Errors.serviceError(ErrorDetail.DATABASE_ERROR);
        }

        // Validate and convert to DTO (Timestamps → ISO strings)
        const validated = GroupBalanceDocumentSchema.parse(data);
        return this.convertTimestampsToISO(validated) as any as GroupBalanceDTO;
    }

    updateGroupBalanceInTransaction(transaction: ITransaction, groupId: GroupId, currentBalance: GroupBalanceDTO, updater: (current: GroupBalanceDTO) => GroupBalanceDTO): void {
        const balanceRef = this.db.collection(FirestoreCollections.BALANCES).doc(groupId);

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

    createGroupCommentInTransaction(transaction: ITransaction, groupId: GroupId, commentData: Omit<CommentDTO, 'id'>) {
        return this.createCommentInTransactionInternal(transaction, this.getGroupCommentCollectionPath(groupId), commentData);
    }

    createExpenseCommentInTransaction(transaction: ITransaction, expenseId: ExpenseId, commentData: Omit<CommentDTO, 'id'>) {
        // Create the comment
        const commentRef = this.createCommentInTransactionInternal(transaction, this.getExpenseCommentCollectionPath(expenseId), commentData);

        // Increment the expense's commentCount
        const expenseRef = this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId);
        transaction.update(expenseRef, {
            commentCount: FieldValue.increment(1),
            updatedAt: Timestamp.now(),
        });

        return commentRef;
    }

    private createCommentInTransactionInternal(transaction: ITransaction, collectionPath: string, commentData: Omit<CommentDTO, 'id'>) {
        const commentRef = this.db.collection(collectionPath).doc();
        const finalData = this.buildCommentWriteData(commentData);
        transaction.set(commentRef, finalData);
        return commentRef;
    }

    async deleteGroupComment(groupId: GroupId, commentId: CommentId): Promise<void> {
        return measureDb('FirestoreWriter.deleteGroupComment', async () => {
            const commentRef = this.db.collection(this.getGroupCommentCollectionPath(groupId)).doc(commentId);
            await commentRef.delete();
            logger.info('Group comment deleted', { groupId, commentId });
        });
    }

    async deleteExpenseComment(expenseId: ExpenseId, commentId: CommentId): Promise<void> {
        return measureDb('FirestoreWriter.deleteExpenseComment', async () => {
            await this.db.runTransaction(async (transaction) => {
                const commentRef = this.db.collection(this.getExpenseCommentCollectionPath(expenseId)).doc(commentId);

                // Delete the comment
                transaction.delete(commentRef);

                // Decrement the expense's commentCount
                const expenseRef = this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId);
                transaction.update(expenseRef, {
                    commentCount: FieldValue.increment(-1),
                    updatedAt: Timestamp.now(),
                });
            });
            logger.info('Expense comment deleted', { expenseId, commentId });
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

    /**
     * Get activity feed items for a user (non-transaction version for async cleanup)
     */
    async getActivityFeedItemsForUser(userId: UserId, limit: number): Promise<Array<{ id: string; }>> {
        const collectionRef = this.db.collection(FirestoreCollections.ACTIVITY_FEED).doc(userId).collection('items');
        const query = collectionRef.orderBy('createdAt', 'desc').limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({ id: doc.id }));
    }

    createBatch(): IWriteBatch {
        return this.db.batch();
    }

    deleteActivityFeedItemInBatch(batch: IWriteBatch, userId: UserId, documentId: string): void {
        const collectionRef = this.db.collection(FirestoreCollections.ACTIVITY_FEED).doc(userId).collection('items');
        const docRef = collectionRef.doc(documentId);
        batch.delete(docRef);
    }

    createActivityFeedItemInBatch(batch: IWriteBatch, userId: UserId, documentId: string | null, data: any): void {
        const collectionRef = this.db.collection(FirestoreCollections.ACTIVITY_FEED).doc(userId).collection('items');
        const docRef = documentId ? collectionRef.doc(documentId) : collectionRef.doc();
        batch.set(docRef, {
            ...data,
            // Preserve passed-in timestamp for deduplication consistency across batch writes
            timestamp: data.timestamp ? this.isoToTimestamp(data.timestamp) : FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    // ========================================================================
    // Utility Operations
    // ========================================================================

    generateDocumentId(collection: string): string {
        return this.db.collection(collection).doc().id;
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

        const shareLinkIndexRef = this
            .db
            .collection(FirestoreCollections.SHARE_LINK_TOKENS)
            .doc(finalData.token);

        transaction.set(shareLinkIndexRef, {
            groupId,
            shareLinkId: shareLinkRef.id,
            expiresAt: finalData.expiresAt,
            createdBy: finalData.createdBy,
            createdAt: finalData.createdAt,
        });

        return shareLinkRef;
    }

    async deleteShareLink(groupId: GroupId, shareLinkId: ShareLinkId, shareToken: ShareLinkToken): Promise<void> {
        await this.db.runTransaction(async (transaction) => {
            const shareLinkRef = this
                .db
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .collection('shareLinks')
                .doc(shareLinkId);

            transaction.delete(shareLinkRef);

            const shareTokenIndexRef = this
                .db
                .collection(FirestoreCollections.SHARE_LINK_TOKENS)
                .doc(shareToken);

            transaction.delete(shareTokenIndexRef);
        });
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
    async createPolicy(policyId: PolicyId | null, policyData: any): Promise<WriteResult> {
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

                // Validate policy ID - only standard policies are allowed (database constraint)
                if (!ALLOWED_POLICY_IDS.has(policyRef.id)) {
                    throw Errors.validationError('policyId');
                }

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
    async updatePolicy(policyId: PolicyId, updates: any): Promise<WriteResult> {
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
        email: Email,
        userData: {
            email: Email;
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
    async updateTestPoolUser(email: Email, updates: { status?: 'available' | 'borrowed'; }): Promise<WriteResult> {
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

    /**
     * Atomically borrow an available test pool user.
     * Uses a transaction to find an available user and mark it as borrowed.
     */
    async borrowAvailableTestPoolUser(): Promise<{ email: Email; token: string; password: string; } | null> {
        return measureDb('FirestoreWriter.borrowAvailableTestPoolUser', async () => {
            return this.db.runTransaction(async (transaction) => {
                const availableUsersQuery = this.db.collection('test-user-pool').where('status', '==', 'available').limit(1);
                const availableUsersSnapshot = await transaction.get(availableUsersQuery);

                if (availableUsersSnapshot.empty) {
                    return null;
                }

                const doc = availableUsersSnapshot.docs[0];
                const data = doc.data() as { email: Email; token: string; password: string; status: string; };

                // Mark as borrowed within the transaction
                transaction.update(doc.ref, { status: 'borrowed' });

                return {
                    email: data.email,
                    token: data.token,
                    password: data.password,
                };
            });
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

    // ========================================================================
    // Tenant Write Operations
    // ========================================================================

    /**
     * Update tenant branding configuration
     * Updates branding fields within a tenant document.
     *
     * Field routing:
     * - appName → brandingTokens.tokens.legal.appName
     * - logoUrl → brandingTokens.tokens.assets.logoUrl
     * - faviconUrl → brandingTokens.tokens.assets.faviconUrl
     * - primaryColor → branding.primaryColor AND brandingTokens.tokens.palette.primary
     * - secondaryColor → branding.secondaryColor AND brandingTokens.tokens.palette.secondary
     * - accentColor → branding.accentColor AND brandingTokens.tokens.palette.accent
     * - marketingFlags.* → marketingFlags.*
     * - Other fields → branding.*
     *
     * @param tenantId - The tenant ID to update
     * @param brandingUpdates - Partial branding updates (pre-validated by schema)
     * @returns Write result with document ID and success status
     */
    async updateTenantBranding(tenantId: string, brandingUpdates: Record<string, any>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTenantBranding', async () => {
            try {
                const tenantRef = this.db.collection(FirestoreCollections.TENANTS).doc(tenantId);

                const updates: Record<string, any> = {
                    updatedAt: FieldValue.serverTimestamp(),
                };

                for (const [key, value] of Object.entries(brandingUpdates)) {
                    if (key === 'marketingFlags' && typeof value === 'object') {
                        for (const [flagKey, flagValue] of Object.entries(value)) {
                            updates[`marketingFlags.${flagKey}`] = flagValue;
                        }
                    } else if (key === 'appName') {
                        updates['brandingTokens.tokens.legal.appName'] = value;
                    } else if (key === 'logoUrl') {
                        updates['brandingTokens.tokens.assets.logoUrl'] = value;
                    } else if (key === 'faviconUrl') {
                        updates['brandingTokens.tokens.assets.faviconUrl'] = value;
                    } else if (key === 'primaryColor') {
                        updates['branding.primaryColor'] = value;
                        updates['brandingTokens.tokens.palette.primary'] = value;
                    } else if (key === 'secondaryColor') {
                        updates['branding.secondaryColor'] = value;
                        updates['brandingTokens.tokens.palette.secondary'] = value;
                    } else if (key === 'accentColor') {
                        updates['branding.accentColor'] = value;
                        updates['brandingTokens.tokens.palette.accent'] = value;
                    } else {
                        updates[`branding.${key}`] = value;
                    }
                }

                await tenantRef.update(updates);

                return {
                    id: tenantId,
                    success: true,
                };
            } catch (error) {
                logger.error('Failed to update tenant branding', error, { tenantId, brandingUpdates });
                return {
                    id: tenantId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async upsertTenant(tenantId: string, data: TenantDocumentUpsertData): Promise<WriteResult & { created: boolean; }> {
        return measureDb('FirestoreWriter.upsertTenant', async () => {
            try {
                return await this.db.runTransaction(async (transaction) => {
                    const tenantRef = this.db.collection(FirestoreCollections.TENANTS).doc(tenantId);

                    // All reads must happen first in a transaction
                    const snapshot = await transaction.get(tenantRef);
                    const created = !snapshot.exists;

                    // Check for domain conflicts with other tenants
                    if (data.domains && data.domains.length > 0) {
                        // Check each domain for conflicts
                        for (const domain of data.domains) {
                            const conflictingTenantsSnapshot = await transaction.get(
                                this
                                    .db
                                    .collection(FirestoreCollections.TENANTS)
                                    .where('domains', 'array-contains', domain),
                            );

                            // Check if any conflicting tenant is NOT the current tenant
                            const conflictingDoc = conflictingTenantsSnapshot.docs.find((doc) => doc.id !== tenantId);
                            if (conflictingDoc) {
                                throw Errors.alreadyExists('Domain');
                            }
                        }
                    }

                    // Enforce default tenant rules
                    if (!created && snapshot.exists) {
                        const existingData = snapshot.data();
                        const isCurrentlyDefault = existingData?.defaultTenant === true;
                        const newDefaultFlag = data.defaultTenant;

                        // Cannot remove default flag without transferring it to another tenant
                        if (isCurrentlyDefault && newDefaultFlag === false) {
                            throw Errors.validationError('defaultTenant', ErrorDetail.MISSING_FIELD);
                        }
                    }

                    // If setting this tenant as default, read all current default tenants
                    const otherDefaultTenantRefs: IDocumentReference[] = [];
                    if (data.defaultTenant === true) {
                        const tenantsSnapshot = await transaction.get(
                            this.db.collection(FirestoreCollections.TENANTS).where('defaultTenant', '==', true),
                        );
                        tenantsSnapshot.docs.forEach((doc) => {
                            if (doc.id !== tenantId) {
                                otherDefaultTenantRefs.push(doc.ref);
                            }
                        });
                    }

                    // Validate data before adding timestamps (follow pattern from createUser)
                    const tenantDocument = TenantDocumentSchema.parse({
                        id: tenantId,
                        ...data,
                        createdAt: created ? Timestamp.now() : snapshot.data()!.createdAt,
                        updatedAt: Timestamp.now(),
                    });

                    const sanitized = this.removeUndefinedValues(tenantDocument);

                    // Replace validation timestamps with FieldValue.serverTimestamp() for the actual write
                    const finalData = {
                        ...sanitized,
                        createdAt: created ? FieldValue.serverTimestamp() : snapshot.data()!.createdAt,
                        updatedAt: FieldValue.serverTimestamp(),
                    };

                    // All writes must happen after all reads in a transaction
                    // First, remove default flag from other tenants
                    otherDefaultTenantRefs.forEach((ref) => {
                        transaction.update(ref, {
                            defaultTenant: false,
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                    });

                    // Then, set the current tenant
                    // Use merge: true to preserve fields not in finalData (e.g., brandingTokens.artifact)
                    transaction.set(tenantRef, finalData, { merge: true });

                    return {
                        id: tenantId,
                        success: true,
                        created,
                    };
                });
            } catch (error) {
                logger.error('Failed to upsert tenant', error, { tenantId });
                if (error instanceof ApiError) {
                    throw error;
                }
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async updateTenantThemeArtifact(tenantId: string, artifact: BrandingArtifactMetadata): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTenantThemeArtifact', async () => {
            try {
                const tenantRef = this.db.collection(FirestoreCollections.TENANTS).doc(tenantId);
                await tenantRef.update({
                    'brandingTokens.artifact': artifact,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                return {
                    id: tenantId,
                    success: true,
                };
            } catch (error) {
                logger.error('Failed to update tenant theme artifact', error, { tenantId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    // ========================================================================
    // Merge Job Operations
    // ========================================================================

    async createMergeJob(jobId: string, jobData: MergeJobDocument): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createMergeJob', async () => {
            try {
                const mergeJobRef = this.db.collection(FirestoreCollections.ACCOUNT_MERGES).doc(jobId);
                await mergeJobRef.set(jobData);

                return {
                    id: jobId,
                    success: true,
                };
            } catch (error) {
                logger.error('Failed to create merge job', error, { jobId });
                throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
            }
        });
    }

    async updateMergeJobStatus(jobId: string, status: MergeJobStatus, error?: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateMergeJobStatus', async () => {
            try {
                const mergeJobRef = this.db.collection(FirestoreCollections.ACCOUNT_MERGES).doc(jobId);
                const updates: Partial<MergeJobDocument> = {
                    status,
                };

                if (status === 'processing' && !updates.startedAt) {
                    updates.startedAt = isoStringNow();
                }

                if (status === 'completed' || status === 'failed') {
                    updates.completedAt = isoStringNow();
                }

                if (error) {
                    updates.error = error;
                }

                await mergeJobRef.update(updates);

                return {
                    id: jobId,
                    success: true,
                };
            } catch (err) {
                logger.error('Failed to update merge job status', err, { jobId, status });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignGroupOwnership(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignGroupOwnership', async () => {
            try {
                const groupsSnapshot = await this
                    .db
                    .collection(FirestoreCollections.GROUPS)
                    .where('ownerId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                groupsSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { ownerId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-group-ownership-complete', { fromUserId, toUserId, count: groupsSnapshot.size });
                return groupsSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign group ownership', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignGroupMemberships(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignGroupMemberships', async () => {
            try {
                const membershipsSnapshot = await this
                    .db
                    .collection(FirestoreCollections.GROUP_MEMBERSHIPS)
                    .where('userId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                membershipsSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { userId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-group-memberships-complete', { fromUserId, toUserId, count: membershipsSnapshot.size });
                return membershipsSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign group memberships', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignExpensePayer(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignExpensePayer', async () => {
            try {
                const expensesSnapshot = await this
                    .db
                    .collection(FirestoreCollections.EXPENSES)
                    .where('paidBy', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                expensesSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { paidBy: toUserId });
                });

                await batch.commit();
                logger.info('reassign-expense-payer-complete', { fromUserId, toUserId, count: expensesSnapshot.size });
                return expensesSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign expense payer', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignExpenseParticipants(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignExpenseParticipants', async () => {
            try {
                const expensesSnapshot = await this
                    .db
                    .collection(FirestoreCollections.EXPENSES)
                    .where('participants', 'array-contains', fromUserId)
                    .get();

                const batch = this.db.batch();
                expensesSnapshot.forEach((doc) => {
                    const data = doc.data();
                    const participants = data.participants || [];
                    const updatedParticipants = participants.map((p: UserId) => (p === fromUserId ? toUserId : p));
                    batch.update(doc.ref, { participants: updatedParticipants });
                });

                await batch.commit();
                logger.info('reassign-expense-participants-complete', { fromUserId, toUserId, count: expensesSnapshot.size });
                return expensesSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign expense participants', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignSettlementPayer(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignSettlementPayer', async () => {
            try {
                const settlementsSnapshot = await this
                    .db
                    .collection(FirestoreCollections.SETTLEMENTS)
                    .where('payerId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                settlementsSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { payerId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-settlement-payer-complete', { fromUserId, toUserId, count: settlementsSnapshot.size });
                return settlementsSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign settlement payer', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignSettlementPayee(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignSettlementPayee', async () => {
            try {
                const settlementsSnapshot = await this
                    .db
                    .collection(FirestoreCollections.SETTLEMENTS)
                    .where('payeeId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                settlementsSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { payeeId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-settlement-payee-complete', { fromUserId, toUserId, count: settlementsSnapshot.size });
                return settlementsSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign settlement payee', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignCommentAuthors(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignCommentAuthors', async () => {
            try {
                const commentsSnapshot = await this
                    .db
                    .collection(FirestoreCollections.COMMENTS)
                    .where('authorId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                commentsSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { authorId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-comment-authors-complete', { fromUserId, toUserId, count: commentsSnapshot.size });
                return commentsSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign comment authors', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignActivityFeedActors(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignActivityFeedActors', async () => {
            try {
                const activitySnapshot = await this
                    .db
                    .collection(FirestoreCollections.ACTIVITY_FEED)
                    .where('actorId', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                activitySnapshot.forEach((doc) => {
                    batch.update(doc.ref, { actorId: toUserId });
                });

                await batch.commit();
                logger.info('reassign-activity-feed-actors-complete', { fromUserId, toUserId, count: activitySnapshot.size });
                return activitySnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign activity feed actors', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async reassignShareLinkTokens(fromUserId: UserId, toUserId: UserId): Promise<number> {
        return measureDb('FirestoreWriter.reassignShareLinkTokens', async () => {
            try {
                const tokensSnapshot = await this
                    .db
                    .collection(FirestoreCollections.SHARE_LINK_TOKENS)
                    .where('createdBy', '==', fromUserId)
                    .get();

                const batch = this.db.batch();
                tokensSnapshot.forEach((doc) => {
                    batch.update(doc.ref, { createdBy: toUserId });
                });

                await batch.commit();
                logger.info('reassign-share-link-tokens-complete', { fromUserId, toUserId, count: tokensSnapshot.size });
                return tokensSnapshot.size;
            } catch (err) {
                logger.error('Failed to reassign share link tokens', err, { fromUserId, toUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async markUserAsMerged(userId: UserId, mergedIntoUserId: UserId): Promise<WriteResult> {
        return measureDb('FirestoreWriter.markUserAsMerged', async () => {
            try {
                const userRef = this.db.collection(FirestoreCollections.USERS).doc(userId);
                await userRef.update({
                    mergedInto: mergedIntoUserId,
                    mergedAt: isoStringNow(),
                    disabled: true,
                });

                logger.info('mark-user-as-merged-complete', { userId, mergedIntoUserId });
                return {
                    id: userId,
                    success: true,
                };
            } catch (err) {
                logger.error('Failed to mark user as merged', err, { userId, mergedIntoUserId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    // ========================================================================
    // Tenant Image Library Operations
    // ========================================================================

    async createTenantImage(tenantId: TenantId, imageData: TenantImageDTO): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createTenantImage', async () => {
            try {
                const imageRef = this
                    .db
                    .collection(FirestoreCollections.TENANTS)
                    .doc(tenantId)
                    .collection('images')
                    .doc(imageData.id);

                await imageRef.set({
                    name: imageData.name,
                    url: imageData.url,
                    contentType: imageData.contentType,
                    sizeBytes: imageData.sizeBytes,
                    uploadedAt: imageData.uploadedAt,
                    uploadedBy: imageData.uploadedBy,
                });

                logger.info('create-tenant-image-complete', { tenantId, imageId: imageData.id });
                return {
                    id: imageData.id,
                    success: true,
                };
            } catch (err) {
                logger.error('Failed to create tenant image', err, { tenantId, imageId: imageData.id });
                throw Errors.serviceError(ErrorDetail.CREATION_FAILED);
            }
        });
    }

    async updateTenantImage(tenantId: TenantId, imageId: TenantImageId, updates: Partial<Pick<TenantImageDTO, 'name'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTenantImage', async () => {
            try {
                const imageRef = this
                    .db
                    .collection(FirestoreCollections.TENANTS)
                    .doc(tenantId)
                    .collection('images')
                    .doc(imageId);

                await imageRef.update(updates);

                logger.info('update-tenant-image-complete', { tenantId, imageId });
                return {
                    id: imageId,
                    success: true,
                };
            } catch (err) {
                logger.error('Failed to update tenant image', err, { tenantId, imageId });
                throw Errors.serviceError(ErrorDetail.UPDATE_FAILED);
            }
        });
    }

    async deleteTenantImage(tenantId: TenantId, imageId: TenantImageId): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteTenantImage', async () => {
            try {
                const imageRef = this
                    .db
                    .collection(FirestoreCollections.TENANTS)
                    .doc(tenantId)
                    .collection('images')
                    .doc(imageId);

                await imageRef.delete();

                logger.info('delete-tenant-image-complete', { tenantId, imageId });
                return {
                    id: imageId,
                    success: true,
                };
            } catch (err) {
                logger.error('Failed to delete tenant image', err, { tenantId, imageId });
                throw Errors.serviceError(ErrorDetail.DELETE_FAILED);
            }
        });
    }
}
