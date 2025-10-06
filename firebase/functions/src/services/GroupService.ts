import { Errors } from '../utils/errors';
import {
    GroupDTO,
    UpdateGroupRequest,
    CreateGroupRequest,
    DELETED_AT_FIELD,
    ListGroupsResponse,
    MemberRoles,
    MemberStatuses,
    MessageResponse,
    SecurityPresets,
    ExpenseDTO,
    SettlementDTO,
    GroupFullDetailsDTO,
} from '@splitifyd/shared';
import { BalanceDisplaySchema, CurrencyBalanceDisplaySchema, GroupBalanceDTO } from '../schemas';
import { DOCUMENT_CONFIG, FIRESTORE } from '../constants';
import { logger, LoggerContext } from '../logger';
import * as dateHelpers from '../utils/dateHelpers';
import { PermissionEngine } from '../permissions';
import * as measure from '../monitoring/measure';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import type { BalanceCalculationResult } from './balance';
import type { RegisteredUser } from '@splitifyd/shared';
import { UserService } from './UserService2';
import { ExpenseService } from './ExpenseService';
import { SettlementService } from './SettlementService';
import { GroupMemberService } from './GroupMemberService';
import { NotificationService } from './notification-service';
import { GroupShareService } from './GroupShareService';
import { getTopLevelMembershipDocId } from '../utils/groupMembershipHelpers';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '../constants';

/**
 * Enhanced types for group data fetching with groupId
 * Note: ExpenseDTO and SettlementDTO already have groupId, so these types are redundant
 * but kept for backwards compatibility during refactoring
 */
type ExpenseWithGroupId = ExpenseDTO & { groupId: string };
type SettlementWithGroupId = SettlementDTO & { groupId: string };

/**
 * Service for managing group operations
 */
