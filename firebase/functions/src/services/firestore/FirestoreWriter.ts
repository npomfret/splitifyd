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

import type { Firestore, Transaction, WriteBatch, DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../logger';
import { FirestoreCollections, CommentTargetTypes, type CommentTargetType } from '@splitifyd/shared';
import { getTopLevelMembershipDocId } from '../../utils/groupMembershipHelpers';
import { measureDb } from '../../monitoring/measure';

// Import schemas for validation
import { UserDocumentSchema, GroupDocumentSchema, ExpenseDocumentSchema, SettlementDocumentSchema, CommentDataSchema } from '../../schemas';
import { UserNotificationDocumentSchema, UserNotificationGroupSchema } from '../../schemas/user-notifications';

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

                await this.db.collection(FirestoreCollections.USERS).doc(userId).update(finalUpdates);

                logger.info('User document updated', { userId, fields: Object.keys(updates) });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update user document', error, { userId });
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

                await this.db.collection(FirestoreCollections.GROUPS).doc(groupId).update(finalUpdates);

                logger.info('Group document updated', { groupId, fields: Object.keys(updates) });

                return {
                    id: groupId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update group document', error, { groupId });
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

                await this.db.collection(FirestoreCollections.EXPENSES).doc(expenseId).update(finalUpdates);

                logger.info('Expense document updated', { expenseId, fields: Object.keys(updates) });

                return {
                    id: expenseId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update expense document', error, { expenseId });
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

                await this.db.collection(FirestoreCollections.SETTLEMENTS).doc(settlementId).update(finalUpdates);

                logger.info('Settlement document updated', { settlementId, fields: Object.keys(updates) });

                return {
                    id: settlementId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update settlement document', error, { settlementId });
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

                await this.db.collection(collection).doc(targetId).collection('comments').doc(commentId).update(updates);

                logger.info('Comment updated', { targetType, targetId, commentId });

                return {
                    id: commentId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update comment', error, { targetType, targetId, commentId });
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
    // Batch Operations
    // ========================================================================

    async batchWrite(operations: (batch: WriteBatch) => void): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.batchWrite', async () => {
            try {
                const batch = this.db.batch();
                operations(batch);

                await batch.commit();

                logger.info('Batch write completed successfully');

                return {
                    successCount: 1, // We don't know exact count without tracking
                    failureCount: 0,
                    results: [],
                };
            } catch (error) {
                logger.error('Batch write failed', error);
                return {
                    successCount: 0,
                    failureCount: 1,
                    results: [
                        {
                            id: '',
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                    ],
                };
            }
        });
    }

    async bulkCreate<T>(collection: string, documents: T[]): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkCreate', async () => {
            const batch = this.db.batch();
            const results: WriteResult[] = [];
            let successCount = 0;
            let failureCount = 0;

            try {
                for (const doc of documents) {
                    try {
                        const docRef = this.db.collection(collection).doc();
                        batch.set(docRef, {
                            ...doc,
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });

                        results.push({
                            id: docRef.id,
                            success: true,
                            timestamp: new Date() as any,
                        });
                        successCount++;
                    } catch (error) {
                        failureCount++;
                        results.push({
                            id: '',
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }

                await batch.commit();

                logger.info('Bulk create completed', {
                    collection,
                    successCount,
                    failureCount,
                });

                return { successCount, failureCount, results };
            } catch (error) {
                logger.error('Bulk create failed', error, { collection });
                return {
                    successCount: 0,
                    failureCount: documents.length,
                    results: documents.map(() => ({
                        id: '',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })),
                };
            }
        });
    }

    async bulkUpdate(updates: Map<string, any>): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkUpdate', async () => {
            const batch = this.db.batch();
            const results: WriteResult[] = [];
            let successCount = 0;
            let failureCount = 0;

            try {
                for (const [path, updateData] of updates) {
                    try {
                        const docRef = this.db.doc(path);
                        batch.update(docRef, {
                            ...updateData,
                            updatedAt: FieldValue.serverTimestamp(),
                        });

                        results.push({
                            id: path,
                            success: true,
                            timestamp: new Date() as any,
                        });
                        successCount++;
                    } catch (error) {
                        failureCount++;
                        results.push({
                            id: path,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }

                await batch.commit();

                logger.info('Bulk update completed', {
                    successCount,
                    failureCount,
                });

                return { successCount, failureCount, results };
            } catch (error) {
                logger.error('Bulk update failed', error);
                return {
                    successCount: 0,
                    failureCount: updates.size,
                    results: Array.from(updates.keys()).map((path) => ({
                        id: path,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })),
                };
            }
        });
    }

    async bulkDelete(documentPaths: string[]): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkDelete', async () => {
            const batch = this.db.batch();
            const results: WriteResult[] = [];
            let successCount = 0;
            let failureCount = 0;

            try {
                for (const path of documentPaths) {
                    try {
                        const docRef = this.db.doc(path);
                        batch.delete(docRef);

                        results.push({
                            id: path,
                            success: true,
                            timestamp: new Date() as any,
                        });
                        successCount++;
                    } catch (error) {
                        failureCount++;
                        results.push({
                            id: path,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }

                await batch.commit();

                logger.info('Bulk delete completed', {
                    successCount,
                    failureCount,
                });

                return { successCount, failureCount, results };
            } catch (error) {
                logger.error('Bulk delete failed', error);
                return {
                    successCount: 0,
                    failureCount: documentPaths.length,
                    results: documentPaths.map((path) => ({
                        id: path,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })),
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

        transaction.set(docRef, {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return docRef;
    }

    updateInTransaction(transaction: Transaction, documentPath: string, updates: any): void {
        const docRef = this.db.doc(documentPath);
        transaction.update(docRef, {
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    deleteInTransaction(transaction: Transaction, documentPath: string): void {
        const docRef = this.db.doc(documentPath);
        transaction.delete(docRef);
    }

    // ========================================================================
    // Generic Document Operations
    // ========================================================================

    async createDocument(documentPath: string, data: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createDocument', async () => {
            try {
                // Add timestamps
                const finalData = {
                    ...data,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await this.db.doc(documentPath).set(finalData);

                logger.info('Document created', { documentPath });

                return {
                    id: documentPath,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to create document', error, { documentPath });
                return {
                    id: documentPath,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async updateDocument(documentPath: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateDocument', async () => {
            try {
                // Add updated timestamp
                const finalUpdates = {
                    ...updates,
                    updatedAt: FieldValue.serverTimestamp(),
                };

                await this.db.doc(documentPath).update(finalUpdates);

                logger.info('Document updated', { documentPath, fields: Object.keys(updates) });

                return {
                    id: documentPath,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update document', error, { documentPath });
                return {
                    id: documentPath,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async deleteDocument(documentPath: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteDocument', async () => {
            try {
                await this.db.doc(documentPath).delete();

                logger.info('Document deleted', { documentPath });

                return {
                    id: documentPath,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to delete document', error, { documentPath });
                return {
                    id: documentPath,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
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

    async updateUserNotification(userId: string, updates: Record<string, any>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUserNotification', async () => {
            try {
                // Check if updates contain FieldValue operations (increment, serverTimestamp, etc.)
                const hasFieldValueOperations = Object.values(updates).some(
                    (value) =>
                        value &&
                        typeof value === 'object' &&
                        (value.constructor?.name === 'NumericIncrementTransform' || value.constructor?.name === 'ServerTimestampTransform' || value.operand !== undefined), // FieldValue.increment has operand property
                );

                if (hasFieldValueOperations) {
                    // For updates with FieldValue operations, use direct update()
                    // Cannot validate these as they contain transform objects, not final values
                    const finalUpdates = {
                        ...updates,
                        lastModified: FieldValue.serverTimestamp(),
                    };

                    await this.db.doc(`user-notifications/${userId}`).update(finalUpdates);

                    logger.info('User notification document updated', { userId, fields: Object.keys(updates) });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any,
                    };
                } else {
                    // For regular updates without FieldValue operations, use read-merge-validate-write
                    const docRef = this.db.doc(`user-notifications/${userId}`);
                    const docSnapshot = await docRef.get();

                    let existingData: any = {};
                    if (docSnapshot.exists) {
                        existingData = docSnapshot.data() || {};
                    }

                    // Merge updates with existing data
                    const mergedData = {
                        ...existingData,
                        ...updates,
                        lastModified: FieldValue.serverTimestamp(),
                    };

                    // Ensure all group entries have required count fields
                    if (mergedData.groups) {
                        for (const groupId in mergedData.groups) {
                            const group = mergedData.groups[groupId];
                            mergedData.groups[groupId] = {
                                lastTransactionChange: group.lastTransactionChange || null,
                                lastBalanceChange: group.lastBalanceChange || null,
                                lastGroupDetailsChange: group.lastGroupDetailsChange || null,
                                transactionChangeCount: group.transactionChangeCount ?? 0,
                                balanceChangeCount: group.balanceChangeCount ?? 0,
                                groupDetailsChangeCount: group.groupDetailsChangeCount ?? 0,
                            };
                        }
                    }

                    // Ensure required fields exist
                    const completeData = {
                        groups: {},
                        recentChanges: [],
                        changeVersion: 0,
                        ...mergedData,
                    };

                    // Validate the complete document (excluding FieldValue transforms)
                    const validatedData = UserNotificationDocumentSchema.parse(completeData);

                    // Write the complete validated document
                    await docRef.set(validatedData);

                    logger.info('User notification document updated', { userId, fields: Object.keys(updates) });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any,
                    };
                }
            } catch (error) {
                logger.error('Failed to update user notification document', error, { userId, updates });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    async setUserNotificationGroup(userId: string, groupId: string, groupData: UserNotificationGroup): Promise<WriteResult> {
        return measureDb('FirestoreWriter.setUserNotificationGroup', async () => {
            try {
                // Validate group data before writing
                const validatedGroupData = UserNotificationGroupSchema.parse(groupData);

                // Use dot notation to properly set nested group data with set() and merge: true
                // This ensures the document exists and all fields are properly set
                const updates: Record<string, any> = {
                    [`groups.${groupId}`]: {
                        lastTransactionChange: validatedGroupData.lastTransactionChange,
                        lastBalanceChange: validatedGroupData.lastBalanceChange,
                        lastGroupDetailsChange: validatedGroupData.lastGroupDetailsChange,
                        transactionChangeCount: validatedGroupData.transactionChangeCount,
                        balanceChangeCount: validatedGroupData.balanceChangeCount,
                        groupDetailsChangeCount: validatedGroupData.groupDetailsChangeCount,
                    },
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.doc(`user-notifications/${userId}`).set(updates, { merge: true });

                logger.info('User notification group updated', { userId, groupId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update user notification group', error, { userId, groupId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    setUserNotificationGroupInTransaction(transaction: Transaction, userId: string, groupId: string, groupData: UserNotificationGroup): void {
        try {
            // Validate group data before writing
            const validatedGroupData = UserNotificationGroupSchema.parse(groupData);

            const docRef = this.db.doc(`user-notifications/${userId}`);

            // First, ensure the base document exists with proper structure
            transaction.set(
                docRef,
                {
                    changeVersion: 0,
                    groups: {},
                    lastModified: FieldValue.serverTimestamp(),
                },
                { merge: true },
            );

            // Then update with the specific group data using dot notation (which requires update(), not set())
            const updates: Record<string, any> = {
                [`groups.${groupId}`]: {
                    lastTransactionChange: validatedGroupData.lastTransactionChange,
                    lastBalanceChange: validatedGroupData.lastBalanceChange,
                    lastGroupDetailsChange: validatedGroupData.lastGroupDetailsChange,
                    transactionChangeCount: validatedGroupData.transactionChangeCount,
                    balanceChangeCount: validatedGroupData.balanceChangeCount,
                    groupDetailsChangeCount: validatedGroupData.groupDetailsChangeCount,
                },
                lastModified: FieldValue.serverTimestamp(),
            };

            // Use update() for dot notation paths to work correctly
            transaction.update(docRef, updates);

            logger.info('User notification group updated in transaction', { userId, groupId });
        } catch (error) {
            logger.error('Failed to update user notification group in transaction', error, { userId, groupId });
            throw error;
        }
    }

    async removeUserNotificationGroup(userId: string, groupId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.removeUserNotificationGroup', async () => {
            try {
                const updates = {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.doc(`user-notifications/${userId}`).update(updates);

                logger.info('User notification group removed', { userId, groupId });

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

        transaction.update(groupRef, finalUpdates);

        logger.info('Group updated in transaction', {
            groupId,
            fields: Object.keys(updates),
        });
    }

    // ========================================================================
    // Notification Operations
    // ========================================================================

    /**
     * Update user notifications
     * @param userId - The user ID
     * @param updates - The notification updates
     * @returns Write result
     */
    async updateUserNotifications(userId: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUserNotifications', async () => {
            try {
                const finalUpdates = {
                    ...updates,
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.doc(`user-notifications/${userId}`).update(finalUpdates);

                logger.info('User notifications updated', { userId, fields: Object.keys(updates) });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update user notifications', error, { userId });
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

                await this.db.doc(`user-notifications/${userId}`).set(finalData, { merge: merge || false });

                logger.info('User notifications set', { userId, merge, fields: Object.keys(data) });

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

                await policyRef.set(finalData);

                logger.info('Policy document created', { policyId: policyRef.id });

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

                await this.db.collection('policies').doc(policyId).update(finalUpdates);

                logger.info('Policy document updated', { policyId, fields: Object.keys(updates) });

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

    // ========================================================================
    // System Operations Implementation
    // ========================================================================

    /**
     * Add system metrics document for monitoring
     * @param metricsData - The metrics data to store
     * @returns Write result with document ID
     */
    async addSystemMetrics(metricsData: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.addSystemMetrics', async () => {
            try {
                const finalData = {
                    ...metricsData,
                    createdAt: FieldValue.serverTimestamp(),
                };

                const docRef = await this.db.collection('system-metrics').add(finalData);

                logger.info('System metrics added', {
                    docId: docRef.id,
                    type: metricsData.type,
                    fields: Object.keys(metricsData),
                });

                return {
                    id: docRef.id,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to add system metrics', error, { metricsData });
                return {
                    id: '',
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    /**
     * Perform health check operations (test read/write)
     * @returns Health check result with timing information
     */
    async performHealthCheck(): Promise<{ success: boolean; responseTime: number }> {
        return measureDb('FirestoreWriter.performHealthCheck', async () => {
            const startTime = Date.now();

            try {
                const testRef = this.db.collection('_health_check').doc('test');

                // Test write
                await testRef.set({
                    timestamp: FieldValue.serverTimestamp(),
                    test: 'health-check',
                });

                // Test read to verify write succeeded
                const testDoc = await testRef.get();
                if (!testDoc.exists) {
                    throw new Error('Health check document not found after write');
                }

                // Clean up test document
                await testRef.delete();

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
    // Test User Pool Operations Implementation
    // ========================================================================

    /**
     * Create a test user in the user pool
     * @param email - Test user email
     * @param userData - Test user data including token and password
     * @returns Write result
     */
    async createTestUser(email: string, userData: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createTestUser', async () => {
            try {
                const finalData = {
                    ...userData,
                    createdAt: FieldValue.serverTimestamp(),
                };

                await this.db.collection('test-user-pool').doc(email).set(finalData);

                logger.info('Test user created in pool', {
                    email,
                    status: userData.status,
                    fields: Object.keys(userData),
                });

                return {
                    id: email,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to create test user', error, { email });
                return {
                    id: email,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        });
    }

    /**
     * Update test user status in the pool
     * @param email - Test user email
     * @param status - New status ('available' or 'borrowed')
     * @returns Write result
     */
    async updateTestUserStatus(email: string, status: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateTestUserStatus', async () => {
            try {
                const updates = {
                    status,
                    lastModified: FieldValue.serverTimestamp(),
                };

                await this.db.collection('test-user-pool').doc(email).update(updates);

                return {
                    id: email,
                    success: true,
                    timestamp: new Date() as any,
                };
            } catch (error) {
                logger.error('Failed to update test user status', error, { email, status });
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

    /**
     * Get multiple documents within a transaction by paths
     * @param transaction - The transaction context
     * @param documentPaths - Array of document paths to fetch
     * @returns Promise<Array<DocumentSnapshot | null>> Array of document snapshots (null for non-existent docs)
     */
    async getMultipleByPathsInTransaction(transaction: Transaction, documentPaths: string[]): Promise<Array<FirebaseFirestore.DocumentSnapshot | null>> {
        if (!Array.isArray(documentPaths)) {
            throw new Error('documentPaths must be an array');
        }

        if (documentPaths.length === 0) {
            return [];
        }

        logger.info('Getting multiple documents in transaction', {
            operation: 'getMultipleByPathsInTransaction',
            documentCount: documentPaths.length,
        });

        const results: Array<FirebaseFirestore.DocumentSnapshot | null> = [];

        for (const path of documentPaths) {
            if (!path || typeof path !== 'string') {
                throw new Error(`Invalid document path: ${path}`);
            }

            try {
                const docRef = this.db.doc(path);
                const doc = await transaction.get(docRef);
                results.push(doc.exists ? doc : null);
            } catch (error) {
                logger.error('Failed to get document in transaction', error, {
                    path,
                    operation: 'getMultipleByPathsInTransaction',
                });
                throw new Error(`Failed to get document at path: ${path}`);
            }
        }

        return results;
    }

    /**
     * Create multiple documents within a transaction atomically
     * @param transaction - The transaction context
     * @param creates - Array of documents to create
     * @returns Array of document references created
     */
    batchCreateInTransaction(
        transaction: Transaction,
        creates: Array<{
            collection: string;
            id?: string;
            data: any;
        }>,
    ): DocumentReference[] {
        if (!Array.isArray(creates)) {
            throw new Error('creates must be an array');
        }

        if (creates.length === 0) {
            logger.warn('batchCreateInTransaction called with empty creates array');
            return [];
        }

        logger.info('Batch create in transaction initiated', {
            operation: 'batchCreateInTransaction',
            documentCount: creates.length,
        });

        const docRefs: DocumentReference[] = [];

        for (const create of creates) {
            if (!create.collection || typeof create.collection !== 'string') {
                throw new Error(`Invalid collection name: ${create.collection}`);
            }

            if (!create.data || typeof create.data !== 'object') {
                throw new Error('Document data must be an object');
            }

            try {
                const docRef = create.id ? this.db.collection(create.collection).doc(create.id) : this.db.collection(create.collection).doc();

                transaction.create(docRef, create.data);
                docRefs.push(docRef);
            } catch (error) {
                logger.error('Failed to create document in transaction', error, {
                    create,
                    operation: 'batchCreateInTransaction',
                });
                throw new Error(`Failed to create document in collection: ${create.collection}`);
            }
        }

        logger.info('Batch create in transaction completed', {
            operation: 'batchCreateInTransaction',
            documentCount: docRefs.length,
        });

        return docRefs;
    }

    /**
     * Query and update multiple documents within a transaction
     * @param transaction - The transaction context
     * @param collectionPath - Collection to query
     * @param queryConstraints - Query constraints (where clauses)
     * @param updates - Updates to apply to all matched documents
     * @returns Promise<number> Number of documents updated
     */
    async queryAndUpdateInTransaction(
        transaction: Transaction,
        collectionPath: string,
        queryConstraints: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: any }>,
        updates: Record<string, any>,
    ): Promise<number> {
        if (!collectionPath || typeof collectionPath !== 'string') {
            throw new Error('collectionPath must be a non-empty string');
        }

        if (!Array.isArray(queryConstraints)) {
            throw new Error('queryConstraints must be an array');
        }

        if (!updates || typeof updates !== 'object') {
            throw new Error('updates must be an object');
        }

        logger.info('Query and update in transaction initiated', {
            operation: 'queryAndUpdateInTransaction',
            collection: collectionPath,
            constraintCount: queryConstraints.length,
        });

        try {
            // Start with the collection reference
            let query: FirebaseFirestore.Query = this.db.collection(collectionPath);

            // Apply all query constraints
            for (const constraint of queryConstraints) {
                if (!constraint.field || typeof constraint.field !== 'string') {
                    throw new Error(`Invalid field name: ${constraint.field}`);
                }
                query = query.where(constraint.field, constraint.op, constraint.value);
            }

            // Execute query within the transaction (reads must come before writes)
            const querySnapshot = await transaction.get(query);

            logger.info('Query executed in transaction', {
                operation: 'queryAndUpdateInTransaction',
                documentsFound: querySnapshot.size,
                collection: collectionPath,
            });

            // Update all matching documents
            querySnapshot.docs.forEach((doc) => {
                transaction.update(doc.ref, updates);
            });

            const updatedCount = querySnapshot.size;

            logger.info('Query and update in transaction completed', {
                operation: 'queryAndUpdateInTransaction',
                documentsUpdated: updatedCount,
                collection: collectionPath,
            });

            return updatedCount;
        } catch (error) {
            logger.error('Failed to query and update in transaction', error, {
                collection: collectionPath,
                operation: 'queryAndUpdateInTransaction',
            });
            throw new Error(`Failed to query and update documents in collection: ${collectionPath}`);
        }
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

    /**
     * Query groups by deletion status with timestamp filters
     */
    async queryGroupsByDeletionStatus(deletionStatus: string, cutoffTimestamp?: FirebaseFirestore.Timestamp, operator: FirebaseFirestore.WhereFilterOp = '<='): Promise<string[]> {
        try {
            logger.info('Querying groups by deletion status', {
                deletionStatus,
                cutoffTimestamp: cutoffTimestamp?.toDate(),
                operator,
                operation: 'queryGroupsByDeletionStatus',
            });

            let query = this.db.collection(FirestoreCollections.GROUPS).where('deletionStatus', '==', deletionStatus);

            if (cutoffTimestamp) {
                query = query.where('deletionStartedAt', operator, cutoffTimestamp);
            }

            const querySnapshot = await query.get();
            const groupIds = querySnapshot.docs.map((doc: any) => doc.id);

            logger.info('Groups deletion status query completed', {
                deletionStatus,
                foundCount: groupIds.length,
                groupIds,
                operation: 'queryGroupsByDeletionStatus',
            });

            return groupIds;
        } catch (error) {
            logger.error('Failed to query groups by deletion status', error, {
                deletionStatus,
                cutoffTimestamp: cutoffTimestamp?.toDate(),
                operator,
                operation: 'queryGroupsByDeletionStatus',
            });
            throw new Error(`Failed to query groups by deletion status: ${deletionStatus}`);
        }
    }

    /**
     * Get a single document by path (for non-transaction operations)
     */
    async getSingleDocument(collection: string, documentId: string): Promise<FirebaseFirestore.DocumentSnapshot | null> {
        try {
            logger.info('Getting single document', {
                collection,
                documentId,
                operation: 'getSingleDocument',
            });

            const docRef = this.db.collection(collection).doc(documentId);
            const docSnapshot = await docRef.get();

            if (!docSnapshot.exists) {
                logger.info('Document not found', {
                    collection,
                    documentId,
                    operation: 'getSingleDocument',
                });
                return null;
            }

            logger.info('Single document retrieved successfully', {
                collection,
                documentId,
                operation: 'getSingleDocument',
            });

            return docSnapshot;
        } catch (error) {
            logger.error('Failed to get single document', error, {
                collection,
                documentId,
                operation: 'getSingleDocument',
            });
            throw new Error(`Failed to get document: ${collection}/${documentId}`);
        }
    }

    async deleteMemberAndNotifications(membershipDocId: string, userId: string, groupId: string): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.deleteMemberAndNotifications', async () => {
            try {
                const batch = this.db.batch();

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

                logger.info('Member and notification tracking deleted atomically', {
                    userId,
                    groupId,
                    membershipDocId,
                });

                return {
                    successCount: 2, // membership deletion + notification removal
                    failureCount: 0,
                    results: [
                        { id: membershipDocId, success: true, timestamp: new Date() as any },
                        { id: `user-notification-${userId}-${groupId}`, success: true, timestamp: new Date() as any },
                    ],
                };
            } catch (error) {
                logger.error('Atomic member and notification deletion failed', error);
                return {
                    successCount: 0,
                    failureCount: 2,
                    results: [
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

                // Remove group from user's notification document
                const notificationRef = this.db.doc(`user-notifications/${userId}`);
                const notificationUpdates = {
                    [`groups.${groupId}`]: FieldValue.delete(),
                    changeVersion: FieldValue.increment(1),
                    lastModified: FieldValue.serverTimestamp(),
                };
                batch.update(notificationRef, notificationUpdates);

                // Delete membership document
                const membershipRef = this.db.doc(`${FirestoreCollections.GROUP_MEMBERSHIPS}/${membershipDocId}`);
                batch.delete(membershipRef);

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
