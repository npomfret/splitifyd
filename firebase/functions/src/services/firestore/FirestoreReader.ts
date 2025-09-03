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
import { FieldPath } from 'firebase-admin/firestore';
import { PerformanceMonitor } from '../../utils/performance-monitor';

// Import all schemas for validation
import {
    UserDocumentSchema,
    GroupDocumentSchema,
    ExpenseDocumentSchema,
    SettlementDocumentSchema,
    PolicyDocumentSchema,
    GroupMemberDocumentSchema,
    GroupChangeDocumentSchema
} from '../../schemas';

// Import types
import type {
    UserDocument,
    GroupDocument,  
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument,
    GroupChangeDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ParsedShareLink as ShareLinkDocument } from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { ParsedGroupMemberDocument } from '../../schemas';
import type { IFirestoreReader } from './IFirestoreReader';
import type {
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
        throw "todo";
    }

    async getGroupsForUser(userId: string, options?: QueryOptions): Promise<GroupDocument[]> {
        return PerformanceMonitor.monitorCollectionGroupQuery(
            'USER_GROUPS',
            userId,
            async () => {
                // NEW APPROACH: Use subcollection architecture instead of the old members field
                // First, get all group IDs where the user is a member from the subcollections
                const membershipQuery = this.db.collectionGroup('members')
                    .where('userId', '==', userId)
                    .select('groupId');  // Only select groupId to minimize data transfer
                    
                const membershipSnapshot = await membershipQuery.get();
            
            if (membershipSnapshot.empty) {
                return []; // User is not a member of any groups
            }
            
            // Extract group IDs from the membership documents
            const groupIds = membershipSnapshot.docs.map(doc => doc.data().groupId).filter(Boolean);
            
            if (groupIds.length === 0) {
                return [];
            }
            
            // Now query the groups collection using the group IDs
            // Firestore 'in' queries are limited to 10 items, so we might need to batch
            const groups: GroupDocument[] = [];
            
            // Process in chunks of 10 (Firestore 'in' query limit)
            for (let i = 0; i < groupIds.length; i += 10) {
                const chunk = groupIds.slice(i, i + 10);
                
                let query = this.db.collection(FirestoreCollections.GROUPS)
                    .where(FieldPath.documentId(), 'in', chunk);

                // Apply ordering
                if (options?.orderBy) {
                    query = query.orderBy(options.orderBy.field, options.orderBy.direction);
                } else {
                    query = query.orderBy('updatedAt', 'desc');
                }

                const snapshot = await query.get();

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
            }
            
            // Apply manual sorting since we might have fetched multiple chunks
            if (options?.orderBy) {
                const field = options.orderBy.field;
                const direction = options.orderBy.direction;
                groups.sort((a: any, b: any) => {
                    if (direction === 'asc') {
                        return a[field] > b[field] ? 1 : -1;
                    } else {
                        return a[field] < b[field] ? 1 : -1;
                    }
                });
            }
            
            // Apply cursor-based pagination (decode cursor and find position)
            let startIndex = 0;
            if (options?.cursor) {
                try {
                    // Decode cursor using same format as GroupService
                    const decodedCursor = Buffer.from(options.cursor, 'base64').toString('utf-8');
                    const cursorData = JSON.parse(decodedCursor);
                    
                    // Find the index of the cursor group by both updatedAt and id for precision
                    // Convert Firestore Timestamp to ISO string for comparison
                    let cursorUpdatedAt = cursorData.updatedAt;
                    if (typeof cursorUpdatedAt === 'object' && cursorUpdatedAt._seconds) {
                        // Convert Firestore Timestamp to ISO string
                        const timestamp = new Date(cursorUpdatedAt._seconds * 1000 + cursorUpdatedAt._nanoseconds / 1000000);
                        cursorUpdatedAt = timestamp.toISOString();
                    }
                    
                    // Simplified approach: find by ID only (more reliable)
                    const cursorIndex = groups.findIndex(group => group.id === cursorData.id);
                    
                    if (cursorIndex >= 0) {
                        startIndex = cursorIndex + 1; // Start after the cursor
                    }
                } catch (error) {
                    logger.warn('Invalid cursor provided, ignoring', { cursor: options.cursor });
                }
            }
            
                // Apply limit after sorting and cursor
                if (options?.limit) {
                    return groups.slice(startIndex, startIndex + options.limit);
                }

                return groups.slice(startIndex);
            },
            { 
                collectionGroupQuery: true,
                options: JSON.stringify(options) 
            }
        );
    }

    async getGroupMembers(groupId: string, options?: GroupMemberQueryOptions): Promise<GroupMemberDocument[]> {
        try {
            const membersRef = this.db
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .collection('members');

            let query: FirebaseFirestore.Query = membersRef;

            // Apply filters if specified
            if (options?.includeInactive === false) {
                query = query.where('status', '==', 'active');
            }

            if (options?.roles && options.roles.length > 0) {
                query = query.where('role', 'in', options.roles);
            }

            const snapshot = await query.get();
            const parsedMembers: ParsedGroupMemberDocument[] = [];

            for (const doc of snapshot.docs) {
                try {
                    const memberData = GroupMemberDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    parsedMembers.push(memberData);
                } catch (error) {
                    logger.error('Invalid group member document in getGroupMembers', error, {
                        memberId: doc.id,
                        groupId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return parsedMembers;
        } catch (error) {
            logger.error('Failed to get group members', error, { groupId });
            throw error;
        }
    }

    async getMemberFromSubcollection(groupId: string, userId: string): Promise<GroupMemberDocument | null> {
        return PerformanceMonitor.monitorSubcollectionQuery(
            'GET_MEMBER',
            groupId,
            async () => {
                const memberRef = this.db
                    .collection(FirestoreCollections.GROUPS)
                    .doc(groupId)
                    .collection('members')
                    .doc(userId);

                const memberDoc = await memberRef.get();
                if (!memberDoc.exists) {
                    return null;
                }

                const parsedMember = GroupMemberDocumentSchema.parse({
                    id: memberDoc.id,
                    ...memberDoc.data()
                });
                return parsedMember;
            },
            { userId }
        );
    }

    async getMembersFromSubcollection(groupId: string): Promise<GroupMemberDocument[]> {
        return PerformanceMonitor.monitorSubcollectionQuery(
            'GET_MEMBERS',
            groupId,
            async () => {
                const membersRef = this.db
                    .collection(FirestoreCollections.GROUPS)
                    .doc(groupId)
                    .collection('members');

                const snapshot = await membersRef.get();
                const parsedMembers: ParsedGroupMemberDocument[] = [];

                for (const doc of snapshot.docs) {
                    try {
                        const memberData = GroupMemberDocumentSchema.parse({
                            id: doc.id,
                            ...doc.data()
                        });
                        parsedMembers.push(memberData);
                    } catch (error) {
                        logger.error('Invalid group member document in getMembersFromSubcollection', error, {
                            memberId: doc.id,
                            groupId
                        });
                        // Skip invalid documents rather than failing the entire query
                    }
                }

                return parsedMembers;
            }
        );
    }

    async getExpensesForGroup(groupId: string, options?: QueryOptions): Promise<ExpenseDocument[]> {
        try {
            let query = this.db.collection(FirestoreCollections.EXPENSES)
                .where('groupId', '==', groupId)
                .where('deletedAt', '==', null);

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

    async getRecentGroupChanges(userId: string, options?: { 
        timeWindowMs?: number;
        limit?: number;
    }): Promise<GroupChangeDocument[]> {
        try {
            const timeWindow = options?.timeWindowMs || 60000; // Default 60 seconds
            const limit = options?.limit || 10;
            const cutoffTime = new Date(Date.now() - timeWindow);

            const changesSnapshot = await this.db
                .collection(FirestoreCollections.GROUP_CHANGES)
                .where('timestamp', '>', cutoffTime)
                .where('users', 'array-contains', userId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const groupChanges: GroupChangeDocument[] = [];
            changesSnapshot.forEach(doc => {
                try {
                    const changeData = GroupChangeDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    groupChanges.push(changeData);
                } catch (validationError) {
                    logger.error(`Invalid group change document ${doc.id}`, validationError as Error);
                }
            });

            return groupChanges;
        } catch (error) {
            logger.error(`Failed to get recent group changes for user ${userId}`, error as Error);
            throw error;
        }
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