export class GroupService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly userService: UserService,
        private readonly expenseService: ExpenseService,
        private readonly settlementService: SettlementService,
        private readonly groupMemberService: GroupMemberService,
        private readonly notificationService: NotificationService,
        private readonly groupShareService: GroupShareService,
    ) {}

    /**
     * Add computed fields to Group (balance, last activity)
     * Now reads pre-computed balance from Firestore instead of calculating on-the-fly
     */
    private async addComputedFields(group: GroupDTO, userId: string): Promise<GroupDTO> {
        // Read pre-computed balance from Firestore (O(1) read vs O(N) calculation)
        const groupBalance = await this.firestoreReader.getGroupBalance(group.id);

        // Use group.updatedAt for last activity (updated by touchGroup() on any group activity)
        const lastActivity = this.formatRelativeTime(group.updatedAt);

        // Calculate currency-specific balances for current user with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: string;
                netBalance: number;
                totalOwed: number;
                totalOwing: number;
            }
        > = {};

        if (groupBalance.balancesByCurrency) {
            for (const [currency, currencyBalances] of Object.entries(groupBalance.balancesByCurrency)) {
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
            lastActivity,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(groupId: string, userId: string, requireWriteAccess: boolean = false): Promise<{ group: GroupDTO }> {
        const group = await this.firestoreReader.getGroup(groupId);

        if (!group) {
            throw Errors.NOT_FOUND('Group');
        }

        // FirestoreReader already returns a GroupDTO with ISO strings - no conversion needed

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
                // Fetch all pages of expenses for this group
                let offset = 0;
                const limit = 500;
                while (true) {
                    const expenses = await this.firestoreReader.getExpensesForGroup(groupId, { limit, offset });
                    allExpenses.push(...expenses.map((expense) => ({ ...expense, groupId })));
                    if (expenses.length < limit) break;
                    offset += limit;
                }
            }
            return allExpenses;
        });

        const settlementQueries = chunks.map(async (chunk) => {
            const allSettlements = [];
            for (const groupId of chunk) {
                // Fetch all pages of settlements for this group
                let offset = 0;
                const limit = 500;
                while (true) {
                    const result = await this.firestoreReader.getSettlementsForGroup(groupId, { limit, offset });
                    allSettlements.push(...result.settlements.map((settlement) => ({ ...settlement, groupId })));
                    if (result.settlements.length < limit) break;
                    offset += limit;
                }
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
                // ISO strings are directly comparable (lexicographic ordering matches chronological for ISO 8601)
                // Sort DESC (newest first)
                return b.createdAt.localeCompare(a.createdAt);
            });

            expenseMetadataByGroup.set(groupId, {
                count: nonDeletedExpenses.length,
                lastExpenseTime: sortedExpenses.length > 0 ? new Date(sortedExpenses[0].createdAt) : undefined,
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
        const timestamp = dateHelpers.parseISOToTimestamp(dateStr);
        if (!timestamp) {
            return 'unknown';
        }
        return dateHelpers.getRelativeTime(timestamp);
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
        return measure.measureDb('listGroups', async () => this._listGroups(userId, options));
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
        return measure.measureDb('list-groups', async () => {
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
            // groupsData is already GroupDTO[] with ISO strings - no conversion needed
            const groups = groupsData;
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
            await Promise.all(groups.map(async (group: GroupDTO, index: number) => {
                const memberIds = await this.firestoreReader.getAllGroupMemberIds(group.id);
                membersByGroup.set(group.id, memberIds);
                memberIds.forEach((memberId: string) => allMemberIds.add(memberId));
            }));

            const allMemberProfiles = await this.userService.getUsers(Array.from(allMemberIds));

            return { allMemberProfiles, membersByGroup };
        })();

        // Step 5: Read pre-computed balances for all groups (O(N) reads vs O(N×M) calculations)
        const balanceMap = await (async () => {
            // Fetch pre-computed balances for all groups in parallel
            const balancePromises = groups.map((group: GroupDTO) =>
                this.firestoreReader.getGroupBalance(group.id).catch((error: Error) => {
                    logger.error('Error reading group balance', error, { groupId: group.id });
                    // Return empty balance on error (matches GroupBalanceDTO structure)
                    return {
                        groupId: group.id,
                        balancesByCurrency: {},
                        simplifiedDebts: [],
                        lastUpdatedAt: new Date().toISOString(),
                        version: 0,
                    };
                }),
            );

            const balanceResults = await Promise.all(balancePromises);
            const balanceMap = new Map<string, BalanceCalculationResult>();

            // Convert GroupBalanceDTO to BalanceCalculationResult format
            groups.forEach((group: GroupDTO, index: number) => {
                const groupBalance = balanceResults[index];
                const balanceResult: BalanceCalculationResult = {
                    groupId: groupBalance.groupId,
                    balancesByCurrency: groupBalance.balancesByCurrency,
                    simplifiedDebts: groupBalance.simplifiedDebts,
                    lastUpdated: groupBalance.lastUpdatedAt, // Map lastUpdatedAt → lastUpdated
                };
                balanceMap.set(group.id, balanceResult);
            });

            return balanceMap;
        })();

        // Step 6: Process each group using batched data - no more database calls!
        const groupsWithBalances: GroupDTO[] = await (async () => {
            return groups.map((group: GroupDTO) => {
                // Get pre-fetched data for this group (no database calls)
                const expenseMetadata = expenseMetadataByGroup.get(group.id) || { count: 0 };

                // Get member profiles for this group
                const memberIds = membersByGroup.get(group.id) || [];
                const memberProfiles = new Map<string, RegisteredUser>();
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
                    simplifiedDebts: [],
                    lastUpdated: new Date().toISOString(),
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
                    // groupBalances is already validated by GroupBalanceDTO from getGroupBalance()
                    for (const [currency, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
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

                try {
                    // lastActivityDate should always be a Date at this point
                    if (!(lastActivityDate instanceof Date) || isNaN(lastActivityDate.getTime())) {
                        throw new Error(`Expected valid Date for lastActivityDate but got ${typeof lastActivityDate}`);
                    }

                    lastActivity = this.formatRelativeTime(lastActivityDate.toISOString());
                } catch (error) {
                    logger.warn('Failed to format last activity time, using group updatedAt', {
                        error,
                        lastActivityDate,
                        groupId: group.id,
                    });
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
                    // groupBalances is already validated by GroupBalanceDTO from getGroupBalance()
                    const currencyBalancesArray = Object.values(groupBalances.balancesByCurrency);

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
    async createGroup(userId: string, groupData: CreateGroupRequest = new CreateGroupRequestBuilder().build()): Promise<GroupDTO> {
        return measure.measureDb('createGroup', async () => this._createGroup(userId, groupData));
    }

    private async _createGroup(userId: string, createGroupRequest: CreateGroupRequest): Promise<GroupDTO> {
        // Initialize group structure with ISO strings (DTOs)
        const groupId = this.firestoreWriter.generateDocumentId(FirestoreCollections.GROUPS);
        const nowISO = new Date().toISOString();

        // Create the document to write (using ISO strings - FirestoreWriter converts to Timestamps)
        const documentToWrite = {
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdBy: userId,
            createdAt: nowISO,
            updatedAt: nowISO,
            securityPreset: SecurityPresets.OPEN,
            presetAppliedAt: nowISO,
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
        };

        // Note: Validation happens in FirestoreWriter after ISO → Timestamp conversion

        // Pre-calculate member data outside transaction for speed (using ISO strings - DTOs)
        const themeColor = this.groupShareService.getThemeColorForMember(0);
        const memberDoc = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.ADMIN,
            theme: themeColor, // ISO string assignedAt
            joinedAt: nowISO,
            memberStatus: MemberStatuses.ACTIVE,
        };

        // Initialize empty group balance (no expenses/settlements yet)
        const initialBalance: GroupBalanceDTO = {
            groupId,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: nowISO,
            version: 0,
        };

        // Atomic transaction: create group, member, and balance documents
        await this.firestoreWriter.runTransaction(async (transaction) => {
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUPS, groupId, documentToWrite);

            // Write to top-level collection for improved querying
            const topLevelMemberDoc = {
                ...memberDoc,
                groupUpdatedAt: nowISO,
                createdAt: nowISO,
                updatedAt: nowISO,
            };

            // FirestoreWriter.createInTransaction handles conversion and validation
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, getTopLevelMembershipDocId(userId, groupId), topLevelMemberDoc);

            // Initialize balance document atomically with group creation
            this.firestoreWriter.setGroupBalanceInTransaction(transaction, groupId, initialBalance);

            // Note: Group notifications are handled by the trackGroupChanges trigger
            // which fires when the group document is created
        });

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: groupId });

        // Fetch the created document to get server-side timestamps
        const groupData = await this.firestoreReader.getGroup(groupId);
        if (!groupData) {
            throw new Error('Failed to fetch created group');
        }

        // groupData is already a GroupDTO with ISO strings - no conversion needed
        // Add computed fields before returning
        return await this.addComputedFields(groupData, userId);
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

            // Create updated data with current timestamp for optimistic response
            const now = new Date().toISOString();
            const updatedData = {
                ...group,
                ...updates,
                updatedAt: now,
            };

            // PHASE 2: ALL WRITES AFTER ALL READS
            // Update group document with ISO timestamp (FirestoreWriter converts to Timestamp)
            const documentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                name: updatedData.name,
                description: updatedData.description,
                updatedAt: now,
            });

            // Update denormalized groupUpdatedAt in all membership documents
            // Use the same ISO timestamp to keep them in sync
            membershipSnapshot.docs.forEach((doc) => {
                this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
                    groupUpdatedAt: now,
                    updatedAt: now,
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
                // Note: deletionStatus and deletionAttempts are internal Firestore fields not in GroupDTO
                const now = new Date().toISOString();
                const updatedData: any = {
                    deletionStatus: 'deleting' as const,
                    deletionStartedAt: now,
                    deletionAttempts: (groupData?.deletionAttempts || 0) + 1,
                    updatedAt: now,
                };

                this.firestoreWriter.updateInTransaction(transaction, groupRef.path, updatedData);

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
                        this.firestoreWriter.updateInTransaction(transaction, groupRef.path, {
                            deletionStatus: 'failed' as const,
                            updatedAt: new Date().toISOString(),
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
        await this.fetchGroupWithAccess(groupId, userId, true);

        // Get member list BEFORE deletion for change tracking
        const memberDocs = await this.firestoreReader.getAllGroupMembers(groupId);// todo: this should use getAllGroupMemberIds()
        const memberIds = memberDocs ? memberDocs.map((doc) => doc.uid) : [];

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
                    const topLevelDocId = getTopLevelMembershipDocId(memberDoc.uid, groupId);
                    const topLevelPath = `${FirestoreCollections.GROUP_MEMBERSHIPS}/${topLevelDocId}`;
                    membershipPaths.push(topLevelPath);
                });
            }
            await this.deleteBatch('memberships', groupId, membershipPaths);

            // PHASE 4: Finalize by deleting main group document (atomic)
            logger.info('Step 4: Finalizing group deletion', { groupId });
            await this.finalizeGroupDeletion(groupId);

            // PHASE 5: Clean up user notification documents (AFTER all triggers have finished)
            // Since we removed trackMembershipDeletion trigger, we need to manually clean up notifications
            logger.info('Step 5: Cleaning up user notification documents', { groupId });
            if (memberIds.length > 0) {
                const results = [];
                for (const memberId of memberIds) {
                    const result = await this.notificationService.removeUserFromGroup(memberId, groupId);
                    results.push(result);
                }
                const successfulCleanups = results.filter((r) => r.success).length;
                logger.info('Notification cleanup completed', {
                    groupId,
                    totalUsers: memberIds.length,
                    successfulCleanups,
                    failedCleanups: results.length - successfulCleanups,
                });
            }

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
    ): Promise<GroupFullDetailsDTO> {
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

            // Get pre-computed balances from Firestore (O(1) read)
            this.firestoreReader.getGroupBalance(groupId),

            // Get settlements using service layer with pagination
            this.settlementService.listSettlements(groupId, userId, {
                limit: settlementLimit,
                cursor: options.settlementCursor,
            }),
        ]);

        // balancesData is already validated GroupBalanceDTO from getGroupBalance()
        // Map lastUpdatedAt to lastUpdated for API response compatibility
        const balancesDTO = {
            ...balancesData,
            lastUpdated: balancesData.lastUpdatedAt,
            userBalances: {}, // TODO: Populate from balancesByCurrency if needed by client
        };

        // Construct response using existing patterns
        return {
            group,
            members: membersData,
            expenses: expensesData,
            balances: balancesDTO,
            settlements: settlementsData,
        };
    }
}

// ServiceRegistry handles service instantiation
