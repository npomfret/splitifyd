import {FieldValue, Timestamp} from 'firebase-admin/firestore';
import {Errors} from '../utils/errors';
import {Group, UpdateGroupRequest} from '../types/group-types';
import {CreateGroupRequest, DELETED_AT_FIELD, FirestoreCollections, GroupMemberDocument, ListGroupsResponse, MemberRoles, MemberStatuses, MessageResponse, SecurityPresets} from '@splitifyd/shared';
import {BalanceCalculationResultSchema, BalanceDisplaySchema, CurrencyBalanceDisplaySchema, GroupDataSchema, GroupDocument} from '../schemas';
import {BalanceCalculationService} from './balance';
import {DOCUMENT_CONFIG, FIRESTORE} from '../constants';
import {logger, LoggerContext} from '../logger';
import {assertTimestamp, assertTimestampAndConvert, createOptimisticTimestamp, createTrueServerTimestamp, getRelativeTime, parseISOToTimestamp, timestampToISO} from '../utils/dateHelpers';
import {PermissionEngine} from '../permissions';
import {measureDb} from '../monitoring/measure';
import type {IFirestoreReader} from './firestore';
import type {IFirestoreWriter} from './firestore';
import type {BalanceCalculationResult} from './balance';
import type {UserProfile} from './UserService2';
import type {ExpenseDocument} from '../schemas';
import type {SettlementDocument} from '../schemas';
import {ExpenseMetadataService} from './expenseMetadataService';
import {UserService} from './UserService2';
import {ExpenseService} from './ExpenseService';
import {SettlementService} from './SettlementService';
import {GroupMemberService} from './GroupMemberService';
import {NotificationService} from './notification-service';
import {GroupShareService} from './GroupShareService';
import {createTopLevelMembershipDocument, getTopLevelMembershipDocId} from '../utils/groupMembershipHelpers';
import type {UserNotificationGroup} from '../schemas/user-notifications';
import {CreateGroupRequestBuilder} from "@splitifyd/test-support";

/**
 * Enhanced types for group data fetching with groupId
 */
type ExpenseWithGroupId = ExpenseDocument & { groupId: string };
type SettlementWithGroupId = SettlementDocument & { groupId: string };

/**
 * Service for managing group operations
 */
