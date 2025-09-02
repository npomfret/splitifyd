import {DocumentReference, Timestamp} from 'firebase-admin/firestore';
import {z} from 'zod';
import {firestoreDb} from '../firebase';
import {Errors} from '../utils/errors';
import {Group, UpdateGroupRequest} from '../types/group-types';
import {CreateGroupRequest, DELETED_AT_FIELD, FirestoreCollections, GroupMemberDocument, ListGroupsResponse, MemberRoles, MemberStatuses, MessageResponse, SecurityPresets} from '@splitifyd/shared';
import {calculateGroupBalances} from './balanceCalculator';
import {BalanceCalculationResultSchema, CurrencyBalanceDisplaySchema, BalanceDisplaySchema} from '../schemas';
import {calculateExpenseMetadata} from './expenseMetadataService';
import {transformGroupDocument} from '../groups/handlers';
import {GroupDataSchema, GroupDocumentSchema} from '../schemas';
import {getThemeColorForMember, isGroupMemberAsync, isGroupOwnerAsync} from '../utils/groupHelpers';
import {getExpenseService, getGroupMemberService, getSettlementService, getUserService} from './serviceRegistration';
import {encodeCursor} from '../utils/pagination';
import {DOCUMENT_CONFIG} from '../constants';
import {logger, LoggerContext} from '../logger';
import {createOptimisticTimestamp, createTrueServerTimestamp, getRelativeTime, parseISOToTimestamp, timestampToISO} from '../utils/dateHelpers';
import {PermissionEngine} from '../permissions';
import {getUpdatedAtTimestamp, updateWithTimestamp} from '../utils/optimistic-locking';
import {PerformanceMonitor} from '../utils/performance-monitor';
import {runTransactionWithRetry} from '../utils/firestore-helpers';

/**
 * Service for managing group operations
 */
export class GroupService {
    /**
     * Get the groups collection reference
     */
    private getGroupsCollection() {
        return firestoreDb.collection(FirestoreCollections.GROUPS);
    }

    /**
     * Add computed fields to Group (balance, last activity)
     */
    private async addComputedFields(group: Group, userId: string): Promise<Group> {
        // Calculate real balance for the user
        const groupBalances = await calculateGroupBalances(group.id);

        // Validate the balance calculation result for type safety
        const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);

        // Calculate expense metadata on-demand
        const expenseMetadata = await calculateExpenseMetadata(group.id);

        // Calculate currency-specific balances with proper typing
        const balancesByCurrency: Record<string, {
            currency: string;
            netBalance: number;
            totalOwed: number;
            totalOwing: number;
        }> = {};
        
