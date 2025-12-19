import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    CreateSettlementRequest,
    GroupId,
    ListSettlementsOptions,
    ListSettlementsResponse,
    SettlementDTO,
    SettlementId,
    SettlementWithMembers,
    toISOString,
    toSettlementId,
    UpdateSettlementRequest,
    UserId,
} from '@billsplit-wl/shared';
import { FirestoreCollections } from '../constants';
import { ApiError, ErrorDetail, Errors } from '../errors';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { LoggerContext } from '../utils/logger-context';
import { ActivityFeedService, CreateActivityItemInput } from './ActivityFeedService';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { UserService } from './UserService2';

/**
 * Zod schema for User document - ensures critical fields are present
 */
/**
 * Service for managing settlement operations
 */
export class SettlementService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly incrementalBalanceService: IncrementalBalanceService,
        private readonly activityFeedService: ActivityFeedService,
        private readonly userService: UserService,
        private readonly groupMemberService: GroupMemberService,
    ) {
    }

    /**
     * Check if settlement is locked due to departed members
     * A settlement is locked if payer or payee is no longer in the group
     */
    private async isSettlementLocked(settlement: SettlementDTO, groupId: GroupId): Promise<boolean> {
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
        return !currentMemberIds.includes(settlement.payerId)
            || !currentMemberIds.includes(settlement.payeeId);
    }

    /**
     * List settlements for a group with pagination and filtering
     */
    async listSettlements(
        groupId: GroupId,
        userId: UserId,
        options: ListSettlementsOptions = {},
    ): Promise<ListSettlementsResponse> {
        return measure.measureDb('SettlementService.listSettlements', async () => this._listSettlements(groupId, userId, options));
    }

    private async _listSettlements(
        groupId: GroupId,
        userId: UserId,
        options: ListSettlementsOptions = {},
    ): Promise<ListSettlementsResponse> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ userId, operation: 'list-settlements' });

        timer.startPhase('query');
        // Verify user is a member of the group
        const isMember = await this.firestoreReader.verifyGroupMembership(groupId, userId);
        if (!isMember) {
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }

        const result = await this._getGroupSettlementsData(groupId, userId, options);
        timer.endPhase();

        return result;
    }

    /**
     * Create a new settlement
     */
    async createSettlement(settlementData: CreateSettlementRequest, userId: UserId): Promise<SettlementDTO> {
        return measure.measureDb('SettlementService.createSettlement', async () => this._createSettlement(settlementData, userId));
    }

    private async _createSettlement(settlementData: CreateSettlementRequest, userId: UserId): Promise<SettlementDTO> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId: settlementData.groupId });
        LoggerContext.update({ userId, operation: 'create-settlement', amount: settlementData.amount });

        timer.startPhase('query');

        // Verify group exists first (like ExpenseService)
        const {
            group,
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(settlementData.groupId, userId);

        // Validate currency is permitted by group settings
        if (group.currencySettings?.permitted) {
            if (!group.currencySettings.permitted.includes(settlementData.currency)) {
                throw Errors.forbidden(ErrorDetail.CURRENCY_NOT_PERMITTED);
            }
        }

        // Verify payer and payee are still in the group (race condition protection)
        for (const uid of [settlementData.payerId, settlementData.payeeId]) {
            if (!memberIds.includes(uid)) {
                throw Errors.validationError('payerId', ErrorDetail.NOT_GROUP_MEMBER);
            }
        }

        const now = toISOString(new Date().toISOString());
        const settlementDate = settlementData.date || now;

        // Data to store in Firestore (without computed fields like isLocked)
        const settlementDataToCreate = {
            groupId: settlementData.groupId,
            payerId: settlementData.payerId,
            payeeId: settlementData.payeeId,
            amount: settlementData.amount,
            currency: settlementData.currency,
            date: settlementDate, // ISO string
            note: settlementData.note,
            createdBy: userId,
            createdAt: now, // ISO string
            updatedAt: now,
            // Soft delete fields - initialize to null (not deleted)
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
        };

        // Generate settlement ID before transaction
        const settlementId = toSettlementId(this.firestoreWriter.generateDocumentId(FirestoreCollections.SETTLEMENTS));

        // Get members for balance update
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        // Create settlement and update group balance atomically
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            timer.startPhase('transaction:getGroup');
            // Verify group still exists
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, settlementData.groupId);
            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }
            timer.endPhase();

            timer.startPhase('transaction:getBalance');
            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlementData.groupId);
            timer.endPhase();

            // Preload membership refs for touchGroup (must be read before writes)
            const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, settlementData.groupId);

            // ===== WRITE PHASE: All writes happen after reads =====

            timer.startPhase('transaction:createSettlement');
            // Create settlement in transaction
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.SETTLEMENTS, settlementId, settlementDataToCreate);
            timer.endPhase();

            timer.startPhase('transaction:touchGroup');
            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroupWithPreloadedRefs(
                settlementData.groupId,
                transaction,
                membershipRefs.map((m) => m.ref),
            );
            timer.endPhase();

            timer.startPhase('transaction:applyBalance');
            // Apply incremental balance update (needs isLocked for type compatibility with SettlementDTO)
            // Note: isLocked is a computed field for API responses, not stored in Firestore
            const settlementForBalance: SettlementDTO = { id: settlementId, ...settlementDataToCreate, isLocked: false };
            this.incrementalBalanceService.applySettlementCreated(transaction, settlementData.groupId, currentBalance, settlementForBalance, memberIds);
            timer.endPhase();

            timer.startPhase('transaction:buildActivityItem');
            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: settlementData.groupId,
                groupName: groupInTx.name,
                eventType: ActivityFeedEventTypes.SETTLEMENT_CREATED,
                action: ActivityFeedActions.CREATE,
                actorId: userId,
                actorName: actorMember.groupDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    settlement: {
                        id: settlementId,
                        description: settlementData.note,
                    },
                }),
            });
            activityRecipients = memberIds;
            timer.endPhase();
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        // Update context with the created settlement ID
        LoggerContext.setBusinessContext({ settlementId });

        logger.info('settlement-created', {
            settlementId,
            groupId: settlementData.groupId,
            timings: timer.getTimings(),
        });

        // Build the complete settlement object for the response with computed isLocked field
        const settlementForLockCheck: SettlementDTO = {
            id: settlementId,
            ...settlementDataToCreate,
            date: settlementDate,
            createdAt: now,
            updatedAt: now,
            isLocked: false,
        };

        const settlement: SettlementDTO = {
            ...settlementForLockCheck,
            isLocked: await this.isSettlementLocked(settlementForLockCheck, settlementData.groupId),
        };

        return settlement;
    }

    /**
     * Update an existing settlement
     */
    async updateSettlement(settlementId: SettlementId, updateData: UpdateSettlementRequest, userId: UserId): Promise<SettlementWithMembers> {
        return measure.measureDb('SettlementService.updateSettlement', async () => this._updateSettlement(settlementId, updateData, userId));
    }

    private async _updateSettlement(settlementId: SettlementId, updateData: UpdateSettlementRequest, userId: UserId): Promise<SettlementWithMembers> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'update-settlement' });

        timer.startPhase('query');
        const oldSettlement = await this.firestoreReader.getSettlement(settlementId);

        if (!oldSettlement) {
            throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
        }

        // Check if settlement is locked (payer or payee has left)
        const isLocked = await this.isSettlementLocked(oldSettlement, oldSettlement.groupId);
        if (isLocked) {
            throw Errors.invalidRequest('SETTLEMENT_LOCKED');
        }

        if (oldSettlement.createdBy !== userId) {
            throw Errors.forbidden('NOT_SETTLEMENT_CREATOR');
        }

        const [group, member, memberIds] = await Promise.all([
            this.firestoreReader.getGroup(oldSettlement.groupId),
            this.firestoreReader.getGroupMember(oldSettlement.groupId, userId),
            this.firestoreReader.getAllGroupMemberIds(oldSettlement.groupId),
        ]);

        if (!group) {
            throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
        }

        if (!member) {
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }

        // Validate currency is permitted by group settings if currency is being changed
        const newCurrency = updateData.currency ?? oldSettlement.currency;
        if (group.currencySettings?.permitted) {
            if (!group.currencySettings.permitted.includes(newCurrency)) {
                throw Errors.forbidden(ErrorDetail.CURRENCY_NOT_PERMITTED);
            }
        }

        const actorDisplayName = member.groupDisplayName?.trim();
        if (!actorDisplayName) {
            throw Errors.serviceError('GROUP_DISPLAY_NAME_MISSING');
        }

        timer.endPhase();

        // Generate new settlement ID for the updated version
        const newSettlementId = toSettlementId(this.firestoreWriter.generateDocumentId(FirestoreCollections.SETTLEMENTS));
        const now = toISOString(new Date().toISOString());

        // Handle note field - if explicitly set to empty string or null, don't include it
        const newNote = updateData.note !== undefined
            ? (updateData.note || undefined)
            : oldSettlement.note;

        // Build the new settlement data (merging old settlement with updates)
        const newSettlementData: Omit<SettlementDTO, 'isLocked'> = {
            id: newSettlementId,
            groupId: oldSettlement.groupId,
            payerId: oldSettlement.payerId, // Immutable
            payeeId: oldSettlement.payeeId, // Immutable
            amount: updateData.amount ?? oldSettlement.amount,
            currency: updateData.currency ?? oldSettlement.currency,
            date: updateData.date ?? oldSettlement.date,
            note: newNote,
            createdBy: oldSettlement.createdBy, // Preserve original creator
            createdAt: now, // New version gets new creation timestamp
            updatedAt: now,
            deletedAt: null,
            deletedBy: null,
            supersededBy: null,
        };

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        // Use transaction to soft-delete old settlement and create new one atomically
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
            if (!currentSettlement) {
                throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
            }

            // Check for concurrent updates
            if (oldSettlement.updatedAt !== currentSettlement.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, oldSettlement.groupId);
            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, oldSettlement.groupId);

            // Preload membership refs for touchGroup (must be read before writes)
            const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, oldSettlement.groupId);

            // ===== WRITE PHASE: All writes happen after reads =====

            // 1. Soft-delete old settlement and link to new version via supersededBy
            this.firestoreWriter.updateInTransaction(transaction, `${FirestoreCollections.SETTLEMENTS}/${settlementId}`, {
                supersededBy: newSettlementId,
                deletedAt: now,
                deletedBy: userId,
                updatedAt: now,
            });

            // 2. Create new settlement document
            this.firestoreWriter.createInTransaction(
                transaction,
                FirestoreCollections.SETTLEMENTS,
                newSettlementId,
                newSettlementData,
            );

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroupWithPreloadedRefs(
                oldSettlement.groupId,
                transaction,
                membershipRefs.map((m) => m.ref),
            );

            // Apply incremental balance update with old and new settlement
            const newSettlementForBalance: SettlementDTO = { ...newSettlementData, isLocked: false };
            this.incrementalBalanceService.applySettlementUpdated(transaction, oldSettlement.groupId, currentBalance, oldSettlement, newSettlementForBalance, memberIds);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: oldSettlement.groupId,
                groupName: groupInTx.name,
                eventType: ActivityFeedEventTypes.SETTLEMENT_UPDATED,
                action: ActivityFeedActions.UPDATE,
                actorId: userId,
                actorName: actorDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    settlement: {
                        id: newSettlementId, // Reference the new settlement
                        description: newNote,
                    },
                }),
            });
            activityRecipients = memberIds;
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        timer.startPhase('refetch');
        // Fetch group member data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([
            this.userService.resolveGroupMemberProfile(newSettlementData.groupId, newSettlementData.payerId),
            this.userService.resolveGroupMemberProfile(newSettlementData.groupId, newSettlementData.payeeId),
        ]);
        timer.endPhase();

        logger.info('settlement-updated', {
            oldId: settlementId,
            newId: newSettlementId,
            groupId: oldSettlement.groupId,
            timings: timer.getTimings(),
        });

        const settlementWithMembers: SettlementWithMembers = {
            id: newSettlementId,
            groupId: newSettlementData.groupId,
            payer: payerData,
            payee: payeeData,
            amount: newSettlementData.amount,
            currency: newSettlementData.currency,
            date: newSettlementData.date,
            note: newSettlementData.note,
            createdAt: newSettlementData.createdAt,
            deletedAt: newSettlementData.deletedAt,
            deletedBy: newSettlementData.deletedBy,
            supersededBy: newSettlementData.supersededBy,
            // Compute isLocked by checking if payer or payee has left the group
            isLocked: false, // Will be set below
        };

        // Add computed isLocked field
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(oldSettlement.groupId);
        settlementWithMembers.isLocked = !currentMemberIds.includes(payerData.uid) || !currentMemberIds.includes(payeeData.uid);

        return settlementWithMembers;
    }

    /**
     * Soft delete a settlement by marking it as deleted without removing it from the database
     *
     * This method performs a soft deletion by setting deletedAt and deletedBy fields,
     * preserving the settlement data for audit purposes and future recovery.
     *
     * Permission requirements:
     * - User must be the settlement creator OR a group admin
     *
     * Side effects:
     * - Updates deletedAt to current timestamp
     * - Updates deletedBy to the user performing the deletion
     * - Updates group's lastActivity timestamp
     * - Excluded from balance calculations (via FirestoreReader filter)
     *
     * @param settlementId - The ID of the settlement to soft delete
     * @param userId - The ID of the user performing the deletion
     * @throws {ApiError} NOT_FOUND if settlement doesn't exist
     * @throws {ApiError} ALREADY_DELETED if settlement is already soft-deleted
     * @throws {ApiError} INSUFFICIENT_PERMISSIONS if user lacks permission to delete
     * @throws {ApiError} CONFLICT if concurrent update detected
     */
    async softDeleteSettlement(settlementId: SettlementId, userId: UserId): Promise<void> {
        return measure.measureDb('SettlementService.softDeleteSettlement', async () => this._softDeleteSettlement(settlementId, userId));
    }

    private async _softDeleteSettlement(settlementId: SettlementId, userId: UserId): Promise<void> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'soft-delete-settlement' });

        timer.startPhase('query');
        // Include soft-deleted settlements so we can check supersededBy before throwing NOT_FOUND
        const settlementData = await this.firestoreReader.getSettlement(settlementId, { includeSoftDeleted: true });

        if (!settlementData) {
            throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
        }

        const settlement = settlementData;

        // Prevent deletion of superseded settlements (they're already archived via edit history)
        // This check MUST come before the deletedAt check to return the correct error
        if (settlement.supersededBy !== null) {
            throw Errors.invalidRequest('CANNOT_DELETE_SUPERSEDED');
        }

        // Check if already soft-deleted (user-initiated deletion)
        if (settlement.deletedAt) {
            throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
        }

        // Permission check: User must be settlement creator or group admin
        const memberData = await this.firestoreReader.getGroupMember(settlement.groupId, userId);
        if (!memberData) {
            throw Errors.forbidden(ErrorDetail.NOT_GROUP_MEMBER);
        }

        const isCreator = settlement.createdBy === userId;

        if (!isCreator) {
            await this.groupMemberService.ensureActiveGroupAdmin(settlement.groupId, userId, {
                forbiddenErrorFactory: () => Errors.forbidden(ErrorDetail.INSUFFICIENT_PERMISSIONS),
            });
        }

        // Get members for balance update
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(settlement.groupId);
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: CreateActivityItemInput | null = null;
        let activityRecipients: UserId[] = [];

        // Soft delete with optimistic locking and balance update
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
            if (!currentSettlement) {
                throw Errors.notFound('Settlement', ErrorDetail.SETTLEMENT_NOT_FOUND);
            }

            // Check for concurrent updates
            if (settlement.updatedAt !== currentSettlement.updatedAt) {
                throw Errors.conflict(ErrorDetail.CONCURRENT_UPDATE);
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlement.groupId);

            // Preload membership refs for touchGroup (must be read before writes)
            const membershipRefs = await this.firestoreReader.getMembershipRefsInTransaction(transaction, settlement.groupId);

            // Get group for activity feed (must be read before writes)
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, settlement.groupId);
            if (!groupInTx) {
                throw Errors.notFound('Group', ErrorDetail.GROUP_NOT_FOUND);
            }

            const now = toISOString(new Date().toISOString());
            const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;

            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                deletedAt: now,
                deletedBy: userId,
                updatedAt: now,
            });

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroupWithPreloadedRefs(
                settlement.groupId,
                transaction,
                membershipRefs.map((m) => m.ref),
            );

            // Apply incremental balance update to remove this settlement's contribution
            this.incrementalBalanceService.applySettlementDeleted(transaction, settlement.groupId, currentBalance, settlement, memberIds);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: settlement.groupId,
                groupName: groupInTx.name,
                eventType: ActivityFeedEventTypes.SETTLEMENT_DELETED,
                action: ActivityFeedActions.DELETE,
                actorId: userId,
                actorName: memberData.groupDisplayName,
                timestamp: now,
                details: this.activityFeedService.buildDetails({
                    settlement: {
                        id: settlementId,
                        description: settlement.note,
                    },
                }),
            });
            activityRecipients = memberIds;
        });
        timer.endPhase();

        // Record activity feed AFTER transaction commits (fire-and-forget)
        if (activityItem && activityRecipients.length > 0) {
            await this.activityFeedService.recordActivityForUsers(activityRecipients, activityItem).catch(() => {
                // Already logged in recordActivityForUsers, just catch to prevent unhandled rejection
            });
        }

        logger.info('settlement-soft-deleted', {
            settlementId,
            groupId: settlement.groupId,
            timings: timer.getTimings(),
        });
    }

    /**
     * Internal function to get group settlements data
     * Used by both the public listSettlements method and consolidated endpoints
     */
    async _getGroupSettlementsData(
        groupId: GroupId,
        userId: UserId,
        options: ListSettlementsOptions = {},
    ): Promise<ListSettlementsResponse> {
        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ operation: 'get-group-settlements-data', limit: options.limit || 50 });

        const limit = options.limit || 50;
        const cursor = options.cursor;
        const filterUserId = options.uid;
        const startDate = options.startDate;
        const endDate = options.endDate;
        const includeDeleted = options.includeDeleted ?? false;

        const result = await this.firestoreReader.getSettlementsForGroup(groupId, {
            limit,
            cursor,
            filterUserId,
            dateRange: startDate || endDate ? { start: startDate, end: endDate } : undefined,
            includeDeleted,
        });

        // Get current member IDs once for all settlements
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);

        // Batch fetch all unique member profiles - eliminates N+1 for profiles
        const uniqueUserIds = new Set<UserId>();
        for (const settlement of result.settlements) {
            uniqueUserIds.add(settlement.payerId);
            uniqueUserIds.add(settlement.payeeId);
        }
        const memberProfiles = await this.userService.resolveGroupMemberProfiles(groupId, Array.from(uniqueUserIds));
        const profileMap = new Map(memberProfiles.map((p) => [p.uid, p]));

        // userReactions are now denormalized on the settlement document - no N+1 queries needed
        const settlements: SettlementWithMembers[] = result.settlements.map((settlement) => {
            const payerData = profileMap.get(settlement.payerId)!;
            const payeeData = profileMap.get(settlement.payeeId)!;

            // Compute lock status
            const isLocked = !currentMemberIds.includes(settlement.payerId)
                || !currentMemberIds.includes(settlement.payeeId);

            return {
                id: settlement.id,
                groupId: settlement.groupId,
                payer: payerData,
                payee: payeeData,
                amount: settlement.amount,
                currency: settlement.currency,
                date: settlement.date,
                note: settlement.note,
                createdAt: settlement.createdAt,
                deletedAt: settlement.deletedAt,
                deletedBy: settlement.deletedBy,
                supersededBy: settlement.supersededBy,
                isLocked,
                reactionCounts: settlement.reactionCounts,
                userReactions: settlement.userReactions,
            } as SettlementWithMembers;
        });

        return {
            settlements,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        };
    }
}
