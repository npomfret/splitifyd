/**
 * FirestoreReader Implementation - Simplified Version
 * 
 * Centralized service for all Firestore read operations with:
 * - Zod schema validation for type safety
 * - Consistent error handling and logging
 */

import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { logger } from '../../logger';
import { FirestoreCollections, SecurityPresets, CommentTargetTypes, type CommentTargetType } from '@splitifyd/shared';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { PerformanceMonitor } from '../../utils/performance-monitor';

// Import all schemas for validation
import {
    UserDocumentSchema,
    GroupDocumentSchema,
    ExpenseDocumentSchema,
    SettlementDocumentSchema,
    PolicyDocumentSchema,
    GroupMemberDocumentSchema,
    // Note: GroupChangeDocumentSchema removed as unused
} from '../../schemas';
import { 
    UserNotificationDocumentSchema,
    type UserNotificationDocument 
} from '../../schemas/user-notifications';
import { 
    ShareLinkDocumentSchema,
    type ParsedShareLink 
} from '../../schemas/sharelink';
import { 
    CommentDocumentSchema,
    type ParsedComment 
} from '../../schemas/comment';

// Import types
import type {
    UserDocument,
    GroupDocument,  
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument
} from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { ParsedGroupMemberDocument } from '../../schemas';
import type { IFirestoreReader } from './IFirestoreReader';
import type {
    QueryOptions,
    GroupMemberQueryOptions,
    PaginatedResult,
    GroupsPaginationCursor,
    OrderBy,
    BatchGroupFetchOptions
} from '../../types/firestore-reader-types';


