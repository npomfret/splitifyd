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

import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../logger';
import { FirestoreCollections, CommentTargetTypes, type CommentTargetType } from '@splitifyd/shared';
import { getTopLevelMembershipDocId } from '../../utils/groupMembershipHelpers';
import { measureDb } from '../../monitoring/measure';

// Import schemas for validation
import { UserDocumentSchema, GroupDocumentSchema, ExpenseDocumentSchema, SettlementDocumentSchema, CommentDataSchema, PolicyDocumentSchema } from '../../schemas';
import { UserNotificationDocumentSchema, UserNotificationGroupSchema } from '../../schemas/user-notifications';
import { TransactionChangeDocumentSchema, BalanceChangeDocumentSchema } from '../../schemas/change-documents';
import { TopLevelGroupMemberSchema } from '../../schemas/group-membership';
import { validateUpdate } from '../../schemas';

// Import types
import type { UserDocument, GroupDocument, ExpenseDocument, SettlementDocument } from '../../schemas';
import type { UserNotificationGroup, CreateUserNotificationDocument } from '../../schemas/user-notifications';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ShareLink } from '@splitifyd/shared';
import type { IFirestoreWriter, WriteResult, BatchWriteResult, TransactionOptions } from './IFirestoreWriter';

/**
 * Transaction error classification for monitoring and retry decisions
 */
type TransactionErrorType = 'concurrency' | 'timeout' | 'aborted' | 'not_found' | 'permission' | 'other';

/**
 * Individual transaction retry attempt metric for detailed monitoring
 */
interface TransactionRetryMetric {
    attempt: number;
    duration: number;
    errorType: TransactionErrorType;
    errorMessage: string;
    retryDelay: number;
}

export class FirestoreWriter implements IFirestoreWriter {
    constructor(private readonly db: Firestore) {}

    // ========================================================================
    // Private Validation Helper Methods
    // ========================================================================

    /**
     * Safely validate merged data, handling FieldValue operations gracefully
     */
    private safeValidateUpdate<T>(schema: any, mergedData: Record<string, any>, schemaName: string, documentId: string, collection: string): { isValid: boolean; data?: T; skipValidation?: boolean } {
        try {
            const validatedData = this.validateMergedData<T>(schema, mergedData, schemaName, documentId, collection);
            return { isValid: true, data: validatedData };
        } catch (error) {
            // Check if error is due to FieldValue operations
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('FieldValue') || errorMessage.includes('Transform')) {
                logger.info('Validation skipped due to FieldValue operations', {
                    documentId,
                    collection,
                    schema: schemaName,
                });
                return { isValid: true, skipValidation: true };
            }
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

        // Merge updates with existing data
        const mergedData = {
            ...existingData,
            ...updates,
            id: documentId, // Ensure ID is present for validation
            updatedAt: FieldValue.serverTimestamp(), // Will be replaced during validation
        };

        return mergedData;
    }

