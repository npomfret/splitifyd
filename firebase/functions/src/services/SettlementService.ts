import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import * as dateHelpers from '../utils/dateHelpers';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import * as measure from '../monitoring/measure';
import { SettlementDTO, CreateSettlementRequest, UpdateSettlementRequest, SettlementWithMembers, GroupMember } from '@splitifyd/shared';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';
import { FirestoreCollections } from "../constants";

/**
 * Zod schema for User document - ensures critical fields are present
 */
const UserDataSchema = z
    .object({
        email: z.string().email(),
        displayName: z.string().min(1),
        // Other fields are optional for this basic validation
    })
    .passthrough(); // Allow additional fields to pass through

/**
 * Service for managing settlement operations
 */
export class SettlementService {
    // Injected dependencies or defaults
    private readonly dateHelpers: typeof import('../utils/dateHelpers');
    private readonly logger: typeof import('../logger').logger;
    private readonly loggerContext: typeof import('../utils/logger-context').LoggerContext;
    private readonly measure: typeof import('../monitoring/measure');

    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
        // Optional dependencies for testing
        injectedDateHelpers?: typeof import('../utils/dateHelpers'),
        injectedLogger?: typeof import('../logger').logger,
        injectedLoggerContext?: typeof import('../utils/logger-context').LoggerContext,
        injectedMeasure?: typeof import('../monitoring/measure')
    ) {
        // Use injected dependencies or fall back to imports
        this.dateHelpers = injectedDateHelpers || dateHelpers;
        this.logger = injectedLogger || logger;
        this.loggerContext = injectedLoggerContext || LoggerContext;
        this.measure = injectedMeasure || measure;
    }

    /**
     * Verify that specified users are members of the group using subcollection
     */
    private async verifyUsersInGroup(groupId: string, userIds: string[]): Promise<void> {
        const groupData = await this.firestoreReader.getGroup(groupId);

        if (!groupData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        // Verify each user is a member
        for (const userId of userIds) {
            const member = await this.groupMemberService.getGroupMember(groupId, userId);
            if (!member) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'USER_NOT_IN_GROUP', `User ${userId} is not a member of this group`);
            }
        }
    }

    /**
     * Fetch group member data for settlements
     */
    private async fetchGroupMemberData(groupId: string, userId: string): Promise<GroupMember> {
        const [userData, memberData] = await Promise.all([
            this.firestoreReader.getUser(userId),
            this.firestoreReader.getGroupMember(groupId, userId)
        ]);

        if (!userData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
        }

        if (!memberData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'MEMBER_NOT_FOUND', `Member ${userId} not found in group ${groupId}`);
        }

        // Validate user data
        try {
            const validatedData = UserDataSchema.parse(userData);

            // Generate initials from display name
            const initials = validatedData.displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

            return {
                uid: userId,
                email: validatedData.email,
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
            this.logger.error('User document validation failed', error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', `User ${userId} has invalid data structure`);
        }
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
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return this.measure.measureDb('SettlementService.listSettlements', async () => this._listSettlements(groupId, userId, options));
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
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        this.loggerContext.setBusinessContext({ groupId });
        this.loggerContext.update({ userId, operation: 'list-settlements' });

        await this.firestoreReader.verifyGroupMembership(groupId, userId);

        return this._getGroupSettlementsData(groupId, options);
    }

    /**
     * Create a new settlement
     */
    async createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<SettlementDTO> {
        return this.measure.measureDb('SettlementService.createSettlement', async () => this._createSettlement(settlementData, userId));
    }

    private async _createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<SettlementDTO> {
        this.loggerContext.setBusinessContext({ groupId: settlementData.groupId });
        this.loggerContext.update({ userId, operation: 'create-settlement', amount: settlementData.amount });

        // Validate amount
        if (settlementData.amount <= 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount must be greater than 0');
        }
        if (settlementData.amount > 999999.99) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount cannot exceed 999999.99');
        }

        await this.firestoreReader.verifyGroupMembership(settlementData.groupId, userId);
        await this.verifyUsersInGroup(settlementData.groupId, [settlementData.payerId, settlementData.payeeId]);

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
        };

        // Only add note if it's provided
        if (settlementData.note) {
            settlementDataToCreate.note = settlementData.note;
        }

        // Create settlement - FirestoreWriter will generate ID and handle validation
        const createResult = await this.firestoreWriter.createSettlement(settlementDataToCreate);
        const settlementId = createResult.id;

        // Update context with the created settlement ID
        this.loggerContext.setBusinessContext({ settlementId });

        // Build the complete settlement object for the response
        const settlement = {
            id: settlementId,
            ...settlementDataToCreate,
        };

        return {
            ...settlement,
            date: this.dateHelpers.timestampToISO(settlementDate),
            createdAt: this.dateHelpers.timestampToISO(now),
            updatedAt: this.dateHelpers.timestampToISO(now),
        };
    }

    /**
     * Update an existing settlement
     */
    async updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementWithMembers> {
        return this.measure.measureDb('SettlementService.updateSettlement', async () => this._updateSettlement(settlementId, updateData, userId));
    }

    private async _updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementWithMembers> {
        this.loggerContext.setBusinessContext({ settlementId });
        this.loggerContext.update({ userId, operation: 'update-settlement' });

        const settlementData = await this.firestoreReader.getSettlement(settlementId);

        if (!settlementData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Settlement data is already validated by FirestoreReader
        const settlement = settlementData;

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

        // Update with optimistic locking
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
                if (!currentSettlement) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
                }

                const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
                this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                    ...updates,
                    updatedAt: new Date().toISOString(), // ISO string, FirestoreWriter converts
                });
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateSettlement',
                    userId,
                    groupId: settlement.groupId,
                    settlementId,
                },
            },
        );

        const updatedSettlement = await this.firestoreReader.getSettlement(settlementId);

        // Fetch group member data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([
            this.fetchGroupMemberData(updatedSettlement!.groupId, updatedSettlement!.payerId),
            this.fetchGroupMemberData(updatedSettlement!.groupId, updatedSettlement!.payeeId)
        ]);

        return {
            id: settlementId,
            groupId: updatedSettlement!.groupId,
            payer: payerData,
            payee: payeeData,
            amount: updatedSettlement!.amount,
            currency: updatedSettlement!.currency,
            date: this.dateHelpers.timestampToISO(updatedSettlement!.date),
            note: updatedSettlement!.note,
            createdAt: this.dateHelpers.timestampToISO(updatedSettlement!.createdAt),
        };
    }

    /**
     * Delete a settlement
     */
    async deleteSettlement(settlementId: string, userId: string): Promise<void> {
        return this.measure.measureDb('SettlementService.deleteSettlement', async () => this._deleteSettlement(settlementId, userId));
    }

    private async _deleteSettlement(settlementId: string, userId: string): Promise<void> {
        this.loggerContext.setBusinessContext({ settlementId });
        this.loggerContext.update({ userId, operation: 'delete-settlement' });

        const settlementData = await this.firestoreReader.getSettlement(settlementId);

        if (!settlementData) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Settlement data is already validated by FirestoreReader
        const settlement = settlementData;

        await this.firestoreReader.verifyGroupMembership(settlement.groupId, userId);

        if (settlement.createdBy !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can delete this settlement');
        }

        // Delete with optimistic locking to prevent concurrent modifications
        await this.firestoreWriter.runTransaction(
            async (transaction) => {
                // Step 1: Do ALL reads first - using DTO method
                const currentSettlement = await this.firestoreReader.getSettlementInTransaction(transaction, settlementId);
                if (!currentSettlement) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
                }

                // Step 2: Check for concurrent updates (compare ISO strings)
                if (settlement.updatedAt !== currentSettlement.updatedAt) {
                    throw new ApiError(HTTP_STATUS.CONFLICT, 'CONCURRENT_UPDATE', 'Document was modified concurrently');
                }

                // Step 3: Now do ALL writes
                // Delete the settlement
                const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
                this.firestoreWriter.deleteInTransaction(transaction, documentPath);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'deleteSettlement',
                    userId,
                    groupId: settlement.groupId,
                    settlementId,
                },
            },
        );
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
        } = {},
    ): Promise<{
        settlements: SettlementWithMembers[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        this.loggerContext.setBusinessContext({ groupId });
        this.loggerContext.update({ operation: 'get-group-settlements-data', limit: options.limit || 50 });

        const limit = options.limit || 50;
        const cursor = options.cursor;
        const filterUserId = options.uid;
        const startDate = options.startDate;
        const endDate = options.endDate;

        const result = await this.firestoreReader.getSettlementsForGroupPaginated(groupId, {
            limit,
            cursor,
            filterUserId,
            startDate,
            endDate,
        });

        const settlements: SettlementWithMembers[] = await Promise.all(
            result.settlements.map(async (settlement) => {
                const [payerData, payeeData] = await Promise.all([
                    this.fetchGroupMemberData(groupId, settlement.payerId),
                    this.fetchGroupMemberData(groupId, settlement.payeeId)
                ]);

                return {
                    id: settlement.id,
                    groupId: settlement.groupId,
                    payer: payerData,
                    payee: payeeData,
                    amount: settlement.amount,
                    currency: settlement.currency,
                    date: this.dateHelpers.timestampToISO(settlement.date),
                    note: settlement.note,
                    createdAt: this.dateHelpers.timestampToISO(settlement.createdAt),
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