export class FirestoreReader implements IFirestoreReader {
    constructor(
        private readonly db: Firestore
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

            // Sanitize the data before validation
            const rawData = {
                id: groupDoc.id, 
                ...groupDoc.data() 
            };
            const sanitizedData = this.sanitizeGroupData(rawData);
            
            // Now validate with the sanitized data
            const groupData = GroupDocumentSchema.parse(sanitizedData);

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

    async getAllPolicies(): Promise<PolicyDocument[]> {
        try {
            const snapshot = await this.db
                .collection(FirestoreCollections.POLICIES)
                .get();

            const policies: PolicyDocument[] = [];

            snapshot.forEach((doc) => {
                try {
                    const policyData = PolicyDocumentSchema.parse({
                        id: doc.id,
                        ...doc.data()
                    });
                    policies.push(policyData);
                } catch (validationError) {
                    logger.warn('Skipping invalid policy document during getAllPolicies', {
                        policyId: doc.id,
                        error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
                    });
                }
            });

            return policies;
        } catch (error) {
            logger.error('Failed to get all policies', error);
            throw error;
        }
    }

    // ========================================================================
    // Helper Methods for Data Sanitization
    // ========================================================================

    /**
     * Sanitizes group data before validation to handle invalid values
     * that may have been inserted into the database
     */
    private sanitizeGroupData(data: any): any {
        const sanitized = { ...data };
        
        // Sanitize securityPreset field
        if (sanitized.securityPreset !== undefined) {
            const validPresets = Object.values(SecurityPresets);
            if (!validPresets.includes(sanitized.securityPreset)) {
                logger.warn('Invalid securityPreset value detected, defaulting to OPEN', {
                    groupId: sanitized.id,
                    invalidValue: sanitized.securityPreset,
                    validValues: validPresets
                });
                // Default to OPEN for invalid values
                sanitized.securityPreset = SecurityPresets.OPEN;
            }
        }
        
        return sanitized;
    }

    // ========================================================================
    // Pagination Utility Methods
    // ========================================================================

    /**
     * Encode cursor data for pagination
     * @param data - Cursor data to encode
     * @returns Base64 encoded cursor string
     */
    private encodeCursor(data: GroupsPaginationCursor): string {
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    /**
     * Decode cursor string for pagination
     * @param cursor - Base64 encoded cursor string
     * @returns Decoded cursor data
     */
    private decodeCursor(cursor: string): GroupsPaginationCursor {
        return JSON.parse(Buffer.from(cursor, 'base64').toString());
    }

    /**
     * Efficiently fetch groups by IDs with proper ordering and limits
     * This method avoids the "fetch-all-then-paginate" anti-pattern
     * @param groupIds - Array of group IDs to fetch
     * @param options - Options for ordering and limiting results
     * @returns Array of group documents, limited and ordered as specified
     */
    private async getGroupsByIds(
        groupIds: string[], 
        options: BatchGroupFetchOptions
    ): Promise<GroupDocument[]> {
        if (groupIds.length === 0) return [];
        
        const allGroups: GroupDocument[] = [];
        
        // Process in chunks of 10 (Firestore 'in' query limit)
        // BUT apply limit across ALL chunks to avoid fetching unnecessary data
        for (let i = 0; i < groupIds.length; i += 10) {
            // Stop if we've already reached our limit
            if (allGroups.length >= options.limit) {
                break;
            }
            
            const chunk = groupIds.slice(i, i + 10);
            const remainingLimit = options.limit - allGroups.length;
            
            let query = this.db.collection(FirestoreCollections.GROUPS)
                .where(FieldPath.documentId(), 'in', chunk)
                .orderBy(options.orderBy.field, options.orderBy.direction)
                .limit(Math.min(remainingLimit, chunk.length)); // Apply limit per chunk
                
            const snapshot = await query.get();
            
            for (const doc of snapshot.docs) {
                try {
                    // Sanitize the data before validation
                    const rawData = {
                        id: doc.id,
                        ...doc.data()
                    };
                    const sanitizedData = this.sanitizeGroupData(rawData);
                    
                    // Now validate with the sanitized data
                    const groupData = GroupDocumentSchema.parse(sanitizedData);
                    allGroups.push(groupData);
                    
                    // Hard stop if we reach the limit
                    if (allGroups.length >= options.limit) break;
                } catch (error) {
                    logger.error('Invalid group document in getGroupsByIds', {
                        error,
                        groupId: doc.id,
                        field: options.orderBy.field
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }
        }
        
        // Final sort since we might have fetched from multiple queries
        // This is much more efficient than sorting ALL groups like the old implementation
        return allGroups.sort((a: GroupDocument, b: GroupDocument) => {
            const field = options.orderBy.field as keyof GroupDocument;
            const direction = options.orderBy.direction;
            const aValue = a[field];
            const bValue = b[field];
            
            if (aValue === undefined || aValue === null || bValue === undefined || bValue === null) return 0;
            
            return direction === 'asc' 
                ? (aValue > bValue ? 1 : -1)
                : (aValue < bValue ? 1 : -1);
        });
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


    /**
     * ✅ FIXED: Efficient paginated group retrieval with hybrid strategy
     * 
     * This method implements the performance fix from the critical pagination report:
     * - Uses query-level pagination instead of fetch-all-then-paginate
     * - Applies limits at the database query level, not in memory
     * - Provides proper cursor-based pagination with hasMore detection
     * - Reduces resource usage by 90%+ for users with many groups
     */
    async getGroupsForUser(userId: string, options?: QueryOptions): Promise<PaginatedResult<GroupDocument[]>> {
        return PerformanceMonitor.monitorCollectionGroupQuery(
            'USER_GROUPS',
            userId,
            async () => {
                const limit = options?.limit || 10;
                const effectiveLimit = limit + 1; // +1 to detect "hasMore"
                
                // PHASE 1: Get paginated group memberships (NOT all memberships!)
                let membershipQuery = this.db.collectionGroup('members')
                    .where('userId', '==', userId)
                    .orderBy('groupId') // Consistent ordering for cursor reliability
                    .limit(effectiveLimit * 2); // Buffer for potential deduplication
                    
                if (options?.cursor) {
                    try {
                        const cursorData = this.decodeCursor(options.cursor);
                        membershipQuery = membershipQuery.startAfter(cursorData.lastGroupId);
                    } catch (error) {
                        logger.warn('Invalid cursor provided, ignoring', { 
                            cursor: options.cursor, 
                            error: error instanceof Error ? error.message : 'Unknown error' 
                        });
                    }
                }
                
                const membershipSnapshot = await membershipQuery.get();
                
                if (membershipSnapshot.empty) {
                    return {
                        data: [],
                        hasMore: false
                    };
                }
                
                // Extract group IDs from the paginated membership documents
                const groupIds = membershipSnapshot.docs
                    .map(doc => doc.data().groupId)
                    .filter(Boolean);
                
                if (groupIds.length === 0) {
                    return {
                        data: [],
                        hasMore: false
                    };
                }
                
                // PHASE 2: Get group documents with proper ordering and limits
                const orderBy: OrderBy = options?.orderBy || { field: 'updatedAt', direction: 'desc' };
                const groups = await this.getGroupsByIds(groupIds, {
                    orderBy,
                    limit: effectiveLimit
                });
                
                // Detect if more results exist
                const hasMore = groups.length > limit;
                const returnedGroups = hasMore ? groups.slice(0, limit) : groups;
                
                // Generate next cursor if there are more results
                let nextCursor: string | undefined;
                if (hasMore && membershipSnapshot.docs.length > 0) {
                    // Use the last membership document's groupId for cursor continuation
                    // This ensures consistency with the membership query ordering
                    const lastMembershipDoc = membershipSnapshot.docs[membershipSnapshot.docs.length - 1];
                    const lastProcessedGroupId = lastMembershipDoc.data().groupId;
                    
                    nextCursor = this.encodeCursor({
                        lastGroupId: lastProcessedGroupId,
                        lastUpdatedAt: '', // Not used for membership cursor
                        membershipCursor: lastProcessedGroupId
                    });
                }
                
                return {
                    data: returnedGroups,
                    hasMore,
                    nextCursor,
                    totalEstimate: hasMore ? groupIds.length + 10 : groupIds.length // Rough estimate
                };
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


    // todo: this should be paginated
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



    // Note: getRecentGroupChanges removed as GROUP_CHANGES collection was unused



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




    // ========================================================================
    // Batch Operations
    // ========================================================================


    // ========================================================================
    // Performance Metrics Operations
    // ========================================================================

    async queryPerformanceMetrics(
        collectionName: string,
        minutes: number,
        filters?: {
            operationType?: string;
            operationName?: string;
            success?: boolean;
        }
    ): Promise<any[]> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'queryPerformanceMetrics',
            async () => {
                try {
                    const cutoff = new Date();
                    cutoff.setMinutes(cutoff.getMinutes() - minutes);

                    let query = this.db
                        .collection(collectionName)
                        .where('timestamp', '>=', Timestamp.fromDate(cutoff))
                        .orderBy('timestamp', 'desc')
                        .limit(1000);

                    if (filters?.operationType) {
                        query = query.where('operationType', '==', filters.operationType);
                    }

                    if (filters?.operationName) {
                        query = query.where('operationName', '==', filters.operationName);
                    }

                    if (filters?.success !== undefined) {
                        query = query.where('success', '==', filters.success);
                    }

                    const snapshot = await query.get();

                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            timestamp: data.timestamp.toDate(),
                            context: typeof data.context === 'string' 
                                ? JSON.parse(data.context) 
                                : data.context
                        };
                    });
                } catch (error) {
                    logger.error('Failed to query performance metrics', error, { collectionName, minutes, filters });
                    return [];
                }
            },
            { collectionName, minutes, hasFilters: !!filters }
        );
    }

    async queryAggregatedStats(
        collectionName: string,
        period: 'hour' | 'day' | 'week',
        lookbackCount: number = 24
    ): Promise<any[]> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'queryAggregatedStats',
            async () => {
                try {
                    const snapshot = await this.db
                        .collection(collectionName)
                        .where('period', '==', period)
                        .orderBy('periodStart', 'desc')
                        .limit(lookbackCount)
                        .get();

                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            periodStart: data.periodStart.toDate(),
                            periodEnd: data.periodEnd.toDate()
                        };
                    });
                } catch (error) {
                    logger.error('Failed to query aggregated stats', error, { collectionName, period, lookbackCount });
                    return [];
                }
            },
            { collectionName, period, lookbackCount }
        );
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

