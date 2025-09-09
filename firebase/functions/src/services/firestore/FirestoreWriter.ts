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

import type { 
    Firestore, 
    Transaction, 
    WriteBatch, 
    DocumentReference
} from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../logger';
import { FirestoreCollections } from '@splitifyd/shared';
import type { ShareLink, GroupMemberDocument } from '@splitifyd/shared';
import { measureDb } from '../../monitoring/measure';

// Import schemas for validation
import {
    UserDocumentSchema,
    GroupDocumentSchema,
    ExpenseDocumentSchema,
    SettlementDocumentSchema,
    GroupMemberDocumentSchema,
    CommentDataSchema
} from '../../schemas';

// Import types
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { 
    IFirestoreWriter, 
    WriteResult, 
    BatchWriteResult,
    TransactionOptions
} from './IFirestoreWriter';

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
    // User Write Operations
    // ========================================================================

    async createUser(userId: string, userData: Omit<UserDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createUser', async () => {
            try {
                // Validate data before writing
                const validatedData = UserDocumentSchema.parse({ 
                    id: userId, 
                    ...userData 
                });

                // Remove id from data to write
                const { id, ...dataToWrite } = validatedData;

                // Add server timestamp
                const finalData = {
                    ...dataToWrite,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                };

                await this.db
                    .collection(FirestoreCollections.USERS)
                    .doc(userId)
                    .set(finalData);

                logger.info('User document created', { userId });

                return {
                    id: userId,
                    success: true,
                    timestamp: new Date() as any
                };
            } catch (error) {
                logger.error('Failed to create user document', error, { userId });
                return {
                    id: userId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
    }

    async updateUser(userId: string, updates: Partial<Omit<UserDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUser',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.USERS)
                        .doc(userId)
                        .update(finalUpdates);

                    logger.info('User document updated', { userId, fields: Object.keys(updates) });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update user document', error, { userId });
                    return {
                        id: userId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async deleteUser(userId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteUser',
            async () => {
                try {
                    await this.db
                        .collection(FirestoreCollections.USERS)
                        .doc(userId)
                        .delete();

                    logger.info('User document deleted', { userId });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to delete user document', error, { userId });
                    return {
                        id: userId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Group Write Operations
    // ========================================================================

    async createGroup(groupData: Omit<GroupDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createGroup',
            async () => {
                try {
                    // Create document reference to get ID
                    const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc();
                    
                    // Validate data with generated ID
                    const validatedData = GroupDocumentSchema.parse({ 
                        id: groupRef.id, 
                        ...groupData 
                    });

                    // Remove id from data to write
                    const { id, ...dataToWrite } = validatedData;

                    // Add server timestamps
                    const finalData = {
                        ...dataToWrite,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await groupRef.set(finalData);

                    logger.info('Group document created', { groupId: groupRef.id });

                    return {
                        id: groupRef.id,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to create group document', error);
                    return {
                        id: '',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updateGroup(groupId: string, updates: Partial<Omit<GroupDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateGroup',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.GROUPS)
                        .doc(groupId)
                        .update(finalUpdates);

                    logger.info('Group document updated', { groupId, fields: Object.keys(updates) });

                    return {
                        id: groupId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update group document', error, { groupId });
                    return {
                        id: groupId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async deleteGroup(groupId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteGroup',
            async () => {
                try {
                    // Note: This only deletes the group document
                    // Subcollections (members, etc.) should be deleted separately
                    // Consider using a transaction or batch delete for complete cleanup
                    
                    await this.db
                        .collection(FirestoreCollections.GROUPS)
                        .doc(groupId)
                        .delete();

                    logger.info('Group document deleted', { groupId });

                    return {
                        id: groupId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to delete group document', error, { groupId });
                    return {
                        id: groupId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Expense Write Operations
    // ========================================================================

    async createExpense(expenseData: Omit<ExpenseDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createExpense',
            async () => {
                try {
                    // Create document reference to get ID
                    const expenseRef = this.db.collection(FirestoreCollections.EXPENSES).doc();
                    
                    // Validate data with generated ID
                    const validatedData = ExpenseDocumentSchema.parse({ 
                        id: expenseRef.id, 
                        ...expenseData 
                    });

                    // Remove id from data to write
                    const { id, ...dataToWrite } = validatedData;

                    // Add server timestamps
                    const finalData = {
                        ...dataToWrite,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await expenseRef.set(finalData);

                    logger.info('Expense document created', { 
                        expenseId: expenseRef.id, 
                        groupId: expenseData.groupId 
                    });

                    return {
                        id: expenseRef.id,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to create expense document', error);
                    return {
                        id: '',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updateExpense(expenseId: string, updates: Partial<Omit<ExpenseDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateExpense',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.EXPENSES)
                        .doc(expenseId)
                        .update(finalUpdates);

                    logger.info('Expense document updated', { expenseId, fields: Object.keys(updates) });

                    return {
                        id: expenseId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update expense document', error, { expenseId });
                    return {
                        id: expenseId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async deleteExpense(expenseId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteExpense',
            async () => {
                try {
                    await this.db
                        .collection(FirestoreCollections.EXPENSES)
                        .doc(expenseId)
                        .delete();

                    logger.info('Expense document deleted', { expenseId });

                    return {
                        id: expenseId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to delete expense document', error, { expenseId });
                    return {
                        id: expenseId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Settlement Write Operations
    // ========================================================================

    async createSettlement(settlementData: Omit<SettlementDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createSettlement',
            async () => {
                try {
                    // Create document reference to get ID
                    const settlementRef = this.db.collection(FirestoreCollections.SETTLEMENTS).doc();
                    
                    // Validate data with generated ID
                    const validatedData = SettlementDocumentSchema.parse({ 
                        id: settlementRef.id, 
                        ...settlementData 
                    });

                    // Remove id from data to write
                    const { id, ...dataToWrite } = validatedData;

                    // Add server timestamps
                    const finalData = {
                        ...dataToWrite,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await settlementRef.set(finalData);

                    logger.info('Settlement document created', { 
                        settlementId: settlementRef.id, 
                        groupId: settlementData.groupId 
                    });

                    return {
                        id: settlementRef.id,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to create settlement document', error);
                    return {
                        id: '',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updateSettlement(settlementId: string, updates: Partial<Omit<SettlementDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateSettlement',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.SETTLEMENTS)
                        .doc(settlementId)
                        .update(finalUpdates);

                    logger.info('Settlement document updated', { settlementId, fields: Object.keys(updates) });

                    return {
                        id: settlementId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update settlement document', error, { settlementId });
                    return {
                        id: settlementId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async deleteSettlement(settlementId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteSettlement',
            async () => {
                try {
                    await this.db
                        .collection(FirestoreCollections.SETTLEMENTS)
                        .doc(settlementId)
                        .delete();

                    logger.info('Settlement document deleted', { settlementId });

                    return {
                        id: settlementId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to delete settlement document', error, { settlementId });
                    return {
                        id: settlementId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Member Write Operations (Subcollection)
    // ========================================================================

    async addGroupMember(groupId: string, userId: string, memberData: Omit<GroupMemberDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.addGroupMember',
            async () => {
                try {
                    // Validate member data
                    const validatedData = GroupMemberDocumentSchema.parse({ 
                        id: userId, 
                        ...memberData 
                    });

                    // Remove id from data to write
                    const { id, ...dataToWrite } = validatedData;

                    // Add timestamps
                    const finalData = {
                        ...dataToWrite,
                        joinedAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.GROUPS)
                        .doc(groupId)
                        .collection('members')
                        .doc(userId)
                        .set(finalData);

                    logger.info('Group member added', { groupId, userId });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to add group member', error, { groupId, userId });
                    return {
                        id: userId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updateGroupMember(groupId: string, userId: string, updates: Partial<Omit<GroupMemberDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateGroupMember',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db
                        .collection(FirestoreCollections.GROUPS)
                        .doc(groupId)
                        .collection('members')
                        .doc(userId)
                        .update(finalUpdates);

                    logger.info('Group member updated', { groupId, userId, fields: Object.keys(updates) });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update group member', error, { groupId, userId });
                    return {
                        id: userId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async removeGroupMember(groupId: string, userId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.removeGroupMember',
            async () => {
                try {
                    await this.db
                        .collection(FirestoreCollections.GROUPS)
                        .doc(groupId)
                        .collection('members')
                        .doc(userId)
                        .delete();

                    logger.info('Group member removed', { groupId, userId });

                    return {
                        id: userId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to remove group member', error, { groupId, userId });
                    return {
                        id: userId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Comment Write Operations
    // ========================================================================

    async addComment(targetType: 'expense' | 'settlement', targetId: string, commentData: Omit<CommentDocument, 'id'>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.addComment',
            async () => {
                try {
                    const collection = targetType === 'expense' 
                        ? FirestoreCollections.EXPENSES 
                        : FirestoreCollections.SETTLEMENTS;

                    // Create comment reference
                    const commentRef = this.db
                        .collection(collection)
                        .doc(targetId)
                        .collection('comments')
                        .doc();

                    // Validate comment data
                    const validatedData = CommentDataSchema.parse(commentData);

                    // Use validated data directly
                    const dataToWrite = validatedData;

                    // Add timestamp
                    const finalData = {
                        ...dataToWrite,
                        timestamp: FieldValue.serverTimestamp()
                    };

                    await commentRef.set(finalData);

                    logger.info('Comment added', { targetType, targetId, commentId: commentRef.id });

                    return {
                        id: commentRef.id,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to add comment', error, { targetType, targetId });
                    return {
                        id: '',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updateComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string, updates: Partial<Omit<CommentDocument, 'id'>>): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateComment',
            async () => {
                try {
                    const collection = targetType === 'expense' 
                        ? FirestoreCollections.EXPENSES 
                        : FirestoreCollections.SETTLEMENTS;

                    await this.db
                        .collection(collection)
                        .doc(targetId)
                        .collection('comments')
                        .doc(commentId)
                        .update(updates);

                    logger.info('Comment updated', { targetType, targetId, commentId });

                    return {
                        id: commentId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update comment', error, { targetType, targetId, commentId });
                    return {
                        id: commentId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async deleteComment(targetType: 'expense' | 'settlement', targetId: string, commentId: string): Promise<WriteResult> {
        return measureDb('FirestoreWriter.deleteComment',
            async () => {
                try {
                    const collection = targetType === 'expense' 
                        ? FirestoreCollections.EXPENSES 
                        : FirestoreCollections.SETTLEMENTS;

                    await this.db
                        .collection(collection)
                        .doc(targetId)
                        .collection('comments')
                        .doc(commentId)
                        .delete();

                    logger.info('Comment deleted', { targetType, targetId, commentId });

                    return {
                        id: commentId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to delete comment', error, { targetType, targetId, commentId });
                    return {
                        id: commentId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    async batchWrite(operations: (batch: WriteBatch) => void): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.batchWrite',
            async () => {
                try {
                    const batch = this.db.batch();
                    operations(batch);
                    
                    await batch.commit();

                    logger.info('Batch write completed successfully');

                    return {
                        successCount: 1, // We don't know exact count without tracking
                        failureCount: 0,
                        results: []
                    };
                } catch (error) {
                    logger.error('Batch write failed', error);
                    return {
                        successCount: 0,
                        failureCount: 1,
                        results: [{
                            id: '',
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }]
                    };
                }
            }
        );
    }

    async bulkCreate<T>(collection: string, documents: T[]): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkCreate',
            async () => {
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
                                updatedAt: FieldValue.serverTimestamp()
                            });
                            
                            results.push({
                                id: docRef.id,
                                success: true,
                                timestamp: new Date() as any
                            });
                            successCount++;
                        } catch (error) {
                            failureCount++;
                            results.push({
                                id: '',
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                    }

                    await batch.commit();
                    
                    logger.info('Bulk create completed', { 
                        collection, 
                        successCount, 
                        failureCount 
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
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }))
                    };
                }
            });
    }

    async bulkUpdate(updates: Map<string, any>): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkUpdate',
            async () => {
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
                                updatedAt: FieldValue.serverTimestamp()
                            });
                            
                            results.push({
                                id: path,
                                success: true,
                                timestamp: new Date() as any
                            });
                            successCount++;
                        } catch (error) {
                            failureCount++;
                            results.push({
                                id: path,
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                    }

                    await batch.commit();
                    
                    logger.info('Bulk update completed', { 
                        successCount, 
                        failureCount 
                    });

                    return { successCount, failureCount, results };
                } catch (error) {
                    logger.error('Bulk update failed', error);
                    return {
                        successCount: 0,
                        failureCount: updates.size,
                        results: Array.from(updates.keys()).map(path => ({
                            id: path,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }))
                    };
                }
            });
    }

    async bulkDelete(documentPaths: string[]): Promise<BatchWriteResult> {
        return measureDb('FirestoreWriter.bulkDelete',
            async () => {
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
                                timestamp: new Date() as any
                            });
                            successCount++;
                        } catch (error) {
                            failureCount++;
                            results.push({
                                id: path,
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                    }

                    await batch.commit();
                    
                    logger.info('Bulk delete completed', { 
                        successCount, 
                        failureCount 
                    });

                    return { successCount, failureCount, results };
                } catch (error) {
                    logger.error('Bulk delete failed', error);
                    return {
                        successCount: 0,
                        failureCount: documentPaths.length,
                        results: documentPaths.map(path => ({
                            id: path,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }))
                    };
                }
            });
    }

    // ========================================================================
    // Transaction Operations
    // ========================================================================

    async runTransaction<T>(
        updateFunction: (transaction: Transaction) => Promise<T>,
        options: TransactionOptions = {}
    ): Promise<T> {
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
                            retryPattern: retryMetrics.map(m => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                delay: m.retryDelay,
                                errorType: m.errorType
                            }))
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
                        retryDelay: 0 // Will be set below if we retry
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
                        
                        await new Promise(resolve => setTimeout(resolve, delayMs));
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
                            retryPattern: retryMetrics.map(m => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                errorType: m.errorType,
                                delay: m.retryDelay
                            })),
                            recommendation: this.getRetryRecommendation(errorType, retryMetrics)
                        });
                    }
                    
                    throw error; // Re-throw if not retryable or max attempts reached
                }
            }
            
            throw new Error('Transaction retry loop exited unexpectedly');
        });
    }

    createInTransaction(
        transaction: Transaction,
        collection: string,
        documentId: string | null,
        data: any
    ): DocumentReference {
        const docRef = documentId 
            ? this.db.collection(collection).doc(documentId)
            : this.db.collection(collection).doc();

        transaction.set(docRef, {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return docRef;
    }

    updateInTransaction(
        transaction: Transaction,
        documentPath: string,
        updates: any
    ): void {
        const docRef = this.db.doc(documentPath);
        transaction.update(docRef, {
            ...updates,
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    deleteInTransaction(
        transaction: Transaction,
        documentPath: string
    ): void {
        const docRef = this.db.doc(documentPath);
        transaction.delete(docRef);
    }

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    createShareLinkInTransaction(
        transaction: Transaction,
        groupId: string,
        shareLinkData: Omit<ShareLink, 'id'>
    ): DocumentReference {
        const shareLinksRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks');
        const shareLinkDoc = shareLinksRef.doc();
        
        transaction.set(shareLinkDoc, {
            ...shareLinkData,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        
        return shareLinkDoc;
    }

    // ========================================================================
    // Member Operations in Transactions
    // ========================================================================

    addGroupMemberInTransaction(
        transaction: Transaction,
        groupId: string,
        userId: string,
        memberData: Omit<GroupMemberDocument, 'id'>
    ): void {
        const memberRef = this.db
            .collection(FirestoreCollections.GROUPS)
            .doc(groupId)
            .collection('members')
            .doc(userId);

        transaction.set(memberRef, {
            ...memberData,
            id: userId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    updateGroupInTransaction(
        transaction: Transaction,
        groupId: string,
        updates: any
    ): void {
        const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
        transaction.update(groupRef, {
            ...updates,
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    // ========================================================================
    // Notification Operations
    // ========================================================================

    async updateUserNotifications(userId: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateUserNotifications',
            async () => {
                try {
                    const docPath = `user-notifications/${userId}`;
                    await this.db.doc(docPath).update(updates);

                    logger.info('User notifications updated', { userId, fields: Object.keys(updates) });

                    return {
                        id: docPath,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update user notifications', error, { userId });
                    return {
                        id: `user-notifications/${userId}`,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async setUserNotifications(userId: string, data: any, merge: boolean = false): Promise<WriteResult> {
        return measureDb('FirestoreWriter.setUserNotifications',
            async () => {
                try {
                    const docPath = `user-notifications/${userId}`;
                    const options = merge ? { merge: true } : {};
                    await this.db.doc(docPath).set(data, options);

                    logger.info('User notifications set', { userId, merge });

                    return {
                        id: docPath,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to set user notifications', error, { userId });
                    return {
                        id: `user-notifications/${userId}`,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Policy Operations
    // ========================================================================

    async createPolicy(policyId: string | null, policyData: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.createPolicy',
            async () => {
                try {
                    const docRef = policyId 
                        ? this.db.collection(FirestoreCollections.POLICIES).doc(policyId)
                        : this.db.collection(FirestoreCollections.POLICIES).doc();

                    const finalData = {
                        ...policyData,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await docRef.set(finalData);

                    logger.info('Policy created', { policyId: docRef.id });

                    return {
                        id: docRef.id,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to create policy', error, { policyId });
                    return {
                        id: policyId || 'unknown',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    async updatePolicy(policyId: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updatePolicy',
            async () => {
                try {
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db.collection(FirestoreCollections.POLICIES).doc(policyId).update(finalUpdates);

                    logger.info('Policy updated', { policyId, fields: Object.keys(updates) });

                    return {
                        id: policyId,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update policy', error, { policyId });
                    return {
                        id: policyId,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
    }

    // ========================================================================
    // Generic Document Operations
    // ========================================================================

    async updateDocument(documentPath: string, updates: any): Promise<WriteResult> {
        return measureDb('FirestoreWriter.updateDocument',
            async () => {
                try {
                    // Add updated timestamp
                    const finalUpdates = {
                        ...updates,
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    await this.db.doc(documentPath).update(finalUpdates);

                    logger.info('Document updated', { documentPath, fields: Object.keys(updates) });

                    return {
                        id: documentPath,
                        success: true,
                        timestamp: new Date() as any
                    };
                } catch (error) {
                    logger.error('Failed to update document', error, { documentPath });
                    return {
                        id: documentPath,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
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

    /**
     * Classify transaction errors for better monitoring and retry decisions
     */
    private classifyTransactionError(error: any): TransactionErrorType {
        if (!(error instanceof Error)) {
            return 'other';
        }
        
        const message = error.message.toLowerCase();
        
        if (message.includes('concurrent') || message.includes('contention')) {
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
        
        return 'other';
    }

    /**
     * Get recommendation based on error patterns for monitoring insights
     */
    private getRetryRecommendation(errorType: TransactionErrorType, retryMetrics: TransactionRetryMetric[]): string {
        const avgDuration = retryMetrics.reduce((sum, m) => sum + m.duration, 0) / retryMetrics.length;
        
        switch (errorType) {
            case 'concurrency':
                return avgDuration > 1000 ? 
                    'Consider optimistic locking or reducing transaction scope' :
                    'Normal concurrency - consider increasing retry attempts';
            case 'timeout':
                return avgDuration > 2000 ?
                    'Transaction too slow - optimize queries or reduce scope' :
                    'Increase timeout or reduce concurrent load';
            case 'aborted':
                return 'Check for data consistency issues or conflicting operations';
            default:
                return 'Review error details and consider alternative approach';
        }
    }

}