/**
 * FirestoreReader Implementation - Simplified Version
 * 
 * Centralized service for all Firestore read operations with:
 * - Zod schema validation for type safety
 * - Consistent error handling and logging
 */

import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { firestoreDb } from '../../firebase';
import { logger } from '../../logger';
import { FirestoreCollections } from '@splitifyd/shared';

// Import all schemas for validation
import {
    UserDocumentSchema,
    GroupDocumentSchema,
    ExpenseDocumentSchema,
    SettlementDocumentSchema,
    PolicyDocumentSchema,
    CommentDocumentSchema,
    ShareLinkDocumentSchema
} from '../../schemas';

// Import types
import type {
    UserDocument,
    GroupDocument,  
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ParsedShareLink as ShareLinkDocument } from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { IFirestoreReader } from './IFirestoreReader';
import type {
    PaginationOptions,
    QueryOptions,
    GroupMemberQueryOptions,
    CommentTarget,
    GroupSubscriptionCallback,
    ExpenseListSubscriptionCallback,
    CommentListSubscriptionCallback,
    UnsubscribeFunction
} from '../../types/firestore-reader-types';

export class FirestoreReader implements IFirestoreReader {
    constructor(
        private readonly db: Firestore = firestoreDb
    ) {}

    // ========================================================================
    // Document Read Operations
    // ========================================================================

    async getUser(userId: string): Promise<UserDocument | null> {
        try {
            const userDoc = await this.db
                .collection(FirestoreCollections.USERS)
                .doc(userId)
                .get();

            if (!userDoc.exists) {
                return null;
            }

            const userData = UserDocumentSchema.parse({ 
                id: userDoc.id, 
                ...userDoc.data() 
            });

            return userData;
        } catch (error) {
            logger.error('Failed to get user', error, { userId });
            throw error;
        }
    }

    async getGroup(groupId: string): Promise<GroupDocument | null> {
        try {
            const groupDoc = await this.db
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .get();

            if (!groupDoc.exists) {
                return null;
            }

            const groupData = GroupDocumentSchema.parse({
                id: groupDoc.id, 
                ...groupDoc.data() 
            });

            return groupData;
        } catch (error) {
            logger.error('Failed to get group', error, { groupId });
            throw error;
        }
    }

    async getExpense(expenseId: string): Promise<ExpenseDocument | null> {
        try {
            const expenseDoc = await this.db
                .collection(FirestoreCollections.EXPENSES)
                .doc(expenseId)
                .get();

            if (!expenseDoc.exists) {
                return null;
            }

            const expenseData = ExpenseDocumentSchema.parse({
                id: expenseDoc.id, 
                ...expenseDoc.data() 
            });

            return expenseData;
        } catch (error) {
            logger.error('Failed to get expense', error, { expenseId });
            throw error;
        }
    }

    async getSettlement(settlementId: string): Promise<SettlementDocument | null> {
        try {
            const settlementDoc = await this.db
                .collection(FirestoreCollections.SETTLEMENTS)
                .doc(settlementId)
                .get();

            if (!settlementDoc.exists) {
                return null;
            }

            const settlementData = SettlementDocumentSchema.parse({
                id: settlementDoc.id, 
                ...settlementDoc.data() 
            });

            return settlementData;
        } catch (error) {
            logger.error('Failed to get settlement', error, { settlementId });
            throw error;
        }
    }

    async getPolicy(policyId: string): Promise<PolicyDocument | null> {
        try {
            const policyDoc = await this.db
                .collection(FirestoreCollections.POLICIES)
                .doc(policyId)
                .get();

            if (!policyDoc.exists) {
                return null;
            }

            const policyData = PolicyDocumentSchema.parse({
                id: policyDoc.id, 
                ...policyDoc.data() 
            });

            return policyData;
        } catch (error) {
            logger.error('Failed to get policy', error, { policyId });
            throw error;
        }
    }