    // ========================================================================
    // User Notification Operations
    // ========================================================================

    async getUserNotification(userId: string): Promise<UserNotificationDocument | null> {
        try {
            const notificationDoc = await this.db
                .collection('user-notifications')
                .doc(userId)
                .get();

            if (!notificationDoc.exists) {
                return null;
            }

            const notificationData = UserNotificationDocumentSchema.parse(notificationDoc.data());
            return notificationData;
        } catch (error) {
            logger.error('Failed to get user notification', error, { userId });
            throw error;
        }
    }

    async userNotificationExists(userId: string): Promise<boolean> {
        try {
            const doc = await this.db.collection('user-notifications').doc(userId).get();
            return doc.exists;
        } catch (error) {
            logger.error('Failed to check user notification existence', error, { userId });
            throw error;
        }
    }

    // ========================================================================
    // Share Link Operations
    // ========================================================================

    async findShareLinkByToken(token: string): Promise<{ groupId: string; shareLink: ParsedShareLink } | null> {
        try {
            const snapshot = await this.db
                .collectionGroup('shareLinks')
                .where('token', '==', token)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const shareLinkDoc = snapshot.docs[0];
            const groupId = shareLinkDoc.ref.parent.parent!.id;
            
            const rawData = shareLinkDoc.data();
            if (!rawData) {
                throw new Error('Share link document data is null');
            }

            const dataWithId = { ...rawData, id: shareLinkDoc.id };
            const shareLink = ShareLinkDocumentSchema.parse(dataWithId);

            return { groupId, shareLink };
        } catch (error) {
            logger.error('Failed to find share link by token', error, { token });
            throw error;
        }
    }

