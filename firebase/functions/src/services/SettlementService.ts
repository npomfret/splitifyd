import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createOptimisticTimestamp, safeParseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { getUpdatedAtTimestamp } from '../utils/optimistic-locking';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import { Settlement, CreateSettlementRequest, UpdateSettlementRequest, SettlementListItem, RegisteredUser, FirestoreCollections } from '@splitifyd/shared';
import { measureDb } from '../monitoring/measure';
import { SettlementDocumentSchema, UserDocument } from '../schemas';
import type { IFirestoreReader } from './firestore';
import type { IFirestoreWriter } from './firestore';
import { GroupMemberService } from './GroupMemberService';

// Re-export schema for backward compatibility
export { SettlementDocumentSchema };

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
    constructor(
        private readonly firestoreReader: IFirestoreReader,
        private readonly firestoreWriter: IFirestoreWriter,
        private readonly groupMemberService: GroupMemberService,
    ) {}

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
     * Fetch user data with validation
     */
    private async fetchUserData(userId: string): Promise<RegisteredUser> {
        const userData = await this.firestoreReader.getUser(userId);

        if (!userData) {
            // Users are never deleted, so missing user doc indicates invalid data
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
        }

        // Validate user data with Zod instead of manual field checking
        try {
            const validatedData = UserDataSchema.parse(userData);

            return {
                uid: userId,
                email: validatedData.email,
                displayName: validatedData.displayName,
                emailVerified: Boolean(userData.emailVerified),
                photoURL: userData.photoURL || null,
                role: userData.role,
                termsAcceptedAt: userData.termsAcceptedAt,
                cookiePolicyAcceptedAt: userData.cookiePolicyAcceptedAt,
                acceptedPolicies: userData.acceptedPolicies,
                themeColor: typeof userData.themeColor === 'object' ? userData.themeColor as RegisteredUser['themeColor'] : undefined,
                preferredLanguage: userData.preferredLanguage,
                createdAt: userData.createdAt,
                updatedAt: userData.updatedAt,
            };
        } catch (error) {
            // Zod validation failed - user document is corrupted
            logger.error('User document validation failed', error, { userId });
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
            userId?: string;
            startDate?: string;
            endDate?: string;
        } = {},
    ): Promise<{
        settlements: SettlementListItem[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        return measureDb('SettlementService.listSettlements', async () => this._listSettlements(groupId, userId, options));
    }

    private async _listSettlements(
        groupId: string,
        userId: string,
        options: {
            limit?: number;
            cursor?: string;
            userId?: string;
            startDate?: string;
            endDate?: string;
        } = {},
    ): Promise<{
        settlements: SettlementListItem[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ userId, operation: 'list-settlements' });

        await this.firestoreReader.verifyGroupMembership(groupId, userId);

        return this._getGroupSettlementsData(groupId, options);
    }

    /**
     * Create a new settlement
     */
    async createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<Settlement> {
        return measureDb('SettlementService.createSettlement', async () => this._createSettlement(settlementData, userId));
    }

    private async _createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<Settlement> {
        LoggerContext.setBusinessContext({ groupId: settlementData.groupId });
        LoggerContext.update({ userId, operation: 'create-settlement', amount: settlementData.amount });

        // Validate amount
        if (settlementData.amount <= 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount must be greater than 0');
        }
        if (settlementData.amount > 999999.99) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', 'Amount cannot exceed 999999.99');
        }

        await this.firestoreReader.verifyGroupMembership(settlementData.groupId, userId);
        await this.verifyUsersInGroup(settlementData.groupId, [settlementData.payerId, settlementData.payeeId]);

        const now = createOptimisticTimestamp();
        const settlementDate = settlementData.date ? safeParseISOToTimestamp(settlementData.date) : now;

        const settlementDataToCreate: any = {
            groupId: settlementData.groupId,
            payerId: settlementData.payerId,
            payeeId: settlementData.payeeId,
            amount: settlementData.amount,
            currency: settlementData.currency,
            date: settlementDate,
            createdBy: userId,
            createdAt: now,
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
        LoggerContext.setBusinessContext({ settlementId });

        // Build the complete settlement object for the response
        const settlement = {
            id: settlementId,
            ...settlementDataToCreate,
        };

        return {
            ...settlement,
            date: timestampToISO(settlementDate),
            createdAt: timestampToISO(now),
            updatedAt: timestampToISO(now),
        };
    }

    /**
     * Update an existing settlement
     */
    async updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementListItem> {
        return measureDb('SettlementService.updateSettlement', async () => this._updateSettlement(settlementId, updateData, userId));
    }

    private async _updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementListItem> {
        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'update-settlement' });

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
            updatedAt: createOptimisticTimestamp(),
        };

        if (updateData.amount !== undefined) {
            updates.amount = updateData.amount;
        }

        if (updateData.currency !== undefined) {
            updates.currency = updateData.currency;
        }

        if (updateData.date !== undefined) {
            updates.date = safeParseISOToTimestamp(updateData.date);
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
                const freshDoc = await this.firestoreReader.getRawSettlementDocumentInTransaction(transaction, settlementId);
                if (!freshDoc) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
                }

                const documentPath = `${FirestoreCollections.SETTLEMENTS}/${settlementId}`;
                this.firestoreWriter.updateInTransaction(transaction, documentPath, {
                    ...updates,
                    updatedAt: createOptimisticTimestamp(),
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

        // Fetch user data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([this.fetchUserData(updatedSettlement!.payerId), this.fetchUserData(updatedSettlement!.payeeId)]);

        return {
            id: settlementId,
            groupId: updatedSettlement!.groupId,
            payer: payerData,
            payee: payeeData,
            amount: updatedSettlement!.amount,
            currency: updatedSettlement!.currency,
            date: timestampToISO(updatedSettlement!.date),
            note: updatedSettlement!.note,
            createdAt: timestampToISO(updatedSettlement!.createdAt),
        };
    }

    /**
     * Delete a settlement
     */
    async deleteSettlement(settlementId: string, userId: string): Promise<void> {
        return measureDb('SettlementService.deleteSettlement', async () => this._deleteSettlement(settlementId, userId));
    }

    private async _deleteSettlement(settlementId: string, userId: string): Promise<void> {
        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'delete-settlement' });

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
                // Step 1: Do ALL reads first
                const freshDoc = await this.firestoreReader.getRawSettlementDocumentInTransaction(transaction, settlementId);
                if (!freshDoc) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
                }

                const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data());

                // Step 2: Check for concurrent updates inline (no additional reads needed)
                const currentTimestamp = freshDoc.data()?.updatedAt;
                if (!currentTimestamp || !currentTimestamp.isEqual(originalUpdatedAt)) {
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
            userId?: string;
            startDate?: string;
            endDate?: string;
        } = {},
    ): Promise<{
        settlements: SettlementListItem[];
        count: number;
        hasMore: boolean;
        nextCursor?: string;
    }> {
        LoggerContext.setBusinessContext({ groupId });
        LoggerContext.update({ operation: 'get-group-settlements-data', limit: options.limit || 50 });

        const limit = options.limit || 50;
        const cursor = options.cursor;
        const filterUserId = options.userId;
        const startDate = options.startDate;
        const endDate = options.endDate;

        const result = await this.firestoreReader.getSettlementsForGroupPaginated(groupId, {
            limit,
            cursor,
            filterUserId,
            startDate,
            endDate,
        });

        const settlements: SettlementListItem[] = await Promise.all(
            result.settlements.map(async (settlement) => {
                const [payerData, payeeData] = await Promise.all([this.fetchUserData(settlement.payerId), this.fetchUserData(settlement.payeeId)]);

                return {
                    id: settlement.id,
                    groupId: settlement.groupId,
                    payer: payerData,
                    payee: payeeData,
                    amount: settlement.amount,
                    currency: settlement.currency,
                    date: timestampToISO(settlement.date),
                    note: settlement.note,
                    createdAt: timestampToISO(settlement.createdAt),
                } as SettlementListItem;
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