export class GroupService {
    private balanceService: BalanceCalculationService;

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly expenseService: ExpenseService,
        private readonly settlementService: SettlementService,
        private readonly groupMemberService: GroupMemberService,
        private readonly notificationService: NotificationService,
        private readonly expenseMetadataService: ExpenseMetadataService,
        private readonly groupShareService: GroupShareService,
    ) {
        this.balanceService = new BalanceCalculationService(firestoreReader, userService);
    }

    /**
     * Add computed fields to Group (balance, last activity)
     */
    private async addComputedFields(group: Group, userId: string): Promise<Group> {
        // Calculate real balance for the user
        const groupBalances = await this.balanceService.calculateGroupBalances(group.id);

        // Validate the balance calculation result for type safety
        const validatedBalances = BalanceCalculationResultSchema.parse(groupBalances);

        // Calculate expense metadata on-demand
        // TODO: Update ExpenseMetadata interface to include lastExpenseTime
        const expenseMetadata = await this.expenseMetadataService.calculateExpenseMetadata(group.id);

        // Calculate currency-specific balances with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: string;
                netBalance: number;
                totalOwed: number;
                totalOwing: number;
            }
        > = {};

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
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ group: Group }> {
        const groupData = await this.firestoreReader.getGroup(groupId);

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        // Convert GroupDocument to Group format (the reader returns validated data)
        const group: Group = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: assertTimestampAndConvert(groupData.createdAt, 'createdAt'),
            updatedAt: assertTimestampAndConvert(groupData.updatedAt, 'updatedAt'),
            securityPreset: groupData.securityPreset!,
            presetAppliedAt: groupData.presetAppliedAt ? assertTimestampAndConvert(groupData.presetAppliedAt, 'presetAppliedAt') : undefined,
            permissions: groupData.permissions as any,
        };

        // Check if user is the owner
        if (await this.groupMemberService.isGroupOwnerAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { group: groupWithComputed };
        }

        // For write operations, only the owner is allowed
        if (requireWriteAccess) {
            throw Errors.FORBIDDEN();
        }

        // For read operations, check if user is a member
        if (await this.groupMemberService.isGroupMemberAsync(group.id, userId)) {
            const groupWithComputed = await this.addComputedFields(group, userId);
            return { group: groupWithComputed };
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
        expensesByGroup: Map<string, ExpenseWithGroupId[]>;
        settlementsByGroup: Map<string, SettlementWithGroupId[]>;
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

        // Batch fetch all expenses and settlements for all groups using FirestoreReader
        const expenseQueries = chunks.map(async (chunk) => {
            const allExpenses = [];
            for (const groupId of chunk) {
                const expenses = await this.firestoreReader.getExpensesForGroup(groupId);
                allExpenses.push(...expenses.map((expense) => ({ ...expense, groupId })));
            }
            return allExpenses;
        });

        const settlementQueries = chunks.map(async (chunk) => {
            const allSettlements = [];
            for (const groupId of chunk) {
                const settlements = await this.firestoreReader.getSettlementsForGroup(groupId);
                allSettlements.push(...settlements.map((settlement) => ({ ...settlement, groupId })));
            }
            return allSettlements;
        });

        // Execute all queries in parallel
        const [expenseResults, settlementResults] = await Promise.all([Promise.all(expenseQueries), Promise.all(settlementQueries)]);

        // Organize expenses by group ID
        const expensesByGroup = new Map<string, ExpenseWithGroupId[]>();
        const expenseMetadataByGroup = new Map<string, { count: number; lastExpenseTime?: Date }>();

        for (const expenseArray of expenseResults) {
            for (const expense of expenseArray) {
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
                // Assert that all createdAt fields are Timestamps - enforced by FirestoreReader
                const aTimestamp = assertTimestamp(a.createdAt, 'expense.createdAt');
                const bTimestamp = assertTimestamp(b.createdAt, 'expense.createdAt');
                return bTimestamp.toMillis() - aTimestamp.toMillis(); // DESC order
            });

            expenseMetadataByGroup.set(groupId, {
                count: nonDeletedExpenses.length,
                lastExpenseTime: sortedExpenses.length > 0 ? assertTimestamp(sortedExpenses[0].createdAt, 'expense.createdAt').toDate() : undefined,
            });
        }

        // Set empty metadata for groups with no expenses
        for (const groupId of groupIds) {
            if (!expenseMetadataByGroup.has(groupId)) {
                expenseMetadataByGroup.set(groupId, { count: 0 });
            }
        }

        // Organize settlements by group ID
        const settlementsByGroup = new Map<string, SettlementWithGroupId[]>();
        for (const settlementArray of settlementResults) {
            for (const settlement of settlementArray) {
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
        return measureDb('listGroups', async () => this._listGroups(userId, options));
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
        return measureDb('list-groups', async () => {
            return this._executeListGroups(userId, options);
        });
    }

    private async _executeListGroups(
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            order?: 'asc' | 'desc';
            includeMetadata?: boolean;
        } = {},
    ): Promise<ListGroupsResponse> {
        // Parse options with defaults
        const limit = Math.min(options.limit || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const cursor = options.cursor;
        const order = options.order ?? 'desc';
        const includeMetadata = options.includeMetadata === true;

        // Step 1: Query groups and metadata using FirestoreReader
        const { paginatedGroups } = await (async () => {
            // Get groups for user using V2 implementation (top-level collection)
            // This provides proper database-level ordering and fixes pagination issues
            const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, {
                limit: limit, // Use actual limit, FirestoreReader handles the +1 for hasMore detection
                cursor: cursor,
                orderBy: {
                    field: 'updatedAt',
                    direction: order,
                },
            });

            // Note: recentGroupChanges removed as GROUP_CHANGES collection was unused
            return {
                paginatedGroups,
            };
        })();

        // Step 2: Process group documents
        const { groups, groupIds } = await (async () => {
            // Extract groups data from paginated result
            const groupsData = paginatedGroups.data;

            // FirestoreReader already handled pagination, use all returned groups
            const returnedGroups = groupsData;

            // Convert GroupDocument to Group format (the reader returns validated data)
            const groups: Group[] = returnedGroups.map((groupData: any) => ({
                id: groupData.id,
                name: groupData.name,
                description: groupData.description,
                createdBy: groupData.createdBy,
                createdAt: assertTimestampAndConvert(groupData.createdAt, 'createdAt'),
                updatedAt: assertTimestampAndConvert(groupData.updatedAt, 'updatedAt'),
                securityPreset: groupData.securityPreset!,
                presetAppliedAt: groupData.presetAppliedAt ? assertTimestampAndConvert(groupData.presetAppliedAt, 'presetAppliedAt') : undefined,
                permissions: groupData.permissions as any,
            }));
            const groupIds = groups.map((group) => group.id);

            return { groups, groupIds };
        })();

        // Step 3: Batch fetch group data
        const { expenseMetadataByGroup } = await (async () => {
            // 🚀 PERFORMANCE FIX: Batch fetch all data for all groups in 3 queries instead of N×4
            return this.batchFetchGroupData(groupIds);
        })();

        // Step 4: Batch fetch user profiles and create member mapping
        const { allMemberProfiles, membersByGroup } = await (async () => {
            // Batch fetch user profiles for all members across all groups
            const allMemberIds = new Set<string>();
            const membersByGroup = new Map<string, string[]>();

            // Fetch members for each group
            const memberPromises = groups.map((group: Group) => this.groupMemberService.getAllGroupMembers(group.id));
            const membersArrays = await Promise.all(memberPromises);

            // Collect all member IDs and create mapping
            groups.forEach((group: Group, index: number) => {
                const memberDocs = membersArrays[index];
                const memberIds = memberDocs.map((memberDoc: GroupMemberDocument) => memberDoc.userId);
                membersByGroup.set(group.id, memberIds);
                memberIds.forEach((memberId: string) => allMemberIds.add(memberId));
            });

            const allMemberProfiles = await this.userService.getUsers(Array.from(allMemberIds));

            return { allMemberProfiles, membersByGroup };
        })();

        // Step 5: Calculate balances for groups with expenses
        const balanceMap = await (async () => {
            // Calculate balances for groups that have expenses
            const groupsWithExpenses = groups.filter((group: Group) => {
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };
                return expenseMetadata.count > 0;
            });

            const balancePromises = groupsWithExpenses.map((group: Group) =>
                this.balanceService.calculateGroupBalances(group.id).catch((error: Error) => {
                    logger.error('Error calculating balances', error, { groupId: group.id });
                    return {
                        groupId: group.id,
                        balancesByCurrency: {},
                        userBalances: {},
                        simplifiedDebts: [],
                        lastUpdated: new Date().toISOString(),
                    };
                }),
            );

            const balanceResults = await Promise.all(balancePromises);
            const balanceMap = new Map<string, BalanceCalculationResult>();
            groupsWithExpenses.forEach((group: Group, index: number) => {
                balanceMap.set(group.id, balanceResults[index]);
            });

            return balanceMap;
        })();

        // Step 6: Process each group using batched data - no more database calls!
        const groupsWithBalances: Group[] = await (async () => {
            return groups.map((group: Group) => {
                // Get pre-fetched data for this group (no database calls)
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };

                // Get member profiles for this group
                const memberIds = membersByGroup.get(group.id) || [];
                const memberProfiles = new Map<string, UserProfile>();
                for (const memberId of memberIds) {
                    const profile = allMemberProfiles.get(memberId);
                    if (profile) {
                        memberProfiles.set(memberId, profile);
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
                const balancesByCurrency: Record<
                    string,
                    {
                        currency: string;
                        netBalance: number;
                        totalOwed: number;
                        totalOwing: number;
                    }
                > = {};

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
                // expenseMetadata.lastExpenseTime is Date | undefined, group.updatedAt is ISO string
                const lastActivityDate = expenseMetadata.lastExpenseTime ?? new Date(group.updatedAt);
                let lastActivity: string;
                let lastActivityRaw: string;

                try {
                    // lastActivityDate should always be a Date at this point
                    if (!(lastActivityDate instanceof Date) || isNaN(lastActivityDate.getTime())) {
                        throw new Error(`Expected valid Date for lastActivityDate but got ${typeof lastActivityDate}`);
                    }

                    lastActivityRaw = lastActivityDate.toISOString();
                    lastActivity = this.formatRelativeTime(lastActivityRaw);
                } catch (error) {
                    logger.warn('Failed to format last activity time, using group updatedAt', {
                        error,
                        lastActivityDate,
                        groupId: group.id,
                    });
                    lastActivityRaw = group.updatedAt;
                    lastActivity = this.formatRelativeTime(group.updatedAt);
                }

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
                    lastActivityRaw,
                };
            });
        })();

        // Step 7: Generate pagination and response
        return await (async () => {
            // Use pagination information from FirestoreReader
            const hasMore = paginatedGroups.hasMore;
            const nextCursor = paginatedGroups.nextCursor;

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

            // Metadata functionality removed as GROUP_CHANGES collection was unused

            return response;
        })();
    }

    /**
     * Create a new group with the creator as the owner/admin
     * IMPORTANT: The creator is automatically added as a member with 'owner' role
     */
    async createGroup(userId: string, groupData: CreateGroupRequest = new CreateGroupRequestBuilder().build()): Promise<Group> {
        return measureDb('createGroup', async () => this._createGroup(userId, groupData));
    }

    private async _createGroup(userId: string, createGroupRequest: CreateGroupRequest): Promise<Group> {
        // Initialize group structure with server timestamps
        const groupId = this.firestoreWriter.generateDocumentId(FirestoreCollections.GROUPS);
        const serverTimestamp = createTrueServerTimestamp();
        const now = createOptimisticTimestamp();

        // Create the document to write with server timestamps (for Firestore)
        const documentToWrite = {
            id: groupId,
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            createdAt: serverTimestamp,
            updatedAt: serverTimestamp,
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: serverTimestamp,
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Create the response object with ISO strings (for API responses)
        const newGroup: Group = {
            id: groupId,
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: timestampToISO(now),
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        try {
            GroupDataSchema.parse(newGroup);
        } catch (error) {
            logger.error('Invalid group document to write', error as Error, {
                groupId: groupId,
                userId,
            });
            throw Errors.INVALID_INPUT();
        }

        // Pre-calculate member data outside transaction for speed

        const memberDoc: GroupMemberDocument = {
            userId: userId,
            groupId: groupId,
            memberRole: MemberRoles.ADMIN,
            theme: this.groupShareService.getThemeColorForMember(0),
            joinedAt: now.toDate().toISOString(),
            memberStatus: MemberStatuses.ACTIVE,
        };

        const memberServerTimestamp = createTrueServerTimestamp();
        const memberDocWithTimestamps = {
            ...memberDoc,
            createdAt: memberServerTimestamp,
            updatedAt: memberServerTimestamp,
        };

        // Pre-calculate notification group data outside transaction for speed
        const notificationGroupData: UserNotificationGroup = {
            lastTransactionChange: null,
            lastBalanceChange: null,
            lastGroupDetailsChange: FieldValue.serverTimestamp(), // User is creating the group
            transactionChangeCount: 0,
            balanceChangeCount: 0,
            groupDetailsChangeCount: 1, // Set to 1 because the user is creating the group
        };

        // Atomic transaction: create group, member, and notification documents
        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUPS, groupId, documentToWrite);

            // Write to top-level collection for improved querying
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, getTopLevelMembershipDocId(userId, groupId), {
                ...(createTopLevelMembershipDocument(memberDoc, timestampToISO(now))),
                createdAt: memberServerTimestamp,
                updatedAt: memberServerTimestamp,
            });

            // Initialize group notifications for creator atomically
            this.firestoreWriter.setUserNotificationGroupInTransaction(transaction, userId, groupId, notificationGroupData);
        });

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: groupId });

        // Fetch the created document to get server-side timestamps
        const groupData = await this.firestoreReader.getGroup(groupId);
        if (!groupData) {
            throw new Error('Failed to fetch created group');
        }

        // Convert GroupDocument to Group format
        const group: Group = {
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            createdBy: groupData.createdBy,
            createdAt: assertTimestampAndConvert(groupData.createdAt, 'createdAt'),
            updatedAt: assertTimestampAndConvert(groupData.updatedAt, 'updatedAt'),
            securityPreset: groupData.securityPreset!,
            presetAppliedAt: groupData.presetAppliedAt ? assertTimestampAndConvert(groupData.presetAppliedAt, 'presetAppliedAt') : undefined,
            permissions: groupData.permissions as any,
        };

        // Add computed fields before returning
        return await this.addComputedFields(group, userId);
    }

    /**
     * Update an existing group
     * Only the owner can update a group
     */
    async updateGroup(groupId: string, userId: string, updates: UpdateGroupRequest): Promise<MessageResponse> {
        // Fetch group with write access check
        const { group } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Update with optimistic locking and transaction retry logic
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // IMPORTANT: All reads must happen before any writes in Firestore transactions

            // PHASE 1: ALL READS FIRST
            const freshDoc = await this.firestoreReader.getRawGroupDocumentInTransaction(transaction, groupId);
            if (!freshDoc) {
                throw Errors.NOT_FOUND('Group');
            }

            // Read membership documents that need updating
            const membershipSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);

            // Optimistic locking validation could use originalUpdatedAt if needed
            // const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data());

            // Create updated data with current timestamp (will be converted to ISO in the data field)
            const now = createOptimisticTimestamp();
            const updatedData = {
                ...group,
                ...updates,
                updatedAt: now.toDate(),
            };

            // PHASE 2: ALL WRITES AFTER ALL READS
            // Update group document using FirestoreWriter
            const documentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                name: updatedData.name,
                description: updatedData.description,
                updatedAt: updatedData.updatedAt,
            });

            // Update denormalized groupUpdatedAt in all membership documents
            membershipSnapshot.docs.forEach((doc) => {
                transaction.update(doc.ref, {
                    groupUpdatedAt: updatedData.updatedAt.toISOString(),
                    updatedAt: createTrueServerTimestamp(),
                });
            });
        });

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-updated', { id: groupId });

        return { message: 'Group updated successfully' };
    }

    /**
     * Permanently delete a group and ALL associated data (hard delete)
     * Only the owner can delete a group
     * This is a destructive operation that cannot be undone
     */
    /**
     * Mark a group as "deleting" to prevent concurrent operations
     * @param groupId - The ID of the group to mark for deletion
     * @returns Promise<void>
     */
    private async markGroupForDeletion(groupId: string): Promise<void> {
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
                const groupSnap = await transaction.get(groupRef);

                if (!groupSnap.exists) {
                    throw new Error(`Group ${groupId} not found`);
                }

                const groupData = groupSnap.data();

                // Check if already deleting
                if (groupData?.deletionStatus === 'deleting') {
                    logger.warn('Group is already marked for deletion', { groupId });
                    throw new Error('Group deletion is already in progress');
                }

                // Check if deletion failed and we've exceeded max attempts
                if (groupData?.deletionStatus === 'failed' && (groupData?.deletionAttempts || 0) >= FIRESTORE.MAX_DELETION_ATTEMPTS) {
                    throw new Error(`Group deletion has failed ${FIRESTORE.MAX_DELETION_ATTEMPTS} times. Manual intervention required.`);
                }

                // Mark for deletion
                const updatedData: Partial<GroupDocument> = {
                    deletionStatus: 'deleting' as const,
                    deletionStartedAt: Timestamp.now(),
                    deletionAttempts: (groupData?.deletionAttempts || 0) + 1,
                    updatedAt: Timestamp.now(),
                };

                transaction.update(groupRef, updatedData);

                logger.info('Group marked for deletion', {
                    groupId,
                    attempt: updatedData.deletionAttempts,
                });
            },
            {
                maxAttempts: 3,
                context: { operation: 'markGroupForDeletion', groupId },
            },
        );
    }

    /**
     * Delete a batch of documents atomically
     * @param collectionType - Type of collection being deleted (for logging)
     * @param groupId - The group ID for logging context
     * @param documentPaths - Array of document paths to delete
     * @returns Promise<void>
     */
    private async deleteBatch(collectionType: string, groupId: string, documentPaths: string[]): Promise<void> {
        if (documentPaths.length === 0) {
            logger.info('No documents to delete for collection type', { collectionType, groupId });
            return;
        }

        // Split into chunks respecting Firestore transaction limits
        const chunks = [];
        for (let i = 0; i < documentPaths.length; i += FIRESTORE.DELETION_BATCH_SIZE) {
            chunks.push(documentPaths.slice(i, i + FIRESTORE.DELETION_BATCH_SIZE));
        }

        logger.info('Deleting documents in batches', {
            collectionType,
            groupId,
            totalDocuments: documentPaths.length,
            batchCount: chunks.length,
            batchSize: FIRESTORE.DELETION_BATCH_SIZE,
        });

        // Process each chunk in its own transaction
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const batchNumber = i + 1;

            try {
                await this.firestoreWriter.runTransaction(
                    async (transaction) => {
                        logger.info('Processing deletion batch', {
                            collectionType,
                            groupId,
                            batchNumber,
                            batchSize: chunk.length,
                            totalBatches: chunks.length,
                        });

                        this.firestoreWriter.bulkDeleteInTransaction(transaction, chunk);
                    },
                    {
                        maxAttempts: 3,
                        context: {
                            operation: 'deleteBatch',
                            groupId,
                            collectionType,
                            batchNumber,
                            batchSize: chunk.length,
                        },
                    },
                );

                logger.info('Deletion batch completed successfully', {
                    collectionType,
                    groupId,
                    batchNumber,
                    batchSize: chunk.length,
                });
            } catch (error) {
                logger.error('Deletion batch failed', {
                    collectionType,
                    groupId,
                    batchNumber,
                    batchSize: chunk.length,
                    error: error instanceof Error ? error.message : String(error),
                });

                // Mark group as failed and rethrow
                await this.markGroupDeletionFailed(groupId, error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
    }

    /**
     * Mark a group deletion as failed
     * @param groupId - The group ID
     * @param errorMessage - The error that caused the failure
     */
    private async markGroupDeletionFailed(groupId: string, errorMessage: string): Promise<void> {
        try {
            await this.firestoreWriter.runTransaction(
                async (transaction) => {
                    const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
                    const groupSnap = await transaction.get(groupRef);

                    if (groupSnap.exists) {
                        transaction.update(groupRef, {
                            deletionStatus: 'failed' as const,
                            updatedAt: Timestamp.now(),
                        });
                    }
                },
                {
                    maxAttempts: 3,
                    context: { operation: 'markGroupDeletionFailed', groupId },
                },
            );

            logger.error('Group deletion marked as failed', { groupId, errorMessage });
        } catch (markError) {
            logger.error('Failed to mark group deletion as failed', {
                groupId,
                originalError: errorMessage,
                markError: markError instanceof Error ? markError.message : String(markError),
            });
        }
    }

    /**
     * Finalize group deletion by removing the main group document
     * @param groupId - The group ID to finalize deletion for
     * @returns Promise<void>
     */
    private async finalizeGroupDeletion(groupId: string): Promise<void> {
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
                const groupSnap = await transaction.get(groupRef);

                if (!groupSnap.exists) {
                    logger.warn('Group document not found during finalization', { groupId });
                    return;
                }

                const groupData = groupSnap.data();

                // Verify group is marked for deletion
                if (groupData?.deletionStatus !== 'deleting') {
                    throw new Error(`Group ${groupId} is not marked for deletion. Current status: ${groupData?.deletionStatus || 'none'}`);
                }

                // Delete the main group document
                transaction.delete(groupRef);

                logger.info('Group document deleted successfully', { groupId });
            },
            {
                maxAttempts: 3,
                context: { operation: 'finalizeGroupDeletion', groupId },
            },
        );
    }

    async deleteGroup(groupId: string, userId: string): Promise<MessageResponse> {
        // Fetch group with write access check
        const { group } = await this.fetchGroupWithAccess(groupId, userId, true);

        // Get member list BEFORE deletion for change tracking
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);
        const memberIds = memberDocs ? memberDocs.map((doc) => doc.userId) : [];

        logger.info('Initiating atomic group deletion', {
            groupId,
            memberCount: memberIds.length,
            members: memberIds,
            operation: 'ATOMIC_DELETE',
        });

        try {
            // PHASE 1: Mark group for deletion (atomic)
            logger.info('Step 1: Marking group for deletion', { groupId });
            await this.markGroupForDeletion(groupId);

            // PHASE 2: Discover all related data
            logger.info('Step 2: Discovering all related data', { groupId });
            const { expenses, settlements, shareLinks, groupComments, expenseComments: expenseCommentSnapshots } = await this.firestoreReader.getGroupDeletionData(groupId);

            // Calculate total documents for logging
            const totalDocuments =
                expenses.size + settlements.size + shareLinks.size + groupComments.size + (memberDocs?.length || 0) + expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);

            logger.info('Data discovery complete', {
                groupId,
                totalDocuments,
                breakdown: {
                    expenses: expenses.size,
                    settlements: settlements.size,
                    shareLinks: shareLinks.size,
                    groupComments: groupComments.size,
                    members: memberDocs?.length || 0,
                    expenseComments: expenseCommentSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0),
                },
            });

            // PHASE 3: Delete collections in atomic batches
            // Note: Notification cleanup now happens automatically via membership deletion triggers
            logger.info('Step 3: Deleting collections atomically', { groupId });

            // Delete expenses
            const expensePaths = expenses.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('expenses', groupId, expensePaths);

            // Delete settlements
            const settlementPaths = settlements.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('settlements', groupId, settlementPaths);

            // Delete share links
            const shareLinkPaths = shareLinks.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('share-links', groupId, shareLinkPaths);

            // Delete group comments
            const groupCommentPaths = groupComments.docs.map((doc) => doc.ref.path);
            await this.deleteBatch('group-comments', groupId, groupCommentPaths);

            // Delete expense comments
            const expenseCommentPaths: string[] = [];
            expenseCommentSnapshots.forEach((snapshot) => {
                snapshot.docs.forEach((doc) => expenseCommentPaths.push(doc.ref.path));
            });
            await this.deleteBatch('expense-comments', groupId, expenseCommentPaths);

            // Delete memberships from top-level collection
            const membershipPaths: string[] = [];
            if (memberDocs) {
                memberDocs.forEach((memberDoc) => {
                    const topLevelDocId = getTopLevelMembershipDocId(memberDoc.userId, groupId);
                    const topLevelPath = `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`;
                    membershipPaths.push(topLevelPath);
                });
            }
            await this.deleteBatch('memberships', groupId, membershipPaths);

            // PHASE 4: Finalize by deleting main group document (atomic)
            logger.info('Step 4: Finalizing group deletion', { groupId });
            await this.finalizeGroupDeletion(groupId);

            // Set group context
            LoggerContext.setBusinessContext({ groupId });

            logger.info('Atomic group deletion completed successfully', {
                groupId,
                totalDocuments,
                operation: 'ATOMIC_DELETE_SUCCESS',
            });

            return { message: 'Group and all associated data deleted permanently' };
        } catch (error) {
            logger.error('Atomic group deletion failed', {
                groupId,
                error: error instanceof Error ? error.message : String(error),
                operation: 'ATOMIC_DELETE_FAILED',
            });

            // The markGroupDeletionFailed method is called within deleteBatch if needed
            // Group will remain marked as 'failed' for manual intervention
            throw error;
        }
    }

    /**
     * Find groups that are stuck in 'deleting' status for recovery
     * @param olderThanMinutes - Find groups that have been deleting for longer than this many minutes
     * @returns Array of group IDs that may need recovery
     */
    async findStuckDeletions(olderThanMinutes: number = 30): Promise<string[]> {
        const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        const cutoffTimestamp = Timestamp.fromDate(cutoffTime);

        try {
            const stuckGroupIds = await this.firestoreWriter.queryGroupsByDeletionStatus('deleting', cutoffTimestamp, '<=');

            logger.warn('Found groups stuck in deleting status', {
                count: stuckGroupIds.length,
                groupIds: stuckGroupIds,
                olderThanMinutes,
                operation: 'findStuckDeletions',
            });

            return stuckGroupIds;
        } catch (error) {
            logger.error('Failed to find stuck deletions', {
                error: error instanceof Error ? error.message : String(error),
                olderThanMinutes,
            });
            return [];
        }
    }

    /**
     * Recovery method to retry or clean up failed group deletions
     * @param groupId - The group ID to recover
     * @param forceCleanup - If true, marks as failed instead of retrying
     * @returns Recovery result
     */
    async recoverFailedDeletion(
        groupId: string,
        forceCleanup: boolean = false,
    ): Promise<{
        success: boolean;
        action: 'retried' | 'marked_failed' | 'not_found' | 'completed';
        message: string;
    }> {
        try {
            const groupDoc = await this.firestoreWriter.getSingleDocument(FirestoreCollections.GROUPS, groupId);

            if (!groupDoc || !groupDoc.exists) {
                return {
                    success: true,
                    action: 'completed',
                    message: 'Group no longer exists - deletion completed',
                };
            }

            const groupData = groupDoc.data();

            if (groupData?.deletionStatus !== 'deleting') {
                return {
                    success: false,
                    action: 'not_found',
                    message: `Group is not in deleting status. Current status: ${groupData?.deletionStatus || 'none'}`,
                };
            }

            const attempts = groupData?.deletionAttempts || 0;

            if (forceCleanup || attempts >= FIRESTORE.MAX_DELETION_ATTEMPTS) {
                // Mark as failed for manual intervention
                await this.markGroupDeletionFailed(groupId, 'Recovery: Maximum attempts exceeded or forced cleanup');

                logger.warn('Group deletion marked as failed during recovery', {
                    groupId,
                    attempts,
                    forceCleanup,
                    operation: 'recoverFailedDeletion',
                });

                return {
                    success: true,
                    action: 'marked_failed',
                    message: `Group marked as failed after ${attempts} attempts`,
                };
            } else {
                // Reset deletion status to allow retry
                await this.firestoreWriter.runTransaction(
                    async (transaction) => {
                        const groupRef = this.firestoreWriter.getDocumentReferenceInTransaction(transaction, FirestoreCollections.GROUPS, groupId);
                        const freshDoc = await transaction.get(groupRef);
                        if (freshDoc.exists) {
                            transaction.update(freshDoc.ref, {
                                deletionStatus: undefined,
                                deletionStartedAt: undefined,
                                updatedAt: Timestamp.now(),
                            });
                        }
                    },
                    {
                        maxAttempts: 3,
                        context: { operation: 'recoverFailedDeletion', groupId },
                    },
                );

                logger.info('Group deletion status reset for retry', {
                    groupId,
                    previousAttempts: attempts,
                    operation: 'recoverFailedDeletion',
                });

                return {
                    success: true,
                    action: 'retried',
                    message: `Group deletion reset for retry (was attempt ${attempts})`,
                };
            }
        } catch (error) {
            logger.error('Failed to recover group deletion', {
                groupId,
                error: error instanceof Error ? error.message : String(error),
                operation: 'recoverFailedDeletion',
            });

            return {
                success: false,
                action: 'not_found',
                message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Get detailed status of group deletion process
     * @param groupId - The group ID to check
     * @returns Deletion status information
     */
    async getDeletionStatus(groupId: string): Promise<{
        exists: boolean;
        status: 'none' | 'deleting' | 'failed';
        startedAt?: string;
        attempts?: number;
        canRetry: boolean;
        message: string;
    }> {
        try {
            const groupDoc = await this.firestoreWriter.getSingleDocument(FirestoreCollections.GROUPS, groupId);

            if (!groupDoc || !groupDoc.exists) {
                return {
                    exists: false,
                    status: 'none',
                    canRetry: false,
                    message: 'Group does not exist - may have been successfully deleted',
                };
            }

            const groupData = groupDoc.data();
            const deletionStatus = groupData?.deletionStatus;
            const startedAt = groupData?.deletionStartedAt;
            const attempts = groupData?.deletionAttempts || 0;

            if (!deletionStatus) {
                return {
                    exists: true,
                    status: 'none',
                    canRetry: true,
                    message: 'Group is not being deleted',
                };
            }

            const canRetry = deletionStatus === 'failed' || attempts < FIRESTORE.MAX_DELETION_ATTEMPTS;
            const statusMessage = deletionStatus === 'deleting' ? `Deletion in progress (attempt ${attempts})` : `Deletion failed after ${attempts} attempts`;

            return {
                exists: true,
                status: deletionStatus,
                startedAt: startedAt?.toDate().toISOString(),
                attempts,
                canRetry,
                message: statusMessage,
            };
        } catch (error) {
            logger.error('Failed to get deletion status', {
                groupId,
                error: error instanceof Error ? error.message : String(error),
            });

            return {
                exists: false,
                status: 'none',
                canRetry: false,
                message: `Failed to check status: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * Get group balances for a user
     * Returns simplified debts and balance information
     */
    async getGroupBalances(
        groupId: string,
        userId: string,
    ): Promise<{
        groupId: string;
        userBalances: any;
        simplifiedDebts: any;
        lastUpdated: string;
        balancesByCurrency: Record<string, any>;
    }> {
        return measureDb('getGroupBalances', async () => this._getGroupBalances(groupId, userId));
    }

    private async _getGroupBalances(
        groupId: string,
        userId: string,
    ): Promise<{
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

        const groupData = await this.firestoreReader.getGroup(groupId);

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        // The reader already returns validated data
        const validatedGroup = groupData;

        // Validate user access using scalable membership check
        const membersData = await this.userService.getUsers([userId]);
        if (!membersData.has(userId)) {
            throw Errors.FORBIDDEN();
        }

        // Check if user is a member using the async helper
        if (!(await this.groupMemberService.isGroupMemberAsync(groupId, userId))) {
            throw Errors.FORBIDDEN();
        }

        // Always calculate balances on-demand for accurate data
        const balances = await this.balanceService.calculateGroupBalances(groupId);

        return {
            groupId: balances.groupId,
            userBalances: balances.userBalances,
            simplifiedDebts: balances.simplifiedDebts,
            lastUpdated: balances.lastUpdated,
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
        } = {},
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
            // Get members using service layer
            this.userService.getGroupMembersResponseFromSubcollection(groupId),

            // Get expenses using service layer with pagination
            this.expenseService.listGroupExpenses(groupId, userId, {
                limit: expenseLimit,
                cursor: options.expenseCursor,
            }),

            // Get balances using existing calculator
            this.balanceService.calculateGroupBalances(groupId),

            // Get settlements using service layer with pagination
            this.settlementService.listSettlements(groupId, userId, {
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