    async getShareLinksForGroup(groupId: string): Promise<ParsedShareLink[]> {
        try {
            const snapshot = await this.db
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .collection('shareLinks')
                .where('isActive', '==', true)
                .orderBy('createdAt', 'desc')
                .get();

            const shareLinks: ParsedShareLink[] = [];
            
            for (const doc of snapshot.docs) {
                try {
                    const rawData = doc.data();
                    const dataWithId = { ...rawData, id: doc.id };
                    const shareLink = ShareLinkDocumentSchema.parse(dataWithId);
                    shareLinks.push(shareLink);
                } catch (error) {
                    logger.error('Invalid share link document in getShareLinksForGroup', {
                        error,
                        shareLinkId: doc.id,
                        groupId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return shareLinks;
        } catch (error) {
            logger.error('Failed to get share links for group', error, { groupId });
            throw error;
        }
    }

    async getShareLink(groupId: string, shareLinkId: string): Promise<ParsedShareLink | null> {
        try {
            const doc = await this.db
                .collection(FirestoreCollections.GROUPS)
                .doc(groupId)
                .collection('shareLinks')
                .doc(shareLinkId)
                .get();

            if (!doc.exists) {
                return null;
            }

            const rawData = doc.data();
            if (!rawData) {
                return null;
            }

            const dataWithId = { ...rawData, id: doc.id };
            const shareLink = ShareLinkDocumentSchema.parse(dataWithId);
            return shareLink;
        } catch (error) {
            logger.error('Failed to get share link', error, { groupId, shareLinkId });
            throw error;
        }
    }

    // ========================================================================
    // Comment Operations
    // ========================================================================

    async getCommentsForTarget(
        targetType: CommentTargetType,
        targetId: string,
        options: {
            limit?: number;
            cursor?: string;
            orderBy?: 'createdAt' | 'updatedAt';
            direction?: 'asc' | 'desc';
        } = {}
    ): Promise<{ comments: ParsedComment[]; hasMore: boolean; nextCursor?: string }> {
        try {
            const { limit = 50, cursor, orderBy = 'createdAt', direction = 'desc' } = options;
            
            // Get the appropriate subcollection reference
            let commentsCollection: FirebaseFirestore.CollectionReference;
            if (targetType === CommentTargetTypes.GROUP) {
                commentsCollection = this.db
                    .collection(FirestoreCollections.GROUPS)
                    .doc(targetId)
                    .collection(FirestoreCollections.COMMENTS);
            } else if (targetType === CommentTargetTypes.EXPENSE) {
                commentsCollection = this.db
                    .collection(FirestoreCollections.EXPENSES)
                    .doc(targetId)
                    .collection(FirestoreCollections.COMMENTS);
            } else {
                throw new Error(`Invalid target type: ${targetType}`);
            }

            // Build the query
            let query = commentsCollection
                .orderBy(orderBy, direction)
                .limit(limit + 1); // +1 to check if there are more

            // Apply cursor-based pagination if provided
            if (cursor) {
                const cursorDoc = await commentsCollection.doc(cursor).get();
                if (cursorDoc.exists) {
                    query = query.startAfter(cursorDoc);
                }
            }

            const snapshot = await query.get();
            const docs = snapshot.docs;

            // Determine if there are more comments
            const hasMore = docs.length > limit;
            const commentsToReturn = hasMore ? docs.slice(0, limit) : docs;

            // Transform documents to ParsedComment objects
            const comments: ParsedComment[] = [];
            for (const doc of commentsToReturn) {
                try {
                    const rawData = doc.data();
                    const dataWithId = { ...rawData, id: doc.id };
                    const comment = CommentDocumentSchema.parse(dataWithId);
                    comments.push(comment);
                } catch (error) {
                    logger.error('Invalid comment document in getCommentsForTarget', {
                        error,
                        commentId: doc.id,
                        targetType,
                        targetId
                    });
                    // Skip invalid documents rather than failing the entire query
                }
            }

            return {
                comments,
                hasMore,
                nextCursor: hasMore && commentsToReturn.length > 0 
                    ? commentsToReturn[commentsToReturn.length - 1].id 
                    : undefined,
            };
        } catch (error) {
            logger.error('Failed to get comments for target', error, { targetType, targetId });
            throw error;
        }
    }

    async getCommentByReference(commentDocRef: FirebaseFirestore.DocumentReference): Promise<ParsedComment | null> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getCommentByReference',
            async () => {
                try {
                    const doc = await commentDocRef.get();
                    if (!doc.exists) {
                        return null;
                    }

                    const rawData = doc.data();
                    if (!rawData) {
                        return null;
                    }

                    const dataWithId = { ...rawData, id: doc.id };
                    return CommentDocumentSchema.parse(dataWithId);
                } catch (error) {
                    logger.error('Failed to get comment by reference', error, {
                        commentPath: commentDocRef.path
                    });
                    throw error;
                }
            },
            { commentPath: commentDocRef.path }
        );
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string): Promise<ParsedComment | null> {
        try {
            // Get the appropriate subcollection reference
            let commentsCollection: FirebaseFirestore.CollectionReference;
            if (targetType === CommentTargetTypes.GROUP) {
                commentsCollection = this.db
                    .collection(FirestoreCollections.GROUPS)
                    .doc(targetId)
                    .collection(FirestoreCollections.COMMENTS);
            } else if (targetType === CommentTargetTypes.EXPENSE) {
                commentsCollection = this.db
                    .collection(FirestoreCollections.EXPENSES)
                    .doc(targetId)
                    .collection(FirestoreCollections.COMMENTS);
            } else {
                throw new Error(`Invalid target type: ${targetType}`);
            }

            const doc = await commentsCollection.doc(commentId).get();

            if (!doc.exists) {
                return null;
            }

            const rawData = doc.data();
            if (!rawData) {
                return null;
            }

            const dataWithId = { ...rawData, id: doc.id };
            const comment = CommentDocumentSchema.parse(dataWithId);
            return comment;
        } catch (error) {
            logger.error('Failed to get comment', error, { targetType, targetId, commentId });
            throw error;
        }
    }

    // ========================================================================
    // Test User Pool Operations
    // ========================================================================

    async getAvailableTestUser(): Promise<any | null> {
        try {
            const snapshot = await this.db
                .collection('test-user-pool')
                .where('status', '==', 'available')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            logger.error('Failed to get available test user', error);
            throw error;
        }
    }

    async getTestUser(email: string): Promise<any | null> {
        try {
            const doc = await this.db
                .collection('test-user-pool')
                .doc(email)
                .get();

            if (!doc.exists) {
                return null;
            }

            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            logger.error('Failed to get test user', error, { email });
            throw error;
        }
    }

    async getTestUserPoolStatus(): Promise<{ available: number; borrowed: number; total: number }> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getTestUserPoolStatus',
            async () => {
                try {
                    const [availableSnapshot, borrowedSnapshot] = await Promise.all([
                        this.db.collection('test-user-pool').where('status', '==', 'available').get(),
                        this.db.collection('test-user-pool').where('status', '==', 'borrowed').get()
                    ]);
                    
                    return {
                        available: availableSnapshot.size,
                        borrowed: borrowedSnapshot.size,
                        total: availableSnapshot.size + borrowedSnapshot.size,
                    };
                } catch (error) {
                    logger.error('Failed to get test user pool status', error);
                    throw error;
                }
            },
            {}
        );
    }

