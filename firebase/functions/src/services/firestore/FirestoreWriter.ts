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
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { 
    IFirestoreWriter, 
    WriteResult, 
    BatchWriteResult 
} from './IFirestoreWriter';

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

    async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
        return measureDb('custom-transaction', async () => {
            return this.db.runTransaction(updateFunction);
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

}