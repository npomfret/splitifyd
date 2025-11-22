import {
    ActivityFeedActions,
    ActivityFeedEventTypes,
    CreateSettlementRequest,
    GroupId,
    ISOString,
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
import { FirestoreCollections, HTTP_STATUS } from '../constants';
import { FieldValue } from '../firestore-wrapper';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import { ApiError, Errors } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import { ActivityFeedService } from './ActivityFeedService';
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
        await this.firestoreReader.verifyGroupMembership(groupId, userId);
        const result = await this._getGroupSettlementsData(groupId, options);
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
            memberIds,
            actorMember,
        } = await this.groupMemberService.getGroupAccessContext(settlementData.groupId, userId);

        // Verify payer and payee are still in the group (race condition protection)
        for (const uid of [settlementData.payerId, settlementData.payeeId]) {
            if (!memberIds.includes(uid)) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'MEMBER_NOT_IN_GROUP',
                    `Cannot create settlement - user is not in the group`,
                );
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
        };

        // Generate settlement ID before transaction
        const settlementId = toSettlementId(this.firestoreWriter.generateDocumentId(FirestoreCollections.SETTLEMENTS));

        // Get members for balance update
        timer.endPhase();

        // Declare variables outside transaction for activity feed
        let activityItem: any = null;
        let activityRecipients: UserId[] = [];

        // Create settlement and update group balance atomically
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            timer.startPhase('transaction:getGroup');
            // Verify group still exists
            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, settlementData.groupId);
            if (!groupInTx) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }
            timer.endPhase();

            timer.startPhase('transaction:getBalance');
            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlementData.groupId);
            timer.endPhase();

            // ===== WRITE PHASE: All writes happen after reads =====

            timer.startPhase('transaction:createSettlement');
            // Create settlement in transaction
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.SETTLEMENTS, settlementId, settlementDataToCreate);
            timer.endPhase();

            timer.startPhase('transaction:touchGroup');
            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(settlementData.groupId, transaction);
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
        const settlementData = await this.firestoreReader.getSettlement(settlementId);

        if (!settlementData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Settlement data is already validated by FirestoreReader
        const settlement = settlementData;

        // Check if settlement is locked (payer or payee has left)
        const isLocked = await this.isSettlementLocked(settlement, settlement.groupId);
        if (isLocked) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'SETTLEMENT_LOCKED',
                'Cannot edit settlement - payer or payee has left the group',
            );
        }

        if (settlement.createdBy !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can update this settlement');
        }

        // Note: updates type includes FieldValue which is a special Firestore sentinel value
        const updates: Partial<Pick<SettlementDTO, 'amount' | 'currency' | 'date'>> & { note?: string | any; } = {};

        if (updateData.amount !== undefined) {
            updates.amount = updateData.amount;
        }

        if (updateData.currency !== undefined) {
            updates.currency = updateData.currency;
        }

        if (updateData.date !== undefined) {
            updates.date = updateData.date; // Already ISO string, no conversion needed
        }

        if (updateData.note !== undefined) {
            if (updateData.note) {
                updates.note = updateData.note;
            } else {
                // If note is explicitly set to empty string or null, remove it
                updates.note = FieldValue.delete();
            }
        }

        const [member, memberIds] = await Promise.all([
            this.firestoreReader.getGroupMember(settlement.groupId, userId),
            this.firestoreReader.getAllGroupMemberIds(settlement.groupId),
        ]);

        if (!member) {
            throw Errors.FORBIDDEN();
        }

        const actorDisplayName = member.groupDisplayName?.trim();
        if (!actorDisplayName) {
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'GROUP_DISPLAY_NAME_MISSING', 'Group member is missing required display name');
        }

        timer.endPhase();

        const updatedNote = updateData.note === undefined ? settlement.note : updateData.note || undefined;

        // Declare variables outside transaction for activity feed
        let activityItem: any = null;
        let activityRecipients: UserId[] = [];

        // Update with optimistic locking and balance update
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // ===== READ PHASE: All reads must happen before any writes =====

            const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
            if (!currentSettlement) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
            }

            // Check for concurrent updates
            if (settlement.updatedAt !== currentSettlement.updatedAt) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Document was modified concurrently');
            }

            const groupInTx = await this.firestoreReader.getGroupInTransaction(transaction, settlement.groupId);
            if (!groupInTx) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlement.groupId);

            // ===== WRITE PHASE: All writes happen after reads =====

            const updateTimestamp = toISOString(new Date().toISOString());
            const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                ...updates,
                updatedAt: updateTimestamp, // ISO string, FirestoreWriter converts
            });

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(settlement.groupId, transaction);

            // Apply incremental balance update with old and new settlement
            const newSettlement: SettlementDTO = { ...settlement, ...updates, updatedAt: updateTimestamp } as SettlementDTO;
            if (updates.note === FieldValue.delete()) {
                delete (newSettlement as any).note;
            }
            this.incrementalBalanceService.applySettlementUpdated(transaction, settlement.groupId, currentBalance, settlement, newSettlement, memberIds);

            // Build activity item - will be recorded AFTER transaction commits
            activityItem = this.activityFeedService.buildGroupActivityItem({
                groupId: settlement.groupId,
                groupName: groupInTx.name,
                eventType: ActivityFeedEventTypes.SETTLEMENT_UPDATED,
                action: ActivityFeedActions.UPDATE,
                actorId: userId,
                actorName: actorDisplayName,
                timestamp: updateTimestamp,
                details: this.activityFeedService.buildDetails({
                    settlement: {
                        id: settlementId,
                        description: updatedNote,
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
        const updatedSettlement = await this.firestoreReader.getSettlement(settlementId);

        // Fetch group member data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([
            this.userService.resolveGroupMemberProfile(updatedSettlement!.groupId, updatedSettlement!.payerId),
            this.userService.resolveGroupMemberProfile(updatedSettlement!.groupId, updatedSettlement!.payeeId),
        ]);
        timer.endPhase();

        logger.info('settlement-updated', {
            settlementId,
            groupId: settlement.groupId,
            timings: timer.getTimings(),
        });

        const settlementWithMembers: SettlementWithMembers = {
            id: settlementId,
            groupId: updatedSettlement!.groupId,
            payer: payerData,
            payee: payeeData,
            amount: updatedSettlement!.amount,
            currency: updatedSettlement!.currency,
            date: updatedSettlement!.date,
            note: updatedSettlement!.note,
            createdAt: updatedSettlement!.createdAt,
            deletedAt: updatedSettlement!.deletedAt,
            deletedBy: updatedSettlement!.deletedBy,
            // Compute isLocked by checking if payer or payee has left the group
            isLocked: false, // Will be set below
        };

        // Add computed isLocked field
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(settlement.groupId);
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
        const settlementData = await this.firestoreReader.getSettlement(settlementId);

        if (!settlementData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        const settlement = settlementData;

        // Check if already soft-deleted
        if (settlement.deletedAt) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'ALREADY_DELETED', 'Settlement is already deleted');
        }

        // Permission check: User must be settlement creator or group admin
        const memberData = await this.firestoreReader.getGroupMember(settlement.groupId, userId);
        if (!memberData) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'User is not a member of this group');
        }

        const isCreator = settlement.createdBy === userId;

        if (!isCreator) {
            await this.groupMemberService.ensureActiveGroupAdmin(settlement.groupId, userId, {
                forbiddenErrorFactory: () => new ApiError(HTTP_STATUS.FORBIDDEN, 'INSUFFICIENT_PERMISSIONS', 'Only the creator or group admin can delete this settlement'),
            });
        }

        // Get members for balance update
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(settlement.groupId);
        timer.endPhase();

        // Soft delete with optimistic locking and balance update
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
            if (!currentSettlement) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
            }

            // Check for concurrent updates
            if (settlement.updatedAt !== currentSettlement.updatedAt) {
                throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Document was modified concurrently');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlement.groupId);

            const now = new Date().toISOString();
            const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;

            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                deletedAt: now,
                deletedBy: userId,
                updatedAt: now,
            });

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(settlement.groupId, transaction);

            // Apply incremental balance update to remove this settlement's contribution
            this.incrementalBalanceService.applySettlementDeleted(transaction, settlement.groupId, currentBalance, settlement, memberIds);
        });
        timer.endPhase();

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

        const settlements: SettlementWithMembers[] = await Promise.all(
            result.settlements.map(async (settlement) => {
                const [payerData, payeeData] = await Promise.all([
                    this.userService.resolveGroupMemberProfile(groupId, settlement.payerId),
                    this.userService.resolveGroupMemberProfile(groupId, settlement.payeeId),
                ]);

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
                    isLocked,
                } as SettlementWithMembers;
            }),
        );

        const hasMore = result.hasMore;
        const nextCursor = result.nextCursor;

        return {
            settlements,
            hasMore,
            nextCursor,
        };
    }
}
