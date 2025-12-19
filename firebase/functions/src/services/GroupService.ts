import type { CurrencyISOCode, UserId } from '@billsplit-wl/shared';
import {
    ActivityFeedActions,
    ActivityFeedEventType,
    ActivityFeedEventTypes,
    Amount,
    amountToSmallestUnit,
    BalanceDisplaySchema,
    CreateGroupRequest,
    CurrencyBalanceDisplaySchema,
    GroupBalances,
    GroupDTO,
    GroupFullDetailsDTO,
    GroupId,
    GroupPermissions,
    ListGroupsResponse,
    MemberRoles,
    MemberStatuses,
    SecurityPresets,
    smallestUnitToAmountString,
    toCurrencyISOCode,
    toGroupId,
    toGroupName,
    toISOString,
    toUserId,
    UpdateGroupRequest,
} from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { DOCUMENT_CONFIG, FirestoreCollections } from '../constants';
import { ErrorDetail, Errors } from '../errors';
import { logger, LoggerContext } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { PermissionEngine } from '../permissions';
import { GroupBalanceDTO } from '../schemas';
import * as dateHelpers from '../utils/dateHelpers';
import { newTopLevelMembershipDocId } from '../utils/idGenerator';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
import { CommentService } from './CommentService';
import { ExpenseService } from './ExpenseService';
import type { GetGroupsForUserOptions, IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { GroupShareService } from './GroupShareService';
import { SettlementService } from './SettlementService';
import { GroupTransactionManager } from './transactions/GroupTransactionManager';
import { UserService } from './UserService2';

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
        private readonly groupShareService: GroupShareService,
        private readonly commentService: CommentService,
        private readonly activityFeedService: ActivityFeedService,
        private readonly groupTransactionManager: GroupTransactionManager,
    ) {}

    /**
     * Add computed fields to Group (balance, last activity)
     * Now reads pre-computed balance from Firestore instead of calculating on-the-fly
     */
    private async addComputedFields(group: GroupDTO, userId: UserId): Promise<GroupDTO> {
        // Read pre-computed balance from Firestore (O(1) read vs O(N) calculation)
        const groupBalance = await this.firestoreReader.getGroupBalance(group.id);

        // Use group.updatedAt for last activity (updated by touchGroup() on any group activity)
        const lastActivity = this.formatRelativeTime(group.updatedAt);

        // Calculate currency-specific balances for current user with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: CurrencyISOCode;
                netBalance: Amount;
                totalOwed: Amount;
                totalOwing: Amount;
            }
        > = {};

        if (groupBalance.balancesByCurrency) {
            for (const [currencyStr, currencyBalances] of Object.entries(groupBalance.balancesByCurrency)) {
                const currency = toCurrencyISOCode(currencyStr);
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance) {
                    const netBalanceUnits = amountToSmallestUnit(currencyUserBalance.netBalance, currency);
                    if (netBalanceUnits === 0) {
                        continue;
                    }

                    const totalOwedUnits = netBalanceUnits > 0 ? netBalanceUnits : 0;
                    const totalOwingUnits = netBalanceUnits < 0 ? Math.abs(netBalanceUnits) : 0;

                    const currencyDisplayData: {
                        currency: CurrencyISOCode;
                        netBalance: Amount;
                        totalOwed: Amount;
                        totalOwing: Amount;
                    } = {
                        currency,
                        netBalance: smallestUnitToAmountString(netBalanceUnits, currency),
                        totalOwed: smallestUnitToAmountString(totalOwedUnits, currency),
                        totalOwing: smallestUnitToAmountString(totalOwingUnits, currency),
                    };

                    // Validate the currency display data structure
                    CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                    balancesByCurrency[currency] = currencyDisplayData;
                }
            }
        }

        // Create and validate the complete balance display data
        const balanceDisplay = { balancesByCurrency };
        BalanceDisplaySchema.parse(balanceDisplay);

        return {
            ...group,
            balance: balanceDisplay,
            lastActivity,
        };
    }

    /**
     * Fetch a group and verify user access
     */
    private async fetchGroupWithAccess(
        groupId: GroupId,
        userId: UserId,
        requireWriteAccess: boolean = false,
        options: { includeDeleted?: boolean; } = {},
    ): Promise<{ group: GroupDTO; }> {
        const includeDeleted = options.includeDeleted ?? false;
        const group = await this.firestoreReader.getGroup(groupId, { includeDeleted });

        if (!group) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        if (requireWriteAccess) {
            await this.groupMemberService.ensureActiveGroupAdmin(group.id, userId);
        } else {
            const membership = await this.firestoreReader.getGroupMember(group.id, userId);
            if (!membership) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }
        }

        if (includeDeleted && group.deletedAt) {
            return { group };
        }

        const groupWithComputed = await this.addComputedFields(group, userId);
        return { group: groupWithComputed };
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
     * Calculate totalOwed and totalOwing from netBalance
     */
    private calculateBalanceBreakdown(netBalance: Amount, currency: CurrencyISOCode): { netBalance: Amount; totalOwed: Amount; totalOwing: Amount; } {
        const netBalanceUnits = amountToSmallestUnit(netBalance, currency);
        const totalOwedUnits = netBalanceUnits > 0 ? netBalanceUnits : 0;
        const totalOwingUnits = netBalanceUnits < 0 ? Math.abs(netBalanceUnits) : 0;

        return {
            netBalance: smallestUnitToAmountString(netBalanceUnits, currency),
            totalOwed: smallestUnitToAmountString(totalOwedUnits, currency),
            totalOwing: smallestUnitToAmountString(totalOwingUnits, currency),
        };
    }

    /**
     * Enrich a group with balance information and last activity timestamp
     */
    private enrichGroupWithBalance(group: GroupDTO, groupBalances: GroupBalanceDTO, userId: UserId): GroupDTO {
        // Calculate currency-specific balances with proper typing
        const balancesByCurrency: Record<
            string,
            {
                currency: CurrencyISOCode;
                netBalance: Amount;
                totalOwed: Amount;
                totalOwing: Amount;
            }
        > = {};

        if (groupBalances.balancesByCurrency) {
            // groupBalances is already validated by GroupBalanceDTO from getGroupBalance()
            for (const [currencyStr, currencyBalances] of Object.entries(groupBalances.balancesByCurrency)) {
                const currency = toCurrencyISOCode(currencyStr);
                const currencyUserBalance = currencyBalances[userId];
                if (currencyUserBalance) {
                    const netBalanceUnits = amountToSmallestUnit(currencyUserBalance.netBalance, currency);
                    if (netBalanceUnits === 0) {
                        continue;
                    }

                    const currencyDisplayData: {
                        currency: CurrencyISOCode;
                        netBalance: Amount;
                        totalOwed: Amount;
                        totalOwing: Amount;
                    } = {
                        currency,
                        ...this.calculateBalanceBreakdown(currencyUserBalance.netBalance, currency),
                    };

                    // Validate the currency display data structure
                    CurrencyBalanceDisplaySchema.parse(currencyDisplayData);
                    balancesByCurrency[currency] = currencyDisplayData;
                }
            }
        }

        // Format last activity using group's updatedAt timestamp
        const lastActivity = this.formatRelativeTime(new Date(group.updatedAt).toISOString());

        // Create and validate the complete balance display data
        const balanceDisplay = { balancesByCurrency };
        BalanceDisplaySchema.parse(balanceDisplay);

        return {
            ...group,
            balance: balanceDisplay,
            lastActivity,
        };
    }

    /**
     * List all groups for a user with pagination and balance information
     * PERFORMANCE OPTIMIZED: Batches database operations to prevent N+1 queries
     */
    async listGroups(userId: UserId, options: GetGroupsForUserOptions = {}): Promise<ListGroupsResponse> {
        return measure.measureDb('list-groups', async () => {
            return this._executeListGroups(userId, options);
        });
    }

    private async _executeListGroups(userId: UserId, options: GetGroupsForUserOptions = {}): Promise<ListGroupsResponse> {
        const timer = new PerformanceTimer();

        // Parse options with defaults
        const limit = Math.min(options.limit || DOCUMENT_CONFIG.LIST_LIMIT, DOCUMENT_CONFIG.LIST_LIMIT);
        const orderBy = options.orderBy ?? { field: 'updatedAt', direction: 'desc' as const };

        // Step 1: Query groups and metadata using FirestoreReader
        timer.startPhase('query');
        const paginatedGroups = await this.firestoreReader.getGroupsForUserV2(userId, {
            limit,
            cursor: options.cursor,
            orderBy,
            statusFilter: options.statusFilter,
        });
        timer.endPhase();

        // Step 2: Batch fetch all balances in a single round-trip (O(1) instead of O(N))
        timer.startPhase('balances');
        const groupIds = paginatedGroups.data.map((group) => group.id);
        const balancesMap = await this.firestoreReader.getBalancesByGroupIds(groupIds);

        const groupsWithBalances = paginatedGroups.data.map((group: GroupDTO) => {
            const groupBalance = balancesMap.get(group.id);
            if (groupBalance) {
                return this.enrichGroupWithBalance(group, groupBalance, userId);
            }
            const emptyBalance: GroupBalanceDTO = {
                groupId: group.id,
                balancesByCurrency: {},
                simplifiedDebts: [],
                lastUpdatedAt: toISOString(new Date().toISOString()),
                version: 0,
            };
            return this.enrichGroupWithBalance(group, emptyBalance, userId);
        });
        timer.endPhase();

        // Step 3: Build response
        return {
            groups: groupsWithBalances,
            count: groupsWithBalances.length,
            hasMore: paginatedGroups.hasMore,
            ...(paginatedGroups.nextCursor && { nextCursor: paginatedGroups.nextCursor }),
            pagination: {
                limit,
                order: orderBy.direction,
            },
        };
    }

    /**
     * Create a new group with the creator as the first admin
     */
    async createGroup(userId: UserId, groupData: CreateGroupRequest): Promise<GroupDTO> {
        return measure.measureDb('createGroup', async () => this._createGroup(userId, groupData));
    }

    private async _createGroup(userId: UserId, createGroupRequest: CreateGroupRequest): Promise<GroupDTO> {
        const timer = new PerformanceTimer();

        // Initialize group structure with ISO strings (DTOs)
        const groupId = toGroupId(this.firestoreWriter.generateDocumentId(FirestoreCollections.GROUPS));
        const nowISO = toISOString(new Date().toISOString());

        // Create the document to write (using ISO strings - FirestoreWriter converts to Timestamps)
        const documentToWrite: Record<string, unknown> = {
            name: createGroupRequest.name,
            description: createGroupRequest.description ?? '',
            createdAt: nowISO,
            updatedAt: nowISO,
            deletedAt: null,
            permissions: PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN),
            locked: false,
        };

        // Include currency settings if provided
        if (createGroupRequest.currencySettings) {
            documentToWrite.currencySettings = createGroupRequest.currencySettings;
        }

        // Note: Validation happens in FirestoreWriter after ISO → Timestamp conversion

        const normalizedDisplayName = createGroupRequest.groupDisplayName.trim();

        // Pre-calculate member data outside transaction for speed (using ISO strings - DTOs)
        const themeColor = this.groupShareService.generateUniqueThemeColor(groupId, [], nowISO, userId);
        const memberDoc = {
            uid: userId,
            groupId: groupId,
            memberRole: MemberRoles.ADMIN,
            theme: themeColor, // ISO string assignedAt
            joinedAt: nowISO,
            memberStatus: MemberStatuses.ACTIVE,
            groupDisplayName: normalizedDisplayName,
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
        timer.startPhase('transaction');
        await this.groupTransactionManager.run(groupId, { preloadBalance: false, requireGroup: false }, async (context) => {
            const transaction = context.transaction;
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUPS, groupId, documentToWrite);

            // Write to top-level collection for improved querying
            const topLevelMemberDoc = {
                ...memberDoc,
                groupUpdatedAt: nowISO,
                createdAt: nowISO,
                updatedAt: nowISO,
            };

            // FirestoreWriter.createInTransaction handles conversion and validation
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.GROUP_MEMBERSHIPS, newTopLevelMembershipDocId(userId, groupId), topLevelMemberDoc);

            // Initialize balance document atomically with group creation
            this.firestoreWriter.setGroupBalanceInTransaction(transaction, groupId, initialBalance);

            // Note: Group notifications are handled by the trackGroupChanges trigger
            // which fires when the group document is created
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        const activityItem = this.activityFeedService.buildGroupActivityItem({
            groupId,
            groupName: toGroupName(createGroupRequest.name),
            eventType: ActivityFeedEventTypes.GROUP_CREATED,
            action: ActivityFeedActions.CREATE,
            actorId: userId,
            actorName: normalizedDisplayName,
            timestamp: nowISO,
        });
        await this.activityFeedService.recordActivityForUsers([userId], activityItem).catch(() => {
            // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
        });

        // Add group context to logger
        LoggerContext.setBusinessContext({ groupId: groupId });

        // Fetch the created document to get server-side timestamps
        timer.startPhase('refetch');
        const groupData = await this.firestoreReader.getGroup(groupId);
        if (!groupData) {
            throw new Error('Failed to fetch created group');
        }

        // groupData is already a GroupDTO with ISO strings - no conversion needed
        // Add computed fields before returning
        const result = await this.addComputedFields(groupData, userId);
        timer.endPhase();

        logger.info('group-created', {
            groupId,
            name: groupData.name, /* keep this - its helpful for debugging tests */
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Update an existing group
     * Only the owner can update a group
     */
    async updateGroup(groupId: GroupId, userId: UserId, updates: UpdateGroupRequest): Promise<void> {
        const timer = new PerformanceTimer();

        // Fetch group with write access check
        timer.startPhase('query');
        const { group } = await this.fetchGroupWithAccess(groupId, userId, true, { includeDeleted: true });
        timer.endPhase();

        // If group is locked, only allow admin to unlock it (no other changes permitted)
        if (group.locked === true) {
            const isOnlyUnlocking = Object.keys(updates).length === 1 && updates.locked === false;
            if (!isOnlyUnlocking) {
                throw Errors.forbidden(ErrorDetail.GROUP_LOCKED);
            }
        }

        // Update with optimistic locking and transaction retry logic
        timer.startPhase('transaction');
        let memberIds: UserId[] = [];
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        await this.groupTransactionManager.run(groupId, { preloadBalance: false }, async (context) => {
            const transaction = context.transaction;
            // IMPORTANT: All reads must happen before any writes in Firestore transactions

            // PHASE 1: ALL READS FIRST
            const currentGroup = context.group;
            if (!currentGroup) {
                logger.warn('group-soft-delete-missing', { groupId });
                return;
            }

            // Read membership documents that need updating
            const membershipSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
            memberIds = membershipSnapshot
                .docs
                .map((doc) => (doc.data().uid as string | null | undefined) ?? null)
                .filter((id): id is string => Boolean(id))
                .map((id) => toUserId(id));
            const actorMembershipDoc = membershipSnapshot.docs.find((doc) => doc.data().uid === userId);
            const actorDisplayName = actorMembershipDoc?.data().groupDisplayName?.trim();
            if (!actorDisplayName) {
                throw Errors.serviceError('GROUP_DISPLAY_NAME_MISSING');
            }

            // Optimistic locking: Check if group was updated since we fetched it (compare ISO strings)
            if (group.updatedAt !== currentGroup.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            // Create updated data with current timestamp for optimistic response
            const now = toISOString(new Date().toISOString());
            const updatedData = {
                ...group,
                ...updates,
                updatedAt: now,
            };

            // PHASE 2: ALL WRITES AFTER ALL READS
            // Update group document with ISO timestamp (FirestoreWriter converts to Timestamp)
            const documentPath = `${FirestoreCollections.GROUPS}/${groupId}`;
            const updatePayload: Record<string, unknown> = {
                name: updatedData.name,
                description: updatedData.description,
                updatedAt: now,
            };

            // Handle currency settings update (explicit null clears settings)
            if (updates.currencySettings !== undefined) {
                updatePayload.currencySettings = updates.currencySettings;
            }

            // Handle locked status update
            if (updates.locked !== undefined) {
                updatePayload.locked = updates.locked;
            }

            this.firestoreWriter.updateInTransaction(transaction, documentPath, updatePayload);

            // Update denormalized groupUpdatedAt in all membership documents
            // Use the same ISO timestamp to keep them in sync
            membershipSnapshot.docs.forEach((doc) => {
                this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
                    groupUpdatedAt: now,
                    updatedAt: now,
                });
            });

            // Build activity item - will be recorded AFTER transaction commits
            if (memberIds.length > 0) {
                // Determine event type based on what changed
                let eventType: ActivityFeedEventType = ActivityFeedEventTypes.GROUP_UPDATED;
                if (updates.locked !== undefined && updates.locked !== group.locked) {
                    eventType = updates.locked
                        ? ActivityFeedEventTypes.GROUP_LOCKED
                        : ActivityFeedEventTypes.GROUP_UNLOCKED;
                }

                const detailPayload = updatedData.name !== group.name
                    ? this.activityFeedService.buildDetails({ previousGroupName: group.name })
                    : undefined;

                activityItem = this.activityFeedService.buildGroupActivityItem({
                    groupId,
                    groupName: updatedData.name,
                    eventType,
                    action: ActivityFeedActions.UPDATE,
                    actorId: userId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details: detailPayload,
                });
                activityRecipients = memberIds;
            }
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        // Set group context
        LoggerContext.setBusinessContext({ groupId });

        // Log without explicitly passing userId - it will be automatically included
        logger.info('group-updated', {
            id: groupId,
            timings: timer.getTimings(),
        });
    }

    async updateGroupPermissions(groupId: GroupId, userId: UserId, updates: Partial<GroupPermissions>): Promise<void> {
        if (!updates || Object.values(updates).every((value) => value === undefined)) {
            throw Errors.validationError('permissions', 'NO_PERMISSIONS_PROVIDED');
        }

        const groupPromise = this.firestoreReader.getGroup(groupId);
        await this.groupMemberService.ensureActiveGroupAdmin(groupId, userId);
        const group = await groupPromise;

        if (!group) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        // Get actor's display name for activity feed
        const actorMember = await this.firestoreReader.getGroupMember(groupId, userId);
        const actorDisplayName = actorMember?.groupDisplayName ?? 'Unknown';

        const mergedPermissions: GroupPermissions = {
            ...group.permissions,
            ...updates,
        };
        const now = toISOString(new Date().toISOString());

        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        await this.groupTransactionManager.run(groupId, { preloadBalance: false }, async (context) => {
            const transaction = context.transaction;
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, groupId);
            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            if (groupInTx.updatedAt !== group.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            const membershipSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);

            // Collect member IDs for activity feed
            activityRecipients = membershipSnapshot.docs.map((doc) => (doc.data() as { uid: UserId; }).uid);

            this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUPS}/${groupId}`, {
                permissions: mergedPermissions,
                updatedAt: now,
            });

            membershipSnapshot.docs.forEach((doc) => {
                this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
                    groupUpdatedAt: now,
                    updatedAt: now,
                });
            });

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId,
                groupName: group.name,
                eventType: ActivityFeedEventTypes.PERMISSIONS_UPDATED,
                action: ActivityFeedActions.UPDATE,
                actorId: userId,
                actorName: actorDisplayName,
                timestamp: now,
            });
        });

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        LoggerContext.setBusinessContext({ groupId });
        logger.info('group-permissions-updated', {
            groupId,
            updatedFields: Object.keys(updates),
        });
    }

    async deleteGroup(groupId: GroupId, userId: UserId): Promise<void> {
        // Fetch group with write access check
        const { group } = await this.fetchGroupWithAccess(groupId, userId, true, { includeDeleted: true });

        // Already deleted - no-op
        if (group.deletedAt) {
            return;
        }
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
        const requestContext = { groupId, memberCount: memberIds.length, members: memberIds };

        const now = toISOString(new Date().toISOString());
        let performedDeletion = false;
        const activityItems: Array<{ item: any; recipients: UserId[]; }> = [];

        // Fetch existing activity items for all members (MUST be before transaction writes)
        await this.groupTransactionManager.run(groupId, { preloadBalance: false }, async (context) => {
            const transaction = context.transaction;
            const currentGroup = context.group;
            if (!currentGroup) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            if (currentGroup.deletedAt) {
                logger.warn('group-soft-delete-race', { groupId });
                return;
            }

            // Optimistic locking to prevent concurrent updates from clobbering each other
            if (group.updatedAt !== currentGroup.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            const membershipSnapshot = await this.firestoreReader.getGroupMembershipsInTransaction(transaction, groupId);
            const memberIdsInTransaction = membershipSnapshot
                .docs
                .map((doc) => (doc.data().uid as string | null | undefined) ?? null)
                .filter((id): id is string => Boolean(id))
                .map((id) => toUserId(id));

            // Get actor's group display name from membership
            const actorMembershipDoc = membershipSnapshot.docs.find((doc) => doc.data().uid === userId);
            const actorDisplayName = actorMembershipDoc?.data().groupDisplayName?.trim();
            if (!actorDisplayName) {
                throw Errors.serviceError('GROUP_DISPLAY_NAME_MISSING');
            }

            this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.GROUPS}/${groupId}`, {
                deletedAt: now,
                updatedAt: now,
            });

            membershipSnapshot.docs.forEach((doc) => {
                this.firestoreWriter.updateInTransaction(transaction, doc.ref.path, {
                    groupUpdatedAt: now,
                    updatedAt: now,
                });
            });

            // Build activity items - will be recorded AFTER transaction commits
            for (const memberId of memberIdsInTransaction) {
                const memberDoc = membershipSnapshot.docs.find((doc) => (doc.data() as { uid?: string; }).uid === memberId);
                const targetUserName = (memberDoc?.data() as { groupDisplayName?: string; })?.groupDisplayName?.trim();
                if (!targetUserName) {
                    throw Errors.serviceError('GROUP_DISPLAY_NAME_MISSING');
                }
                const activityItem = this.activityFeedService.buildGroupActivityItem({
                    groupId,
                    groupName: group.name,
                    eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                    action: ActivityFeedActions.LEAVE,
                    actorId: userId,
                    actorName: actorDisplayName,
                    timestamp: now,
                    details: this.activityFeedService.buildDetails({
                        targetUser: {
                            id: memberId,
                            name: targetUserName,
                        },
                    }),
                });
                activityItems.push({ item: activityItem, recipients: [memberId] });
            }

            performedDeletion = true;
        });

        // Record activity feeds AFTER transaction commits (fire-and-forget)
        for (const { item, recipients } of activityItems) {
            await this.activityFeedService.recordActivityForUsers(recipients, item).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        LoggerContext.setBusinessContext({ groupId });

        logger.info('group-soft-delete-completed', {
            ...requestContext,
            performedDeletion,
        });
    }

    /**
     * Get comprehensive group details including members, expenses, balances, and settlements
     * @param groupId Group ID
     * @param userId User ID for access control
     * @param options Pagination options for expenses and settlements
     * @returns Complete group details
     */
    async getGroupFullDetails(
        groupId: GroupId,
        userId: UserId,
        options: {
            expenseLimit?: number;
            expenseCursor?: string;
            includeDeletedExpenses?: boolean;
            settlementLimit?: number;
            settlementCursor?: string;
            includeDeletedSettlements?: boolean;
            commentLimit?: number;
            commentCursor?: string;
        } = {},
    ): Promise<GroupFullDetailsDTO> {
        if (!userId) {
            throw Errors.authRequired();
        }

        // Validate and set defaults for pagination
        const expenseLimit = Math.min(options.expenseLimit || 8, 100);
        const settlementLimit = Math.min(options.settlementLimit || 8, 100);
        const commentLimit = Math.min(options.commentLimit || 8, 100);

        // Get group with access check (this will throw if user doesn't have access)
        const { group } = await this.fetchGroupWithAccess(groupId, userId);

        // Fetch all data in parallel using proper service layer methods
        const [membersData, expensesData, balancesData, settlementsData, commentsData] = await Promise.all([
            // Get members using service layer
            this.userService.getGroupMembersResponseFromSubcollection(groupId),

            // Get expenses using service layer with pagination
            this.expenseService.listGroupExpenses(groupId, userId, {
                limit: expenseLimit,
                cursor: options.expenseCursor,
                includeDeleted: options.includeDeletedExpenses ?? false,
            }),

            // Get pre-computed balances from Firestore (O(1) read)
            this.firestoreReader.getGroupBalance(groupId),

            // Get settlements using service layer with pagination
            this.settlementService.listSettlements(groupId, userId, {
                limit: settlementLimit,
                cursor: options.settlementCursor,
                includeDeleted: options.includeDeletedSettlements ?? false,
            }),
            // Get comments for the group using comment service
            this.commentService.listGroupComments(groupId, userId, {
                limit: commentLimit,
                cursor: options.commentCursor,
            }),
        ]);

        // balancesData is already validated GroupBalanceDTO from getGroupBalance()
        // Map lastUpdatedAt to lastUpdated for API response compatibility
        const balancesDTO: GroupBalances = {
            ...balancesData,
            groupId, // Use the branded GroupId parameter instead of spreading string from balancesData
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
            comments: commentsData,
        };
    }

    updateGroupMemberDisplayName(groupId: GroupId, userId: UserId, newDisplayName: DisplayName): Promise<void> {
        return this.firestoreWriter.updateGroupMemberDisplayName(groupId, userId, newDisplayName);
    }
}