    /**
     * Validate merged document data using the appropriate schema
     */
    private validateMergedData<T>(schema: any, mergedData: Record<string, any>, schemaName: string, documentId: string, collection: string): T {
        // For validation, replace FieldValue.serverTimestamp() with current timestamp
        const dataForValidation = { ...mergedData };
        if (dataForValidation.updatedAt && typeof dataForValidation.updatedAt === 'object') {
            dataForValidation.updatedAt = new Date();
        }
        if (dataForValidation.createdAt && typeof dataForValidation.createdAt === 'object') {
            dataForValidation.createdAt = new Date();
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
        const schemaMap = {
            [FirestoreCollections.USERS]: UserDocumentSchema,
            [FirestoreCollections.GROUPS]: GroupDocumentSchema,
            [FirestoreCollections.EXPENSES]: ExpenseDocumentSchema,
            [FirestoreCollections.SETTLEMENTS]: SettlementDocumentSchema,
            [FirestoreCollections.POLICIES]: PolicyDocumentSchema,
            [FirestoreCollections.COMMENTS]: CommentDataSchema,
            [FirestoreCollections.GROUP_MEMBERSHIPS]: TopLevelGroupMemberSchema,
            [FirestoreCollections.USER_NOTIFICATIONS]: UserNotificationDocumentSchema,
            [FirestoreCollections.TRANSACTION_CHANGES]: TransactionChangeDocumentSchema,
            [FirestoreCollections.BALANCE_CHANGES]: BalanceChangeDocumentSchema,
        };

        const schema = schemaMap[collection as keyof typeof schemaMap];
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
        return (
            value.constructor?.name?.includes('Transform') ||
            value.operand !== undefined ||
            value._delegate?.type !== undefined ||
            (typeof value.isEqual === 'function')
        );
    }

    /**
     * Validate transaction data using selective field validation
     * Only validates fields that aren't FieldValue operations
     */
    private validateTransactionData(collection: string, data: any, documentId: string): {
        isValid: boolean;
        skipValidation?: boolean;
        validatedFields?: Record<string, any>;
        skippedFields?: string[];
    } {
        const schema = this.getSchemaForCollection(collection);
        if (!schema) {
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

            logger.info('Transaction validation completed (partial)', {
                collection,
                documentId,
                validatedFieldCount: Object.keys(validatedFields).length,
                skippedFieldCount: skippedFields.length,
                validatedFields: Object.keys(validatedFields),
                skippedFields,
                operation: 'validateTransactionData',
            });

            return {
                isValid: true,
                validatedFields,
                skippedFields: skippedFields.length > 0 ? skippedFields : undefined
            };
        } catch (error) {
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

    async createUser(userId: string, userData: Omit<UserDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createUser', async () => {
            try {
                // Validate data before writing
                const validatedData = UserDocumentSchema.parse({
                    id: userId,
                    ...userData,
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
                    timestamp: new Date() as any,
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

    async updateUser(userId: string, updates: Partial<Omit<UserDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUser', async () => {
            try {
                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${FirestoreCollections.USERS}/${userId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, userId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<UserDocument>(UserDocumentSchema, mergedData, 'UserDocument', userId, FirestoreCollections.USERS);

                // Perform the update
                await this.db.collection(FirestoreCollections.USERS).doc(userId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`User document updated ${logType}`, { userId, fields: Object.keys(updates) });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
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

    async deleteUser(userId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteUser', async () => {
            try {
                await this.db.collection(FirestoreCollections.USERS).doc(userId).delete();

                logger.info('User document deleted', { userId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete user document', error, { userId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    async createGroup(groupData: Omit<GroupDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createGroup', async () => {
            try {
                // Create document reference to get ID
                const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc();

                // Validate data with generated ID
                const validatedData = GroupDocumentSchema.parse({
                    id: groupRef.id,
                    ...groupData,
                });

                // Remove id from data to write
                const { id, ...dataToWrite } = validatedData;

                // Add server timestamps
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await groupRef.set(finalData);

                logger.info('Group document created', { groupId: groupRef.id });

                return {
                    id: groupRef.id,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to create group document', error);
                return {
                    id: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async updateGroup(groupId: string, updates: Partial<Omit<GroupDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateGroup', async () => {
            try {
                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, groupId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<GroupDocument>(GroupDocumentSchema, mergedData, 'GroupDocument', groupId, FirestoreCollections.GROUPS);

                // Perform the update
                await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`Group document updated ${logType}`, { groupId, fields: Object.keys(updates) });

                return {
                    id: groupId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update group document', error, { groupId, updates: Object.keys(updates) });
                return {
                    id: groupId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async deleteGroup(groupId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteGroup', async () => {
            try {
                // Note: This only deletes the group document
                // Subcollections (members, etc.) should be deleted separately
                // Consider using a transaction or batch delete for complete cleanup

                await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).delete();

                logger.info('Group document deleted', { groupId });

                return {
                    id: groupId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete group document', error, { groupId });
                return {
                    id: groupId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Expense Write Operations
    // ========================================================================

    async createExpense(expenseData: Omit<ExpenseDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createExpense', async () => {
            try {
                // Create document reference to get ID
                const expenseRef = this.db.collection(FirestoreCollections.EXPENSES).doc();

                // Validate data with generated ID
                const validatedData = ExpenseDocumentSchema.parse({
                    id: expenseRef.id,
                    ...expenseData,
                });

                // Remove id from data to write
                const { id, ...dataToWrite } = validatedData;

                // Add server timestamps
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await expenseRef.set(finalData);

                logger.info('Expense document created', {
                    expenseId: expenseRef.id,
                    groupId: expenseData.groupId,
                });

                return {
                    id: expenseRef.id,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to create expense document', error);
                return {
                    id: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async updateExpense(expenseId: string, updates: Partial<Omit<ExpenseDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateExpense', async () => {
            try {
                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${FirestoreCollections.EXPENSES}/${expenseId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, expenseId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<ExpenseDocument>(ExpenseDocumentSchema, mergedData, 'ExpenseDocument', expenseId, FirestoreCollections.EXPENSES);

                // Perform the update
                await this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`Expense document updated ${logType}`, { expenseId, fields: Object.keys(updates) });

                return {
                    id: expenseId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update expense document', error, { expenseId, updates: Object.keys(updates) });
                return {
                    id: expenseId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async deleteExpense(expenseId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteExpense', async () => {
            try {
                await this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId).delete();

                logger.info('Expense document deleted', { expenseId });

                return {
                    id: expenseId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete expense document', error, { expenseId });
                return {
                    id: expenseId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Settlement Write Operations
    // ========================================================================

    async createSettlement(settlementData: Omit<SettlementDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createSettlement', async () => {
            try {
                // Create document reference to get ID
                const settlementRef = this.db.collection(FirestoreCollections.SETTLEMENTS).doc();

                // Validate data with generated ID
                const validatedData = SettlementDocumentSchema.parse({
                    id: settlementRef.id,
                    ...settlementData,
                });

                // Remove id from data to write
                const { id, ...dataToWrite } = validatedData;

                // Add server timestamps
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await settlementRef.set(finalData);

                logger.info('Settlement document created', {
                    settlementId: settlementRef.id,
                    groupId: settlementData.groupId,
                });

                return {
                    id: settlementRef.id,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to create settlement document', error);
                return {
                    id: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async updateSettlement(settlementId: string, updates: Partial<Omit<SettlementDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateSettlement', async () => {
            try {
                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, settlementId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<SettlementDocument>(SettlementDocumentSchema, mergedData, 'SettlementDocument', settlementId, FirestoreCollections.SETTLEMENTS);

                // Perform the update
                await this.db.collection(FirestoreCollections.SETTLEMENTS).doc(settlementId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`Settlement document updated ${logType}`, { settlementId, fields: Object.keys(updates) });

                return {
                    id: settlementId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update settlement document', error, { settlementId, updates: Object.keys(updates) });
                return {
                    id: settlementId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async deleteSettlement(settlementId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteSettlement', async () => {
            try {
                await this.db.collection(FirestoreCollections.SETTLEMENTS).doc(settlementId).delete();

                logger.info('Settlement document deleted', { settlementId });

                return {
                    id: settlementId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete settlement document', error, { settlementId });
                return {
                    id: settlementId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    // ========================================================================
    // Comment Write Operations
    // ========================================================================

    async addComment(targetType: CommentTargetType, targetId: string, commentData: Omit<CommentDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.addComment', async () => {
            try {
                // Get collection path using helper method to eliminate type-dispatching
                const collectionPath = this.getCommentCollectionPath(targetType, targetId);

                // Create comment reference
                const commentRef = this.db.collection(collectionPath).doc();

                // Validate comment data
                const validatedData = CommentDataSchema.parse(commentData);

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
                    timestamp: new Date() as any,
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

    async updateComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string, updates: Partial<Omit<CommentDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateComment', async () => {
            try {
                const collection = targetType === 'expense' ? FirestoreCollections.EXPENSES : FirestoreCollections.SETTLEMENTS;

                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `${collection}/${targetId}/comments/${commentId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, commentId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<CommentDocument>(CommentDataSchema, mergedData, 'CommentDocument', commentId, 'comments');

                // Perform the update
                await this.db.collection(collection).doc(targetId).collection('comments').doc(commentId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`Comment updated ${logType}`, { targetType, targetId, commentId });

                return {
                    id: commentId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update comment', error, { targetType, targetId, commentId, updates: Object.keys(updates) });
                return {
                    id: commentId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async deleteComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteComment', async () => {
            try {
                const collection = targetType === 'expense' ? FirestoreCollections.EXPENSES : FirestoreCollections.SETTLEMENTS;

                await this.db.collection(collection).doc(targetId).collection('comments').doc(commentId).delete();

                logger.info('Comment deleted', { targetType, targetId, commentId });

                return {
                    id: commentId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete comment', error, { targetType, targetId, commentId });
                return {
                    id: commentId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }


    // ========================================================================
    // Transaction Operations
    // ========================================================================

    async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
        const { maxAttempts = 3, baseDelayMs = 100, context = {} } = options;
        const operationName = context.operation || 'transaction';

        // WARNING: Transaction operations cannot be automatically validated
        logger.warn('Transaction operation started - ensure manual validation of all writes', {
            operation: operationName,
            recommendation: 'Validate all document changes within transaction using schemas',
        });

        return measureDb(operationName, async () => {
            let attempts = 0;
            let retryDelayTotal = 0;
            const retryMetrics: TransactionRetryMetric[] = [];

            while (attempts < maxAttempts) {
                const attemptStartTime = Date.now();

                try {
                    const result = await this.db.runTransaction(updateFunction);
                    const totalDuration = Date.now() - attemptStartTime + retryDelayTotal;

                    // Log transaction completion metrics if there were retries
                    if (attempts > 0) {
                        logger.info('Transaction completed after retries', {
                            ...context,
                            operation: operationName,
                            totalAttempts: attempts + 1,
                            totalDuration,
                            retryDelayTotal,
                            retryPattern: retryMetrics.map((m) => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                delay: m.retryDelay,
                                errorType: m.errorType,
                            })),
                        });
                    }

                    return result;
                } catch (error) {
                    attempts++;
                    const attemptDuration = Date.now() - attemptStartTime;

                    // Classify the error type for better monitoring
                    const errorType = this.classifyTransactionError(error);
                    const isTransactionError = errorType !== 'other';

                    // Record retry attempt metric
                    retryMetrics.push({
                        attempt: attempts,
                        duration: attemptDuration,
                        errorType,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        retryDelay: 0, // Will be set below if we retry
                    });

                    if (isTransactionError && attempts < maxAttempts) {
                        // Exponential backoff with jitter
                        const delayMs = baseDelayMs * Math.pow(2, attempts - 1) + Math.random() * 50;
                        retryDelayTotal += delayMs;

                        // Update the retry metric with the delay
                        retryMetrics[retryMetrics.length - 1].retryDelay = delayMs;

                        logger.warn(`Transaction retry attempt ${attempts}/${maxAttempts}`, {
                            ...context,
                            operation: operationName,
                            attempt: attempts,
                            maxAttempts,
                            delayMs: Math.round(delayMs),
                            totalRetryDelay: retryDelayTotal,
                            errorType,
                            error: error instanceof Error ? error.message : String(error),
                        });

                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        continue;
                    }

                    // Record failed transaction metrics
                    const totalDuration = Date.now() - attemptStartTime + retryDelayTotal;

                    // Log final failure if we're out of retries
                    if (isTransactionError && attempts >= maxAttempts) {
                        logger.error(`Transaction failed after ${maxAttempts} attempts`, {
                            ...context,
                            operation: operationName,
                            totalAttempts: attempts,
                            totalDuration,
                            totalRetryDelay: retryDelayTotal,
                            errorType,
                            error: error instanceof Error ? error.message : String(error),
                            retryPattern: retryMetrics.map((m) => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                errorType: m.errorType,
                                delay: m.retryDelay,
                            })),
                            recommendation: this.getRetryRecommendation(errorType, retryMetrics),
                        });
                    }

                    throw error; // Re-throw if not retryable or max attempts reached
                }
            }

            throw new Error('Transaction retry loop exited unexpectedly');
        });
    }

    createInTransaction(transaction: Transaction, collection: string, documentId: string | null, data: any): DocumentReference {
        const docRef = documentId ? this.db.collection(collection).doc(documentId) : this.db.collection(collection).doc();

        const finalData = {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Apply selective validation for transaction data
        const validationResult = this.validateTransactionData(collection, finalData, docRef.id);
        const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(partial validation)';

        logger.info(`Document created in transaction ${logType}`, {
            collection,
            documentId: docRef.id,
            validatedFields: validationResult.validatedFields ? Object.keys(validationResult.validatedFields) : [],
            skippedFields: validationResult.skippedFields || [],
        });

        transaction.set(docRef, finalData);

        return docRef;
    }

    updateInTransaction(transaction: Transaction, documentPath: string, updates: any): void {
        const docRef = this.db.doc(documentPath);
        const finalUpdates = {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Extract collection from document path for validation
        const collection = documentPath.split('/')[0];

        // Apply selective validation for transaction data
        const validationResult = this.validateTransactionData(collection, finalUpdates, docRef.id);
        const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(partial validation)';

        logger.info(`Document updated in transaction ${logType}`, {
            collection,
            documentPath,
            validatedFields: validationResult.validatedFields ? Object.keys(validationResult.validatedFields) : [],
            skippedFields: validationResult.skippedFields || [],
        });

        transaction.update(docRef, finalUpdates);
    }

    deleteInTransaction(transaction: Transaction, documentPath: string): void {
        const docRef = this.db.doc(documentPath);
        transaction.delete(docRef);
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
                    timestamp: new Date() as any,
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

    async removeUserNotificationGroup(userId: string, groupId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.removeUserNotificationGroup', async () => {
            try {
                const updates = {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                };

                // ⚠️ UserNotifications removal validation: SKIPPED due to FieldValue operations
                logger.warn('⚠️ UserNotifications removal validation: SKIPPED', {
                    userId,
                    groupId,
                    reason: 'Only FieldValue operations (delete, increment, serverTimestamp)',
                });

                await this.db.doc(`user-notifications/${userId}`).update(updates);

                logger.info('User notification group removed (FieldValue operations)', { userId, groupId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                // If the document doesn't exist, consider the removal successful (idempotent)
                if (error instanceof Error && error.message.includes('NOT_FOUND')) {
                    logger.info('User notification document not found - removal considered successful', { userId, groupId });
                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any,
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

    /**
     * Set user notifications with merge option
     * @param userId - The user ID
     * @param data - The notification data
     * @param merge - Whether to merge with existing data
     * @returns Write result
     */
    async setUserNotifications(userId: string, data: any, merge?: boolean): Promise<WriteResult> {
        return measureDb('FirestoreWriter.setUserNotifications', async () => {
            try {
                const finalData = {
                    ...data,
                    lastModified: FieldValue.serverTimestamp(),
                };

                // Validate the data being set (for non-merge operations or when merge=false)
                let skipValidation = false;
                if (!merge) {
                    // Full document set - validate the entire document
                    const result = this.safeValidateUpdate<CreateUserNotificationDocument>(UserNotificationDocumentSchema, finalData, 'UserNotificationDocument', userId, 'user-notifications');
                    skipValidation = Boolean(result.skipValidation);
                } else {
                    // Merge operation with FieldValue - log as unvalidated but proceed
                    logger.warn('User notification set with merge=true - validation skipped due to FieldValue operations', {
                        userId,
                        operation: 'setUserNotifications',
                        merge: true,
                        fields: Object.keys(data),
                    });
                    skipValidation = true;
                }

                await this.db.doc(`user-notifications/${userId}`).set(finalData, { merge: merge || false });

                const logType = skipValidation ? '(merge operation)' : '(validated)';
                logger.info(`User notifications set ${logType}`, { userId, merge, fields: Object.keys(data) });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to set user notifications', error, { userId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
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
    createShareLinkInTransaction(transaction: Transaction, groupId: string, shareLinkData: Omit<ShareLink, 'id'>): DocumentReference {
        const shareLinksCollection = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks');

        const shareLinkRef = shareLinksCollection.doc();

        // ShareLink data already validated - don't override timestamps
        const finalData = {
            ...shareLinkData,
            id: shareLinkRef.id,
        };

        transaction.create(shareLinkRef, finalData);

        logger.info('Share link created in transaction', {
            groupId,
            shareLinkId: shareLinkRef.id,
        });

        return shareLinkRef;
    }

    // ========================================================================
    // Member Operations in Transactions
    // ========================================================================

    /**
     * Update a group within a transaction
     * @param transaction - The transaction object
     * @param groupId - The group ID
     * @param updates - The update data
     */
    updateGroupInTransaction(transaction: Transaction, groupId: string, updates: any): void {
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);

        const finalUpdates = {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        };

        // Apply selective validation for group updates in transaction
        const validationResult = this.validateTransactionData(FirestoreCollections.GROUPS, finalUpdates, groupId);
        const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(partial validation)';

        logger.info(`Group updated in transaction ${logType}`, {
            groupId,
            validatedFields: validationResult.validatedFields ? Object.keys(validationResult.validatedFields) : [],
            skippedFields: validationResult.skippedFields || [],
        });

        transaction.update(groupRef, finalUpdates);
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

                const finalData = {
                    ...policyData,
                    id: policyRef.id,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Validate policy document before writing
                const validatedData = PolicyDocumentSchema.parse(finalData);

                await policyRef.set(validatedData);

                logger.info('Policy document created (validated)', { policyId: policyRef.id });

                return {
                    id: policyRef.id,
                    success: true,
                    timestamp: new Date() as any,
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
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                // Always try validation first, handle FieldValue operations gracefully
                const documentPath = `policies/${policyId}`;
                const mergedData = await this.fetchAndMergeForValidation(documentPath, finalUpdates, policyId);

                // Validate with graceful FieldValue handling
                const validationResult = this.safeValidateUpdate<any>(PolicyDocumentSchema, mergedData, 'PolicyDocument', policyId, 'policies');

                await this.db.collection('policies').doc(policyId).update(finalUpdates);

                const logType = validationResult.skipValidation ? '(FieldValue operations)' : '(validated)';
                logger.info(`Policy document updated ${logType}`, { policyId, fields: Object.keys(updates) });

                return {
                    id: policyId,
                    success: true,
                    timestamp: new Date() as any,
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
     * Classify transaction errors for better monitoring and retry decisions
     */
    private classifyTransactionError(error: any): TransactionErrorType {
        if (!(error instanceof Error)) {
            return 'other';
        }

        const message = error.message.toLowerCase();

        // Handle specific Firebase emulator error that occurs during concurrent updates
        if (message.includes('transaction is invalid or closed')) {
            return 'concurrency';
        }
        if (message.includes('concurrent') || message.includes('contention') || message.includes('conflict')) {
            return 'concurrency';
        }
        if (message.includes('timeout') || message.includes('deadline')) {
            return 'timeout';
        }
        if (message.includes('aborted') || message.includes('transaction was aborted')) {
            return 'aborted';
        }
        if (message.includes('not found')) {
            return 'not_found';
        }
        if (message.includes('permission') || message.includes('unauthorized')) {
            return 'permission';
        }

        // Check error codes as well
        if ((error as any).code === 'ABORTED' || (error as any).code === 'FAILED_PRECONDITION' || (error as any).code === 10) {
            return 'concurrency';
        }

        return 'other';
    }

    /**
     * Get recommendation based on error patterns for monitoring insights
     */
    private getRetryRecommendation(errorType: TransactionErrorType, retryMetrics: TransactionRetryMetric[]): string {
        const avgDuration = retryMetrics.reduce((sum, m) => sum + m.duration, 0) / retryMetrics.length;

        switch (errorType) {
            case 'concurrency':
                return avgDuration > 1000 ? 'Consider optimistic locking or reducing transaction scope' : 'Normal concurrency - consider increasing retry attempts';
            case 'timeout':
                return avgDuration > 2000 ? 'Transaction too slow - optimize queries or reduce scope' : 'Increase timeout or reduce concurrent load';
            case 'aborted':
                return 'Check for data consistency issues or conflicting operations';
            default:
                return 'Review error details and consider alternative approach';
        }
    }


    /**
     * Perform health check operations (lightweight connectivity check)
     * @returns Health check result with timing information
     */
    async performHealthCheck(): Promise<{ success: boolean; responseTime: number }> {
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
    async createTestPoolUser(email: string, userData: {
        email: string;
        token: string;
        password: string;
        status: 'available' | 'borrowed';
    }): Promise<WriteResult> {
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
                    timestamp: new Date() as any,
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
    async updateTestPoolUser(email: string, updates: { status?: 'available' | 'borrowed' }): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTestPoolUser', async () => {
            try {
                await this.db.collection('test-user-pool').doc(email).update(updates);

                logger.info('Test pool user updated', { email, updates });

                return {
                    id: email,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update test pool user', error, { email });
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
    bulkDeleteInTransaction(transaction: Transaction, documentPaths: string[]): void {
        if (!Array.isArray(documentPaths)) {
            throw new Error('documentPaths must be an array');
        }

        if (documentPaths.length === 0) {
            logger.warn('bulkDeleteInTransaction called with empty paths array');
            return;
        }

        logger.info('Bulk delete in transaction initiated', {
            operation: 'bulkDeleteInTransaction',
            documentCount: documentPaths.length,
        });

        for (const path of documentPaths) {
            if (!path || typeof path !== 'string') {
                throw new Error(`Invalid document path: ${path}`);
            }

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

        logger.info('Bulk delete in transaction completed', {
            operation: 'bulkDeleteInTransaction',
            documentCount: documentPaths.length,
        });
    }


    // ========================================================================
    // Group Deletion and Recovery Operations
    // ========================================================================

    /**
     * Get a document reference within a transaction for complex operations
     */
    getDocumentReferenceInTransaction(transaction: Transaction, collection: string, documentId: string): FirebaseFirestore.DocumentReference {
        return this.db.collection(collection).doc(documentId);
    }


    async deleteMemberAndNotifications(membershipDocId: string, userId: string, groupId: string): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.deleteMemberAndNotifications', async () => {
            try {
                const batch = this.db.batch();

                // Update group timestamp to trigger group change notifications for remaining members
                const groupRef = this.db.doc(`${FirestoreCollections.GROUPS}/${groupId}`);
                batch.update(groupRef, {
                    updatedAt: FieldValue.serverTimestamp(),
                });

                // Delete membership document
                const membershipRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${membershipDocId}`);
                batch.delete(membershipRef);

                // Remove group from user's notification document
                const notificationRef = this.db.doc(`user-notifications/${userId}`);
                const notificationUpdates = {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                };
                batch.update(notificationRef, notificationUpdates);

                await batch.commit();

                logger.info('Group, member, and notification updated atomically', {
                    userId,
                    groupId,
                    membershipDocId,
                });

                return {
                    successCount: 3, // group update + membership deletion + notification removal
                    failureCount: 0,
                    results: [
                        { id: `group-${groupId}`, success: true, timestamp: new Date() as any },
                        { id: membershipDocId, success: true, timestamp: new Date() as any },
                        { id: `user-notification-${userId}-${groupId}`, success: true, timestamp: new Date() as any },
                    ],
                };
            } catch (error) {
                logger.error('Atomic group, member, and notification update failed', error);
                return {
                    successCount: 0,
                    failureCount: 3,
                    results: [
                        {
                            id: `group-${groupId}`,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                        {
                            id: membershipDocId,
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

    async leaveGroupAtomic(groupId: string, userId: string): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.leaveGroupAtomic', async () => {
            try {
                // Generate membership document ID using helper function
                const membershipDocId = getTopLevelMembershipDocId(userId, groupId);

                const batch = this.db.batch();

                // Update group timestamp (triggers group change notifications for remaining members)
                const groupRef = this.db.doc(`${FirestoreCollections.GROUPS}/${groupId}`);
                batch.update(groupRef, {
                    updatedAt: FieldValue.serverTimestamp(),
                    lastModified: FieldValue.serverTimestamp(),
                });

                // Delete membership document
                const membershipRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${membershipDocId}`);
                batch.delete(membershipRef);

                // Clean up user's notification document in the same transaction
                const userNotificationRef = this.db.doc(`user-notifications/${userId}`);
                batch.update(userNotificationRef, {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                });

                await batch.commit();

                logger.info('User left group atomically - group updated, membership deleted, notifications cleaned up', {
                    userId,
                    groupId,
                    membershipDocId,
                });

                return {
                    successCount: 3, // group update + membership deletion + notification removal
                    failureCount: 0,
                    results: [
                        { id: groupId, success: true, timestamp: new Date() as any },
                        { id: membershipDocId, success: true, timestamp: new Date() as any },
                        { id: `user-notification-${userId}-${groupId}`, success: true, timestamp: new Date() as any },
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