        if (validatedBalances.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(validatedBalances.balancesByCurrency)) {
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                    const currencyDisplayData = {
                        currency,
                        netBalance: currencyUserBalance.netBalance,
                        totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                        totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                    };
                    
                    // Validate the currency display data structure
                    const validatedCurrencyData = CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                    balancesByCurrency[currency] = validatedCurrencyData;
                }
            }
        }

        // Create and validate the complete balance display data
        const balanceDisplay = { balancesByCurrency };
        const validatedBalanceDisplay = BalanceDisplaySchema.parse(balanceDisplay);

        return {
            ...group,
            balance: validatedBalanceDisplay,
            lastActivity: expenseMetadata.lastExpenseTime ? `Last expense ${expenseMetadata.lastExpenseTime.toLocaleDateString()}` : 'No recent activity',
            lastActivityRaw: expenseMetadata.lastExpenseTime ? expenseMetadata.lastExpenseTime.toISOString() : group.createdAt,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ docRef: DocumentReference; group: Group }> {
        const docRef = this.getGroupsCollection().doc(groupId);
        const doc = await docRef.get();

        if (!doc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const group = transformGroupDocument(doc);

        // Check if user is the owner
        if (await isGroupOwnerAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // For write operations, only the owner is allowed
        if (requireWriteAccess) {
            throw Errors.FORBIDDEN();
        }

        // For read operations, check if user is a member
        if (await isGroupMemberAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { docRef, group: groupWithComputed };
        }

        // User doesn't have access to this group
        // SECURITY: Return 404 instead of 403 to prevent information disclosure.
        // This prevents attackers from enumerating valid group IDs.
        throw Errors.NOT_FOUND('Group');
    }

    /**
     * Batch fetch all expenses and settlements for multiple groups
     * PERFORMANCE OPTIMIZED: Reduces N database queries to just 2-3
     */
    private async batchFetchGroupData(groupIds: string[]): Promise<{
        expensesByGroup: Map<string, any[]>;
        settlementsByGroup: Map<string, any[]>;
        expenseMetadataByGroup: Map<string, { count: number; lastExpenseTime?: Date }>;
    }> {
        if (groupIds.length === 0) {
            return {
                expensesByGroup: new Map(),
                settlementsByGroup: new Map(),
                expenseMetadataByGroup: new Map(),
            };
        }

        // Firestore 'in' query supports max 10 items - chunk if needed
        const chunks: string[][] = [];
        for (let i = 0; i < groupIds.length; i += 10) {
            chunks.push(groupIds.slice(i, i + 10));
        }

        // Batch fetch all expenses and settlements for all groups
        const expenseQueries = chunks.map((chunk) => firestoreDb.collection(FirestoreCollections.EXPENSES).where('groupId', 'in', chunk).get());

        const settlementQueries = chunks.map((chunk) => firestoreDb.collection(FirestoreCollections.SETTLEMENTS).where('groupId', 'in', chunk).get());

        // Execute all queries in parallel
        const [expenseResults, settlementResults] = await Promise.all([Promise.all(expenseQueries), Promise.all(settlementQueries)]);

        // Organize expenses by group ID
        const expensesByGroup = new Map<string, any[]>();
        const expenseMetadataByGroup = new Map<string, { count: number; lastExpenseTime?: Date }>();

        for (const snapshot of expenseResults) {
            for (const doc of snapshot.docs) {
                const expenseData = doc.data();
                const expense = { id: doc.id, groupId: expenseData.groupId, ...expenseData };
                const groupId = expense.groupId;

                if (!expensesByGroup.has(groupId)) {
                    expensesByGroup.set(groupId, []);
                }
                expensesByGroup.get(groupId)!.push(expense);
            }
        }

        // Calculate metadata for each group
        for (const [groupId, expenses] of expensesByGroup.entries()) {
            const nonDeletedExpenses = expenses.filter((expense) => !expense[DELETED_AT_FIELD]);
            const sortedExpenses = nonDeletedExpenses.sort((a, b) => {
                const aTime = a.createdAt?.toMillis() || 0;
                const bTime = b.createdAt?.toMillis() || 0;
                return bTime - aTime; // DESC order
            });

            expenseMetadataByGroup.set(groupId, {
                count: nonDeletedExpenses.length,
                lastExpenseTime: sortedExpenses.length > 0 ? sortedExpenses[0].createdAt?.toDate() : undefined,
            });
        }

        // Set empty metadata for groups with no expenses
        for (const groupId of groupIds) {
            if (!expenseMetadataByGroup.has(groupId)) {
                expenseMetadataByGroup.set(groupId, { count: 0 });
            }
        }

        // Organize settlements by group ID
        const settlementsByGroup = new Map<string, any[]>();
        for (const snapshot of settlementResults) {
            for (const doc of snapshot.docs) {
                const settlementData = doc.data();
                const settlement = { id: doc.id, groupId: settlementData.groupId, ...settlementData };
                const groupId = settlement.groupId;

                if (!settlementsByGroup.has(groupId)) {
                    settlementsByGroup.set(groupId, []);
                }
                settlementsByGroup.get(groupId)!.push(settlement);
            }
        }

        return {
            expensesByGroup,
            settlementsByGroup,
            expenseMetadataByGroup,
        };
    }

    /**
     * Format a date as relative time (e.g., "2 hours ago")
     */
    private formatRelativeTime(dateStr: string): string {
        const timestamp = parseISOToTimestamp(dateStr);
        if (!timestamp) {
            return 'unknown';
        }
        return getRelativeTime(timestamp);
    }

    /**
     * List all groups for a user with pagination and balance information
     * PERFORMANCE OPTIMIZED: Batches database operations to prevent N+1 queries
     */
    async listGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupService',
            'listGroups',
            async () => this._listGroups(userId, options),
            { userId, limit: options.limit }
        );
    }

    private async _listGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        return PerformanceMonitor.monitorBatchOperation(
            'list-groups',
            async (stepTracker) => {
                return this._executeListGroups(userId, options, stepTracker);
            },
            {
                userId,
                limit: options.limit,
                includeMetadata: options.includeMetadata
            }
        );
    }

    private async _executeListGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
        stepTracker: (stepName: string, stepOperation: () => Promise<any>) => Promise<any>
    ): Promise<ListGroupsResponse> {
        // Parse options with defaults
        const limit = Math.min(options.limit || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const cursor = options.cursor;
        const order = options.order ?? 'desc';
        const includeMetadata = options.includeMetadata === true;

        // Step 1: Get user's groups using scalable subcollection query
        const { groups, hasMore, changesSnapshot } = await stepTracker('fetch-user-groups-and-metadata', async () => {
            // Get groups for user using scalable subcollection query
            const groupIds = await getGroupMemberService().getUserGroupsViaSubcollection(userId);
            
            if (groupIds.length === 0) {
                return { groups: [], hasMore: false, changesSnapshot: null };
            }

            // Fetch all group documents
            const groupDocs = await Promise.all(
                groupIds.map(groupId => this.getGroupsCollection().doc(groupId).get())
            );

            // Filter existing groups and transform to Group objects
            const allGroups: Group[] = groupDocs
                .filter(doc => doc.exists)
                .map(doc => transformGroupDocument(doc));

            // Sort groups by updatedAt in memory
            allGroups.sort((a, b) => {
                const aTime = new Date(a.updatedAt).getTime();
                const bTime = new Date(b.updatedAt).getTime();
                return order === 'desc' ? bTime - aTime : aTime - bTime;
            });

            // Apply cursor-based pagination in memory
            let filteredGroups = allGroups;
            if (cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
                    const cursorTime = new Date(cursorData.updatedAt).getTime();
                    const cursorId = cursorData.id;
                    
                    filteredGroups = allGroups.filter(group => {
                        const groupTime = new Date(group.updatedAt).getTime();
                        if (order === 'desc') {
                            return groupTime < cursorTime || (groupTime === cursorTime && group.id < cursorId);
                        } else {
                            return groupTime > cursorTime || (groupTime === cursorTime && group.id > cursorId);
                        }
                    });
                } catch (error) {
                    logger.warn('Invalid cursor provided, ignoring pagination', { cursor, userId });
                }
            }

            // Apply limit and determine if there are more results
            const hasMore = filteredGroups.length > limit;
            const groups = hasMore ? filteredGroups.slice(0, limit) : filteredGroups;

            // Fetch metadata if requested
            let changesSnapshot = null;
            if (includeMetadata) {
                changesSnapshot = await firestoreDb
                    .collection(FirestoreCollections.GROUP_CHANGES)
                    .where('timestamp', '>', new Date(Date.now() - 60000))
                    .where('metadata.affectedUsers', 'array-contains', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(10)
                    .get();
            }

            return { groups, hasMore, changesSnapshot };
        });

        if (groups.length === 0) {
            return {
                groups: [],
                count: 0,
                hasMore: false,
                pagination: {
                    limit,
                    order,
                },
            };
        }

        const groupIds = groups.map((group: Group) => group.id);

        // Step 2: Batch fetch group data
        const { expenseMetadataByGroup } = await stepTracker('batch-fetch-group-data', async () => {
            return this.batchFetchGroupData(groupIds);
        });

        // Step 3: Batch fetch member profiles
        const { membersByGroupId, allMemberProfiles } = await stepTracker('batch-fetch-member-profiles', async () => {
            // Batch fetch all member data for all groups to avoid N+1 queries
            const membersByGroupId = new Map<string, GroupMemberDocument[]>();
            await Promise.all(
                groups.map(async (group: Group) => {
                    const members = await getGroupMemberService().getMembersFromSubcollection(group.id);
                    membersByGroupId.set(group.id, members);
                })
            );

            // Collect all unique member IDs for batch user profile fetch
            const allMemberIds = new Set<string>();
            membersByGroupId.forEach(members => {
                members.forEach(member => allMemberIds.add(member.userId));
            });
            const allMemberProfiles = await getUserService().getUsers(Array.from(allMemberIds));

            return { membersByGroupId, allMemberProfiles };
        });

        // Step 4: Calculate balances for groups with expenses
        const balanceMap = await stepTracker('calculate-group-balances', async () => {
            // Calculate balances for groups that have expenses
            const groupsWithExpenses = groups.filter((group: Group) => {
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };
                return expenseMetadata.count > 0;
            });

            const balancePromises = groupsWithExpenses.map((group: Group) => 
                calculateGroupBalances(group.id).catch((error: Error) => {
                    logger.error('Error calculating balances', error, { groupId: group.id });
                    return {
                        groupId: group.id,
                        balancesByCurrency: {},
                        userBalances: {},
                        simplifiedDebts: [],
                        lastUpdated: Timestamp.now(),
                    };
                })
            );

            const balanceResults = await Promise.all(balancePromises);
            const balanceMap = new Map<string, import('./balance').BalanceCalculationResult>();
            groupsWithExpenses.forEach((group: Group, index: number) => {
                balanceMap.set(group.id, balanceResults[index]);
            });

            return balanceMap;
        });

        // Step 5: Process each group using batched data - no more database calls!
        const groupsWithBalances: Group[] = await stepTracker('process-groups-with-balances', async () => {
            return groups.map((group: Group) => {
                // Get pre-fetched data for this group (no database calls)
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };

                // Get member profiles for this group using subcollection data
                const groupMembers = membersByGroupId.get(group.id) || [];
                const memberProfiles = new Map<string, import('../services/UserService2').UserProfile>();
                for (const member of groupMembers) {
                    const profile = allMemberProfiles.get(member.userId);
                    if (profile) {
                        memberProfiles.set(member.userId, profile);
                    }
                }

                // 🚀 OPTIMIZED: Use pre-calculated balance or empty balance
                const groupBalances = balanceMap.get(group.id) || {
                    groupId: group.id,
                    balancesByCurrency: {},
                    userBalances: {},
                    simplifiedDebts: [],
                    lastUpdated: Timestamp.now(),
                };

                // Calculate currency-specific balances with proper typing
                const balancesByCurrency: Record<string, {
                    currency: string;
                    netBalance: number;
                    totalOwed: number;
                    totalOwing: number;
                }> = {};
                
                if (groupBalances.balancesByCurrency) {
                    // Validate the balance data with schema first
                    const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);
                    
                    for (const [currency, currencyBalances] of Object.entries(validatedBalances.balancesByCurrency)) {
                        const currencyUserBalance = currencyBalances[userId];
                        if (currencyUserBalance && Math.abs(currencyUserBalance.netBalance) > 0.01) {
                            const currencyDisplayData = {
                                currency,
                                netBalance: currencyUserBalance.netBalance,
                                totalOwed: currencyUserBalance.netBalance > 0 ? currencyUserBalance.netBalance : 0,
                                totalOwing: currencyUserBalance.netBalance < 0 ? Math.abs(currencyUserBalance.netBalance) : 0,
                            };
                            
                            // Validate the currency display data structure
                            const validatedCurrencyData = CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                            balancesByCurrency[currency] = validatedCurrencyData;
                        }
                    }
                }

                // Format last activity using pre-fetched metadata
                const lastActivityDate = expenseMetadata.lastExpenseTime ?? new Date(group.updatedAt);
                const lastActivity = this.formatRelativeTime(lastActivityDate.toISOString());

                // Get user's balance from first available currency with proper typing
                let userBalance: {
                    netBalance: number;
                    totalOwed: number;
                    totalOwing: number;
                } = {
                    netBalance: 0,
                    totalOwed: 0,
                    totalOwing: 0,
                };
                
                if (groupBalances.balancesByCurrency) {
                    // Use validated balance data from above
                    const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);
                    const currencyBalancesArray = Object.values(validatedBalances.balancesByCurrency);
                    
                    if (currencyBalancesArray.length > 0) {
                        const firstCurrencyBalances = currencyBalancesArray[0];
                        if (firstCurrencyBalances && firstCurrencyBalances[userId]) {
                            const balance = firstCurrencyBalances[userId];
                            userBalance = {
                                netBalance: balance.netBalance,
                                totalOwed: balance.netBalance > 0 ? balance.netBalance : 0,
                                totalOwing: balance.netBalance < 0 ? Math.abs(balance.netBalance) : 0,
                            };
                        }
                    }
                }

                return {
                    ...group,
                    balance: {
                        userBalance,
                        balancesByCurrency,
                    },
                    lastActivity,
                    lastActivityRaw: lastActivityDate.toISOString(),
                };
            });
        });

        // Step 6: Generate pagination and response
        return await stepTracker('generate-response', async () => {
            // Generate nextCursor if there are more results
            let nextCursor: string | undefined;
            if (hasMore && groups.length > 0) {
                const lastGroup = groups[groups.length - 1];
                nextCursor = encodeCursor({
                    updatedAt: lastGroup.updatedAt,
                    id: lastGroup.id,
                });
            }

            const response: ListGroupsResponse = {
                groups: groupsWithBalances,
                count: groupsWithBalances.length,
                hasMore,
                ...(nextCursor && { nextCursor }),
                pagination: {
                    limit,
                    order,
                },
            };

            // Add metadata if requested
            if (includeMetadata && changesSnapshot) {
                const lastChange = changesSnapshot.docs[0];
                response.metadata = {
                    lastChangeTimestamp: lastChange?.data().timestamp?.toMillis() || 0,
                    changeCount: changesSnapshot.size,
                    serverTime: Date.now(),
                    hasRecentChanges: changesSnapshot.size > 0,
                };
            }

            return response;
        });
    }

    /**
     * Create a new group with the creator as the owner/admin
     * IMPORTANT: The creator is automatically added as a member with 'owner' role
     */
    async createGroup(userId: string, groupData: CreateGroupRequest): Promise<Group> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupService',
            'createGroup',
            async () => this._createGroup(userId, groupData),
            { userId }
        );
    }

    private async _createGroup(userId: string, createGroupRequest: CreateGroupRequest): Promise<Group> {
        // Initialize group structure with server timestamps
        const docRef = this.getGroupsCollection().doc();
        const serverTimestamp = createTrueServerTimestamp();
        const now = createOptimisticTimestamp();

        // Create member list with theme assignments
        const members: Record<string, any> = {};

        // CRUCIAL: Ensure creator is always first with theme index 0 and gets ADMIN role
        // This ensures the integration test "should create a new group with minimal data" passes
        members[userId] = {
            role: MemberRoles.ADMIN,
            status: MemberStatuses.ACTIVE,
            theme: getThemeColorForMember(0),
            joinedAt: now.toDate().toISOString(),
        };

        const newGroup: Group = {
            id: docRef.id,
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            members: members,
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: timestampToISO(now),
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Add server timestamps to the flat document structure
        const documentToWrite = {
            ...newGroup,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
        };

        try {
            GroupDataSchema.parse(newGroup);
        } catch (error) {
            logger.error('Invalid group document to write', error as Error, {
                groupId: docRef.id,
                userId,
            });
            throw Errors.INVALID_INPUT();
        }

        // Store in Firestore with flat structure (no data wrapper)
        await docRef.set(documentToWrite);

        // Dual-write: Also create the creator as a member in the subcollection
        const memberDoc: GroupMemberDocument = {
            userId: userId,
            groupId: docRef.id,
            role: MemberRoles.ADMIN,
            theme: getThemeColorForMember(0),
            joinedAt: now.toDate().toISOString(),
            status: MemberStatuses.ACTIVE,
        };
        await getGroupMemberService().createMemberSubcollection(docRef.id, memberDoc);

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: docRef.id });

        // Fetch the created document to get server-side timestamps
        const createdDoc = await docRef.get();
        const group = transformGroupDocument(createdDoc);

        // Add computed fields before returning
        return await this.addComputedFields(group, userId);
    }

    /**
     * Update an existing group
     * Only the owner can update a group
     */
    async updateGroup(groupId: string, userId: string, updates: UpdateGroupRequest): Promise<MessageResponse> {
        // Fetch group with write access check
        const { docRef, group } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Update with optimistic locking (timestamp is handled by optimistic locking system)
        await runTransactionWithRetry(
            async (transaction) => {
                const freshDoc = await transaction.get(docRef);
                if (!freshDoc.exists) {
                    throw Errors.NOT_FOUND('Group');
                }

                const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data(), docRef.id);

                // Create updated data with current timestamp (will be converted to ISO in the data field)
                const now = createOptimisticTimestamp();
                const updatedData = {
                    ...group,
                    ...updates,
                    updatedAt: now.toDate(),
                };

                // Use existing pattern since we already have the fresh document from transaction read
                await updateWithTimestamp(
                    transaction,
                    docRef,
                    {
                        name: updatedData.name,
                        description: updatedData.description,
                        updatedAt: updatedData.updatedAt.toISOString(),
                    },
                    originalUpdatedAt,
                );
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateGroup',
                    userId,
                    groupId
                }
            }
        );

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-updated', { id: groupId });

        return { message: 'Group updated successfully' };
    }

    /**
     * Delete a group
     * Only the owner can delete a group
     * Group cannot be deleted if it has expenses
     */
    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // Fetch group with write access check
        const { docRef } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Check if group has expenses
        const expensesSnapshot = await firestoreDb.collection(FirestoreCollections.EXPENSES).where('groupId', '==', groupId).limit(1).get();

        if (!expensesSnapshot.empty) {
            throw Errors.INVALID_INPUT('Cannot delete group with expenses. Delete all expenses first.');
        }

        // Delete the group
        await docRef.delete();

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-deleted', { id: groupId });

        return { message: 'Group deleted successfully' };
    }

    /**
     * Get group balances for a user
     * Returns simplified debts and balance information
     */
    async getGroupBalances(groupId: string, userId: string): Promise<{
        groupId: string;
        userBalances: any;
        simplifiedDebts: any;
        lastUpdated: string;
        balancesByCurrency: Record<string, any>;
    }> {
        return PerformanceMonitor.monitorServiceCall(
            'GroupService',
            'getGroupBalances',
            async () => this._getGroupBalances(groupId, userId),
            { groupId, userId }
        );
    }

    private async _getGroupBalances(groupId: string, userId: string): Promise<{
        groupId: string;
        userBalances: any;
        simplifiedDebts: any;
        lastUpdated: string;
        balancesByCurrency: Record<string, any>;
    }> {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        if (!groupId) {
            throw Errors.MISSING_FIELD('groupId');
        }

        const groupDoc = await this.getGroupsCollection().doc(groupId).get();

        if (!groupDoc.exists) {
            throw Errors.NOT_FOUND('Group');
        }

        const rawData = groupDoc.data();
        if (!rawData) {
            throw Errors.INTERNAL_ERROR();
        }

        let validatedGroup;
        try {
            const dataWithId = { ...rawData, id: groupId };
            validatedGroup = GroupDocumentSchema.parse(dataWithId);
        } catch (error) {
            logger.error('Group document validation failed', error as Error, {
                groupId,
                validationErrors: error instanceof z.ZodError ? error.issues : undefined,
            });
            throw Errors.INTERNAL_ERROR();
        }

        if (!validatedGroup.members || Object.keys(validatedGroup.members).length === 0) {
            throw Errors.INVALID_INPUT(`Group ${groupId} has no members`);
        }

        // Get members to validate user access
        const membersData = await getUserService().getUsers([userId]);
        if (!membersData.has(userId) || !(userId in validatedGroup.members)) {
            throw Errors.FORBIDDEN();
        }

        // Always calculate balances on-demand for accurate data
        const balances = await calculateGroupBalances(groupId);

        return {
            groupId: balances.groupId,
            userBalances: balances.userBalances,
            simplifiedDebts: balances.simplifiedDebts,
            lastUpdated: timestampToISO(balances.lastUpdated),
            balancesByCurrency: balances.balancesByCurrency || {},
        };
    }

    /**
     * Get comprehensive group details including members, expenses, balances, and settlements
     * @param groupId Group ID
     * @param userId User ID for access control
     * @param options Pagination options for expenses and settlements
     * @returns Complete group details
     */
    async getGroupFullDetails(
        groupId: string, 
        userId: string, 
        options: {
            expenseLimit?: number;
            expenseCursor?: string;
            settlementLimit?: number;
            settlementCursor?: string;
        } = {}
    ) {
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        // Validate and set defaults for pagination
        const expenseLimit = Math.min(options.expenseLimit || 20, 100);
        const settlementLimit = Math.min(options.settlementLimit || 20, 100);

        // Get group with access check (this will throw if user doesn't have access)
        const { group } = await this.fetchGroupWithAccess(groupId, userId);

        // Fetch all data in parallel using proper service layer methods
        const [membersData, expensesData, balancesData, settlementsData] = await Promise.all([
            // Get members using service layer from subcollection
            getGroupMemberService().getGroupMembersResponseFromSubcollection(groupId),

            // Get expenses using service layer with pagination
            getExpenseService().listGroupExpenses(groupId, userId, {
                limit: expenseLimit,
                cursor: options.expenseCursor,
            }),

            // Get balances using existing calculator
            calculateGroupBalances(groupId),

            // Get settlements using service layer with pagination
            getSettlementService()._getGroupSettlementsData(groupId, {
                limit: settlementLimit,
                cursor: options.settlementCursor,
            }),
        ]);

        // Validate balance data before returning
        const validatedBalances = BalanceCalculationResultSchema.parse(balancesData);

        // Construct response using existing patterns
        return {
            group,
            members: membersData,
            expenses: expensesData,
            balances: validatedBalances, // Now properly validated instead of unsafe cast
            settlements: settlementsData,
        };
    }
}

// ServiceRegistry handles service instantiation