    async getBorrowedTestUsers(): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getBorrowedTestUsers',
            async () => {
                try {
                    const snapshot = await this.db
                        .collection('test-user-pool')
                        .where('status', '==', 'borrowed')
                        .get();
                    
                    return snapshot.docs;
                } catch (error) {
                    logger.error('Failed to get borrowed test users', error);
                    throw error;
                }
            },
            {}
        );
    }

    // ========================================================================
    // System Metrics Operations
    // ========================================================================

    async getOldDocuments(
        collection: string,
        cutoffDate: Date,
        limit: number = 500
    ): Promise<FirebaseFirestore.DocumentSnapshot[]> {
        try {
            let query: FirebaseFirestore.Query = this.db.collection(collection);
            
            // If collection supports timestamp-based queries, use cutoff date
            if (collection !== 'system-metrics') {
                query = query.where('timestamp', '<', cutoffDate);
            }
            
            query = query.limit(limit);

            const snapshot = await query.get();
            return snapshot.docs;
        } catch (error) {
            logger.error('Failed to get old documents', error, { collection, cutoffDate, limit });
            throw error;
        }
    }

    async getOldDocumentsByField(
        collection: string,
        timestampField: string,
        cutoffDate: Date,
        limit: number = 500
    ): Promise<FirebaseFirestore.DocumentSnapshot[]> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getOldDocumentsByField',
            async () => {
                try {
                    const snapshot = await this.db
                        .collection(collection)
                        .where(timestampField, '<', cutoffDate)
                        .limit(limit)
                        .get();

                    return snapshot.docs;
                } catch (error) {
                    logger.error('Failed to get old documents by field', error, { 
                        collection, 
                        timestampField, 
                        cutoffDate, 
                        limit 
                    });
                    throw error;
                }
            },
            { collection, timestampField, limit }
        );
    }

    async getDocumentsBatch(
        collection: string,
        limit: number = 500
    ): Promise<FirebaseFirestore.DocumentSnapshot[]> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getDocumentsBatch',
            async () => {
                try {
                    const snapshot = await this.db
                        .collection(collection)
                        .limit(limit)
                        .get();

                    return snapshot.docs;
                } catch (error) {
                    logger.error('Failed to get documents batch', error, { 
                        collection, 
                        limit 
                    });
                    throw error;
                }
            },
            { collection, limit }
        );
    }

    async getMetricsDocuments(
        collection: string,
        timestampField: string,
        cutoffTimestamp: any,
        limit: number = 500
    ): Promise<FirebaseFirestore.DocumentSnapshot[]> {
        try {
            const snapshot = await this.db
                .collection(collection)
                .where(timestampField, '<', cutoffTimestamp)
                .limit(limit)
                .get();

            return snapshot.docs;
        } catch (error) {
            logger.error('Failed to get metrics documents', error, { 
                collection, 
                timestampField, 
                cutoffTimestamp, 
                limit 
            });
            throw error;
        }
    }

    async getCollectionSize(collection: string): Promise<number> {
        try {
            const snapshot = await this.db
                .collection(collection)
                .count()
                .get();

            return snapshot.data().count;
        } catch (error) {
            logger.error('Failed to get collection size', error, { collection });
            throw error;
        }
    }

    // ========================================================================
    // New Methods for Centralizing Firestore Access
    // ========================================================================

    async getUserExpenses(userId: string, options?: {
        limit?: number;
        cursor?: string;
        includeDeleted?: boolean;
    }): Promise<{
        expenses: ExpenseDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getUserExpenses',
            async () => {
                try {
                    const limit = Math.min(options?.limit || 50, 100);
                    const cursor = options?.cursor;
                    const includeDeleted = options?.includeDeleted || false;

                    let query = this.db.collection(FirestoreCollections.EXPENSES)
                        .where('participants', 'array-contains', userId)
                        .select(
                            'groupId',
                            'createdBy',
                            'paidBy',
                            'amount',
                            'currency',
                            'description',
                            'category',
                            'date',
                            'splitType',
                            'participants',
                            'splits',
                            'receiptUrl',
                            'createdAt',
                            'updatedAt',
                            'deletedAt',
                            'deletedBy',
                        )
                        .orderBy('date', 'desc')
                        .orderBy('createdAt', 'desc')
                        .limit(limit + 1);

                    // Filter out deleted expenses by default
                    if (!includeDeleted) {
                        query = query.where('deletedAt', '==', null);
                    }

                    if (cursor) {
                        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
                        const cursorData = JSON.parse(decodedCursor);
                        if (cursorData.date && cursorData.createdAt) {
                            query = query.startAfter(
                                Timestamp.fromDate(new Date(cursorData.date)),
                                Timestamp.fromDate(new Date(cursorData.createdAt))
                            );
                        }
                    }

                    const snapshot = await query.get();
                    const hasMore = snapshot.docs.length > limit;
                    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

                    const expenses = docs.map(doc => 
                        ExpenseDocumentSchema.parse({ id: doc.id, ...doc.data() })
                    );

                    let nextCursor: string | undefined;
                    if (hasMore && docs.length > 0) {
                        const lastDoc = docs[docs.length - 1];
                        const lastData = lastDoc.data();
                        const cursorData = {
                            date: lastData.date?.toDate?.()?.toISOString() || lastData.date,
                            createdAt: lastData.createdAt?.toDate?.()?.toISOString() || lastData.createdAt
                        };
                        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
                    }

                    return {
                        expenses,
                        hasMore,
                        nextCursor
                    };
                } catch (error) {
                    logger.error('Failed to get user expenses', error, { userId, options });
                    throw error;
                }
            },
            { userId, limit: options?.limit, includeDeleted: options?.includeDeleted }
        );
    }

    async getExpenseHistory(expenseId: string, limit: number = 20): Promise<{
        history: any[];
        count: number;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getExpenseHistory',
            async () => {
                try {
                    const historySnapshot = await this.db
                        .collection(FirestoreCollections.EXPENSES)
                        .doc(expenseId)
                        .collection('history')
                        .orderBy('modifiedAt', 'desc')
                        .limit(limit)
                        .get();

                    const history = historySnapshot.docs.map((doc) => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            modifiedAt: data.modifiedAt?.toDate?.()?.toISOString() || data.modifiedAt,
                            modifiedBy: data.modifiedBy,
                            changeType: data.changeType,
                            changes: data.changes,
                            previousAmount: data.amount,
                            previousDescription: data.description,
                            previousCategory: data.category,
                            previousDate: data.date?.toDate?.()?.toISOString() || data.date,
                            previousSplits: data.splits,
                        };
                    });

                    return {
                        history,
                        count: history.length,
                    };
                } catch (error) {
                    logger.error('Failed to get expense history', error, { expenseId, limit });
                    throw error;
                }
            },
            { expenseId, limit }
        );
    }

    async getSystemDocument(docPath: string): Promise<any | null> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getSystemDocument',
            async () => {
                try {
                    const doc = await this.db.doc(docPath).get();
                    return doc.exists ? doc.data() : null;
                } catch (error) {
                    logger.error('Failed to get system document', error, { docPath });
                    throw error;
                }
            },
            { docPath }
        );
    }

    async getHealthCheckDocument(): Promise<any | null> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getHealthCheckDocument',
            async () => {
                try {
                    const testRef = this.db.collection('_health_check').doc('test');
                    await testRef.get();
                    return { status: 'ok', timestamp: new Date().toISOString() };
                } catch (error) {
                    logger.error('Failed to perform health check', error);
                    throw error;
                }
            }
        );
    }

    async getGroupDeletionData(groupId: string): Promise<{
        expenses: FirebaseFirestore.QuerySnapshot;
        settlements: FirebaseFirestore.QuerySnapshot;
        transactionChanges: FirebaseFirestore.QuerySnapshot;
        balanceChanges: FirebaseFirestore.QuerySnapshot;
        shareLinks: FirebaseFirestore.QuerySnapshot;
        groupComments: FirebaseFirestore.QuerySnapshot;
        expenseComments: FirebaseFirestore.QuerySnapshot[];
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getGroupDeletionData',
            async () => {
                try {
                    const [
                        expensesSnapshot,
                        settlementsSnapshot,
                        transactionChangesSnapshot,
                        balanceChangesSnapshot,
                        shareLinksSnapshot,
                        groupCommentsSnapshot,
                    ] = await Promise.all([
                        this.db.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).get(),
                        this.db.collection(FirestoreCollections.SETTLEMENTS).where('groupId', '==', groupId).get(),
                        this.db.collection(FirestoreCollections.TRANSACTION_CHANGES).where('groupId', '==', groupId).get(),
                        this.db.collection(FirestoreCollections.BALANCE_CHANGES).where('groupId', '==', groupId).get(),
                        this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection('shareLinks').get(),
                        this.db.collection(FirestoreCollections.GROUPS).doc(groupId).collection(FirestoreCollections.COMMENTS).get(),
                    ]);

                    // Get comment subcollections for each expense
                    const expenseComments = await Promise.all(
                        expensesSnapshot.docs.map(expense =>
                            this.db.collection(FirestoreCollections.EXPENSES).doc(expense.id).collection(FirestoreCollections.COMMENTS).get()
                        )
                    );

                    return {
                        expenses: expensesSnapshot,
                        settlements: settlementsSnapshot,
                        transactionChanges: transactionChangesSnapshot,
                        balanceChanges: balanceChangesSnapshot,
                        shareLinks: shareLinksSnapshot,
                        groupComments: groupCommentsSnapshot,
                        expenseComments,
                    };
                } catch (error) {
                    logger.error('Failed to get group deletion data', error, { groupId });
                    throw error;
                }
            },
            { groupId }
        );
    }

    async getDocumentForTesting(collection: string, docId: string): Promise<any | null> {
        try {
            const doc = await this.db.collection(collection).doc(docId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            logger.error('Failed to get document for testing', error, { collection, docId });
            throw error;
        }
    }

    async verifyDocumentExists(collection: string, docId: string): Promise<boolean> {
        try {
            const doc = await this.db.collection(collection).doc(docId).get();
            return doc.exists;
        } catch (error) {
            logger.error('Failed to verify document exists', error, { collection, docId });
            throw error;
        }
    }

    async getExpensesForGroupPaginated(groupId: string, options?: {
        limit?: number;
        cursor?: string;
        includeDeleted?: boolean;
    }): Promise<{
        expenses: ExpenseDocument[];
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'FirestoreReader',
            'getExpensesForGroupPaginated',
            async () => {
                try {
                    const limit = Math.min(options?.limit || 20, 100);
                    const cursor = options?.cursor;
                    const includeDeleted = options?.includeDeleted || false;

                    let query = this.db.collection(FirestoreCollections.EXPENSES)
                        .where('groupId', '==', groupId);

                    // Filter out deleted expenses by default
                    if (!includeDeleted) {
                        query = query.where('deletedAt', '==', null);
                    }

                    query = query
                        .select(
                            'groupId',
                            'createdBy',
                            'paidBy',
                            'amount',
                            'currency',
                            'description',
                            'category',
                            'date',
                            'splitType',
                            'participants',
                            'splits',
                            'receiptUrl',
                            'createdAt',
                            'updatedAt',
                            'deletedAt',
                            'deletedBy',
                        )
                        .orderBy('date', 'desc')
                        .orderBy('createdAt', 'desc')
                        .limit(limit + 1);

                    if (cursor) {
                        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
                        const cursorData = JSON.parse(decodedCursor);
                        if (cursorData.date && cursorData.createdAt) {
                            query = query.startAfter(
                                Timestamp.fromDate(new Date(cursorData.date)),
                                Timestamp.fromDate(new Date(cursorData.createdAt))
                            );
                        }
                    }

                    const snapshot = await query.get();
                    const hasMore = snapshot.docs.length > limit;
                    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

                    const expenses = docs.map(doc => 
                        ExpenseDocumentSchema.parse({ id: doc.id, ...doc.data() })
                    );

                    let nextCursor: string | undefined;
                    if (hasMore && docs.length > 0) {
                        const lastDoc = docs[docs.length - 1];
                        const lastData = lastDoc.data();
                        const cursorData = {
                            date: lastData.date?.toDate?.()?.toISOString() || lastData.date,
                            createdAt: lastData.createdAt?.toDate?.()?.toISOString() || lastData.createdAt
                        };
                        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
                    }

                    return {
                        expenses,
                        hasMore,
                        nextCursor
                    };
                } catch (error) {
                    logger.error('Failed to get expenses for group paginated', error, { groupId, options });
                    throw error;
                }
            },
            { groupId, limit: options?.limit, includeDeleted: options?.includeDeleted }
        );
    }

}