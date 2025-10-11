import { CreateSettlementRequest, GroupMember, SettlementDTO, SettlementWithMembers, UpdateSettlementRequest } from '@splitifyd/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FirestoreCollections, HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import * as measure from '../monitoring/measure';
import { PerformanceTimer } from '../monitoring/PerformanceTimer';
import * as dateHelpers from '../utils/dateHelpers';
import { ApiError, Errors } from '../utils/errors';
import { LoggerContext } from '../utils/logger-context';
import { IncrementalBalanceService } from './balance/IncrementalBalanceService';
import type { IFirestoreReader, IFirestoreWriter } from './firestore';

/**
 * Zod schema for User document - ensures critical fields are present
 */
const UserDataSchema = z
    .object({
        displayName: z.string().min(1),
        // Other fields are optional for this basic validation
    })
    .passthrough(); // Allow additional fields to pass through

/**
 * Service for managing settlement operations
 */
export class SettlementService {
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly incrementalBalanceService: IncrementalBalanceService,
    ) {}
    /**
     * Fetch group member data for settlements
     * Handles both current members and departed members (who have left the group)
     * to allow viewing historical transaction data
     */
    private async fetchGroupMemberData(groupId: string, userId: string): Promise<GroupMember> {
        const [userData, memberData] = await Promise.all([this.firestoreReader.getUser(userId), this.firestoreReader.getGroupMember(groupId, userId)]);

        if (!userData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
        }

        // Validate user data
        try {
            const validatedData = UserDataSchema.parse(userData);

            // Generate initials from display name
            const initials = validatedData
                .displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            // If memberData is null, the user has left the group
            // Show real user profile data; use sentinel values for missing membership fields
            if (!memberData) {
                return {
                    uid: userId,
                    displayName: validatedData.displayName,
                    initials,
                    photoURL: userData.photoURL || null,
                    themeColor: userData.themeColor || {
                        light: '#9CA3AF',
                        dark: '#6B7280',
                        name: 'Neutral Gray',
                        pattern: 'solid',
                        assignedAt: new Date().toISOString(),
                        colorIndex: -1,
                    },
                    memberRole: 'member', // Last known role before departure
                    memberStatus: 'active', // Last known status (can't use 'left' - not in enum)
                    joinedAt: '', // Historical data unavailable
                    invitedBy: undefined,
                };
            }

            // Normal path: member is still in the group
            return {
                uid: userId,
                displayName: validatedData.displayName,
                initials,
                photoURL: userData.photoURL || null,
                themeColor: memberData.theme,
                memberRole: memberData.memberRole,
                memberStatus: memberData.memberStatus,
                joinedAt: memberData.joinedAt, // Already ISO string from DTO
                invitedBy: memberData.invitedBy,
            };
        } catch (error) {
            logger.error('User document validation failed', error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', `User ${userId} has invalid data structure`);
        }
    }

    /**
     * Check if settlement is locked due to departed members
     * A settlement is locked if payer or payee is no longer in the group
     */
    private async isSettlementLocked(settlement: SettlementDTO, groupId: string): Promise<boolean> {
        const currentMemberIds = await this.firestoreReader.getAllGroupMemberIds(groupId);
        return !currentMemberIds.includes(settlement.payerId)
            || !currentMemberIds.includes(settlement.payeeId);
    }

    /**
     * List settlements for a group with pagination and filtering
     */
    async listSettlements(
        groupId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            uid?: string;
            startDate?: string;
            endDate?: string;
            includeDeleted?: boolean;
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return measure.measureDb('SettlementService.listSettlements', async () => this._listSettlements(groupId, userId, options));
    }

    private async _listSettlements(
        groupId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            uid?: string;
            startDate?: string;
            endDate?: string;
            includeDeleted?: boolean;
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ userId, operation: 'list-settlements' });

        timer.startPhase('query');
        await this.firestoreReader.verifyGroupMembership(groupId, userId);
        const result = await this._getGroupSettlementsData(groupId, options);
        timer.endPhase();

        logger.info('settlements-listed', {
            groupId,
            count: result.count,
            timings: timer.getTimings(),
        });

        return result;
    }

    /**
     * Create a new settlement
     */
    async createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<SettlementDTO> {
        return measure.measureDb('SettlementService.createSettlement', async () => this._createSettlement(settlementData, userId));
    }

    private async _createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<SettlementDTO> {
        const timer = new PerformanceTimer();

        LoggerContext.setBusinessContext({ groupId: settlementData.groupId });
        LoggerContext.update({ userId, operation: 'create-settlement', amount: settlementData.amount });

        timer.startPhase('query');

        // Verify group exists first (like ExpenseService)
        const [groupData, memberIds, member] = await Promise.all([
            this.firestoreReader.getGroup(settlementData.groupId),
            this.firestoreReader.getAllGroupMemberIds(settlementData.groupId),
            this.firestoreReader.getGroupMember(settlementData.groupId, userId),
        ]);

        if (!groupData) {
            throw Errors.NOT_FOUND('Group');
        }

        if (!member || !memberIds.includes(userId)) {
            throw Errors.FORBIDDEN();
        }

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

        const now = new Date().toISOString();
        const settlementDate = settlementData.date || now;

        const settlementDataToCreate: any = {
            groupId: settlementData.groupId,
            payerId: settlementData.payerId,
            payeeId: settlementData.payeeId,
            amount: settlementData.amount,
            currency: settlementData.currency,
            date: settlementDate, // ISO string
            createdBy: userId,
            createdAt: now, // ISO string
            updatedAt: now,
            // Soft delete fields - initialize to null (not deleted)
            deletedAt: null,
            deletedBy: null,
        };

        // Only add note if it's provided
        if (settlementData.note) {
            settlementDataToCreate.note = settlementData.note;
        }

        // Generate settlement ID before transaction
        const settlementId = this.firestoreWriter.generateDocumentId(FirestoreCollections.SETTLEMENTS);

        // Get members for balance update
        timer.endPhase();

        // Create settlement and update group balance atomically
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            // Verify group still exists
            const groupData = await this.firestoreReader.getGroupInTransaction(transaction, settlementData.groupId);
            if (!groupData) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlementData.groupId);

            // Create settlement in transaction
            this.firestoreWriter.createInTransaction(transaction, FirestoreCollections.SETTLEMENTS, settlementId, settlementDataToCreate);

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(settlementData.groupId, transaction);

            // Apply incremental balance update
            const settlementToApply: SettlementDTO = { id: settlementId, ...settlementDataToCreate };
            this.incrementalBalanceService.applySettlementCreated(transaction, settlementData.groupId, currentBalance, settlementToApply, memberIds);
        });
        timer.endPhase();

        // Update context with the created settlement ID
        LoggerContext.setBusinessContext({ settlementId });

        logger.info('settlement-created', {
            settlementId,
            groupId: settlementData.groupId,
            timings: timer.getTimings(),
        });

        // Build the complete settlement object for the response
        const settlement = {
            id: settlementId,
            ...settlementDataToCreate,
        };

        return {
            ...settlement,
            date: dateHelpers.timestampToISO(settlementDate),
            createdAt: dateHelpers.timestampToISO(now),
            updatedAt: dateHelpers.timestampToISO(now),
        };
    }

    /**
     * Update an existing settlement
     */
    async updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementWithMembers> {
        return measure.measureDb('SettlementService.updateSettlement', async () => this._updateSettlement(settlementId, updateData, userId));
    }

    private async _updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementWithMembers> {
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

        await this.firestoreReader.verifyGroupMembership(settlement.groupId, userId);

        if (settlement.createdBy !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can update this settlement');
        }

        const updates: any = {
            updatedAt: new Date().toISOString(), // ISO string
        };

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

        // Get members for balance update
        const memberIds = await this.firestoreReader.getAllGroupMemberIds(settlement.groupId);
        timer.endPhase();

        // Update with optimistic locking and balance update
        timer.startPhase('transaction');
        await this.firestoreWriter.runTransaction(async (transaction) => {
            const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
            if (!currentSettlement) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
            }

            // Read current balance BEFORE any writes (Firestore transaction rule)
            const currentBalance = await this.firestoreWriter.getGroupBalanceInTransaction(transaction, settlement.groupId);

            const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
            this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                ...updates,
                updatedAt: new Date().toISOString(), // ISO string, FirestoreWriter converts
            });

            // Update group timestamp to track activity
            await this.firestoreWriter.touchGroup(settlement.groupId, transaction);

            // Apply incremental balance update with old and new settlement
            const newSettlement: SettlementDTO = { ...settlement, ...updates };
            this.incrementalBalanceService.applySettlementUpdated(transaction, settlement.groupId, currentBalance, settlement, newSettlement, memberIds);
        });
        timer.endPhase();

        timer.startPhase('refetch');
        const updatedSettlement = await this.firestoreReader.getSettlement(settlementId);

        // Fetch group member data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([
            this.fetchGroupMemberData(updatedSettlement!.groupId, updatedSettlement!.payerId),
            this.fetchGroupMemberData(updatedSettlement!.groupId, updatedSettlement!.payeeId),
        ]);
        timer.endPhase();

        logger.info('settlement-updated', {
            settlementId,
            groupId: settlement.groupId,
            timings: timer.getTimings(),
        });

        return {
            id: settlementId,
            groupId: updatedSettlement!.groupId,
            payer: payerData,
            payee: payeeData,
            amount: updatedSettlement!.amount,
            currency: updatedSettlement!.currency,
            date: dateHelpers.timestampToISO(updatedSettlement!.date),
            note: updatedSettlement!.note,
            createdAt: dateHelpers.timestampToISO(updatedSettlement!.createdAt),
            deletedAt: updatedSettlement!.deletedAt,
            deletedBy: updatedSettlement!.deletedBy,
        };
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
    async softDeleteSettlement(settlementId: string, userId: string): Promise<void> {
        return measure.measureDb('SettlementService.softDeleteSettlement', async () => this._softDeleteSettlement(settlementId, userId));
    }

    private async _softDeleteSettlement(settlementId: string, userId: string): Promise<void> {
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
        const isAdmin = memberData.memberRole === 'admin';

        if (!isCreator && !isAdmin) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'INSUFFICIENT_PERMISSIONS', 'Only the creator or group admin can delete this settlement');
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
        groupId: string,
        options: {
            limit?: number;
            cursor?: string;
            uid?: string;
            startDate?: string;
            endDate?: string;
            includeDeleted?: boolean;
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
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
                    this.fetchGroupMemberData(groupId, settlement.payerId),
                    this.fetchGroupMemberData(groupId, settlement.payeeId),
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
                    date: dateHelpers.timestampToISO(settlement.date),
                    note: settlement.note,
                    createdAt: dateHelpers.timestampToISO(settlement.createdAt),
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
            count: settlements.length,
            hasMore,
            nextCursor,
        };
    }
}