    // ========================================================================
    // Collection Read Operations - Minimal Implementation
    // ========================================================================

    async getUsersById(userIds: string[]): Promise<UserDocument[]> {
        // TODO: Implement batch read
        const users: UserDocument[] = [];
        for (const userId of userIds) {
            const user = await this.getUser(userId);
            if (user) {
                users.push(user);
            }
        }
        return users;
    }

    async getUsersForGroup(groupId: string): Promise<UserDocument[]> {
        // TODO: Implement
        return [];
    }

    async getGroupsForUser(userId: string, options?: QueryOptions): Promise<GroupDocument[]> {
        try {
            let query = this.db.collection(FirestoreCollections.GROUPS)
                .where(`members.${userId}`, '!=', null);

            // Apply ordering
            if (options?.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('updatedAt', 'desc');
            }

            // Apply limit
            if (options?.limit) {
                query = query.limit(options.limit);
            }

            // Apply cursor for pagination
            if (options?.cursor) {
                // Decode cursor - basic implementation
                try {
                    const cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
                    query = query.startAfter(cursorData.updatedAt, cursorData.id);
                } catch (err) {
                    logger.warn('Invalid cursor provided, ignoring', { cursor: options.cursor });
                }
            }

            const snapshot = await query.get();
            const groups: GroupDocument[] = [];

            for (const doc of snapshot.docs) {
                try {
                    const groupData = GroupDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    groups.push(groupData);
                } catch (error) {
                    logger.error('Invalid group document in getGroupsForUser', {
                        error,
                        groupId: doc.id,
                        userId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return groups;
        } catch (error) {
            logger.error('Failed to get groups for user', { error, userId });
            throw error;
        }
    }

    async getGroupMembers(groupId: string, options?: GroupMemberQueryOptions): Promise<GroupMemberDocument[]> {
        // TODO: Implement
        return [];
    }

    async getExpensesForGroup(groupId: string, options?: QueryOptions): Promise<ExpenseDocument[]> {
        try {
            let query = this.db.collection(FirestoreCollections.EXPENSES)
                .where('groupId', '==', groupId);

            // Apply ordering  
            if (options?.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            // Apply limit
            if (options?.limit) {
                query = query.limit(options.limit);
            }

            // Apply cursor for pagination
            if (options?.cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
                    query = query.startAfter(cursorData.createdAt, cursorData.id);
                } catch (err) {
                    logger.warn('Invalid cursor provided, ignoring', { cursor: options.cursor });
                }
            }

            const snapshot = await query.get();
            const expenses: ExpenseDocument[] = [];

            for (const doc of snapshot.docs) {
                try {
                    const expenseData = ExpenseDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    expenses.push(expenseData);
                } catch (error) {
                    logger.error('Invalid expense document in getExpensesForGroup', {
                        error,
                        expenseId: doc.id,
                        groupId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return expenses;
        } catch (error) {
            logger.error('Failed to get expenses for group', { error, groupId });
            throw error;
        }
    }

    async getExpensesByUser(userId: string, options?: QueryOptions): Promise<ExpenseDocument[]> {
        // TODO: Implement
        return [];
    }

    async getSettlementsForGroup(groupId: string, options?: QueryOptions): Promise<SettlementDocument[]> {
        try {
            let query = this.db.collection(FirestoreCollections.SETTLEMENTS)
                .where('groupId', '==', groupId);

            // Apply ordering  
            if (options?.orderBy) {
                query = query.orderBy(options.orderBy.field, options.orderBy.direction);
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            // Apply limit
            if (options?.limit) {
                query = query.limit(options.limit);
            }

            // Apply cursor for pagination
            if (options?.cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
                    query = query.startAfter(cursorData.createdAt, cursorData.id);
                } catch (err) {
                    logger.warn('Invalid cursor provided, ignoring', { cursor: options.cursor });
                }
            }

            const snapshot = await query.get();
            const settlements: SettlementDocument[] = [];

            for (const doc of snapshot.docs) {
                try {
                    const settlementData = SettlementDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    settlements.push(settlementData);
                } catch (error) {
                    logger.error('Invalid settlement document in getSettlementsForGroup', {
                        error,
                        settlementId: doc.id,
                        groupId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return settlements;
        } catch (error) {
            logger.error('Failed to get settlements for group', { error, groupId });
            throw error;
        }
    }

    async getSettlementsForUser(userId: string, options?: QueryOptions): Promise<SettlementDocument[]> {
        // TODO: Implement
        return [];
    }

    async getCommentsForTarget(target: CommentTarget, options?: QueryOptions): Promise<CommentDocument[]> {
        // TODO: Implement
        return [];
    }

    async getActiveShareLinkByToken(token: string): Promise<ShareLinkDocument | null> {
        // TODO: Implement
        return null;
    }

    async getPolicyVersionsForUser(userId: string): Promise<PolicyDocument[]> {
        // TODO: Implement
        return [];
    }

    // ========================================================================
    // Transaction-aware Read Operations
    // ========================================================================

    async getGroupInTransaction(transaction: Transaction, groupId: string): Promise<GroupDocument | null> {
        try {
            const groupRef = this.db.collection(FirestoreCollections.GROUPS).doc(groupId);
            const groupDoc = await transaction.get(groupRef);

            if (!groupDoc.exists) {
                return null;
            }

            const groupData = GroupDocumentSchema.parse({
                id: groupDoc.id,
                ...groupDoc.data()
            });

            return groupData;
        } catch (error) {
            logger.error('Failed to get group in transaction', error, { groupId });
            throw error;
        }
    }

    async getUserInTransaction(transaction: Transaction, userId: string): Promise<UserDocument | null> {
        try {
            const userRef = this.db.collection(FirestoreCollections.USERS).doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                return null;
            }

            const userData = UserDocumentSchema.parse({
                id: userDoc.id,
                ...userDoc.data()
            });

            return userData;
        } catch (error) {
            logger.error('Failed to get user in transaction', error, { userId });
            throw error;
        }
    }

    async getMultipleInTransaction<T>(
        transaction: Transaction,
        refs: DocumentReference[]
    ): Promise<T[]> {
        try {
            const docs = await Promise.all(
                refs.map(ref => transaction.get(ref))
            );

            const results: T[] = [];
            for (const doc of docs) {
                if (doc.exists) {
                    results.push({ id: doc.id, ...doc.data() } as T);
                }
            }

            return results;
        } catch (error) {
            logger.error('Failed to get multiple documents in transaction', error);
            throw error;
        }
    }

    // ========================================================================
    // Real-time Subscription Operations - Minimal Implementation
    // ========================================================================

    subscribeToGroup(groupId: string, callback: GroupSubscriptionCallback): UnsubscribeFunction {
        // TODO: Implement real-time subscription
        return () => {};
    }

    subscribeToGroupExpenses(groupId: string, callback: ExpenseListSubscriptionCallback): UnsubscribeFunction {
        // TODO: Implement real-time subscription
        return () => {};
    }

    subscribeToComments(target: CommentTarget, callback: CommentListSubscriptionCallback): UnsubscribeFunction {
        // TODO: Implement real-time subscription
        return () => {};
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    async getBatchDocuments<T>(collection: string, documentIds: string[]): Promise<T[]> {
        // TODO: Implement efficient batch read
        return [];
    }

    // ========================================================================
    // Utility Operations
    // ========================================================================

    async documentExists(collection: string, documentId: string): Promise<boolean> {
        try {
            const doc = await this.db.collection(collection).doc(documentId).get();
            return doc.exists;
        } catch (error) {
            logger.error('Failed to check document existence', error, { collection, documentId });
            throw error;
        }
    }

    async countDocuments(collection: string, filters?: Record<string, any>): Promise<number> {
        // TODO: Implement count operation
        return 0;
    }
}