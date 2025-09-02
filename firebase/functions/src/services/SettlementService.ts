
import { FieldValue, Filter, Query } from 'firebase-admin/firestore';
import { z } from 'zod';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { createServerTimestamp, safeParseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { getUpdatedAtTimestamp, updateWithTimestamp } from '../utils/optimistic-locking';
import { logger } from '../logger';
import { LoggerContext } from '../utils/logger-context';
import {
    Settlement,
    CreateSettlementRequest,
    UpdateSettlementRequest,
    SettlementListItem,
    RegisteredUser,
    FirestoreCollections,
} from '@splitifyd/shared';
import { verifyGroupMembership } from '../utils/groupHelpers';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { runTransactionWithRetry } from '../utils/firestore-helpers';
import { GroupData } from '../types/group-types';
import { SettlementDocumentSchema } from '../schemas/settlement';

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
    private settlementsCollection = firestoreDb.collection(FirestoreCollections.SETTLEMENTS);
    private usersCollection = firestoreDb.collection(FirestoreCollections.USERS);
    private groupsCollection = firestoreDb.collection(FirestoreCollections.GROUPS);


    /**
     * Verify that specified users are members of the group
     */
    private async verifyUsersInGroup(groupId: string, userIds: string[]): Promise<void> {
        const groupDoc = await this.groupsCollection.doc(groupId).get();

        if (!groupDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
        }

        const groupData = groupDoc.data();
        const groupDataTyped = groupData as GroupData;

        const allMemberIds = Object.keys(groupDataTyped.members || {});

        for (const userId of userIds) {
            if (!allMemberIds.includes(userId)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'USER_NOT_IN_GROUP', `User ${userId} is not a member of this group`);
            }
        }
    }

    /**
     * Fetch user data with validation
     */
    private async fetchUserData(userId: string): Promise<RegisteredUser> {
        const userDoc = await this.usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            // Users are never deleted, so missing user doc indicates invalid data
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', `User ${userId} not found`);
        }

        const rawData = userDoc.data();

        // Validate user data with Zod instead of manual field checking
        try {
            const validatedData = UserDataSchema.parse(rawData);

            return {
                uid: userId,
                email: validatedData.email,
                displayName: validatedData.displayName,
            };
        } catch (error) {
            // Zod validation failed - user document is corrupted
            logger.error('User document validation failed', error, { userId });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_USER_DATA', `User ${userId} has invalid data structure`);
        }
    }

    /**
     * Get a single settlement with user data
     */
    async getSettlement(settlementId: string, userId: string): Promise<SettlementListItem> {
        return PerformanceMonitor.monitorServiceCall(
            'SettlementService',
            'getSettlement',
            async () => this._getSettlement(settlementId, userId),
            { settlementId, userId }
        );
    }

    private async _getSettlement(settlementId: string, userId: string): Promise<SettlementListItem> {
        LoggerContext.update({ settlementId, userId });
        
        const settlementDoc = await this.settlementsCollection.doc(settlementId).get();

        if (!settlementDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Validate and parse settlement data structure - strict enforcement
        const rawData = settlementDoc.data();
        let settlement;
        try {
            settlement = SettlementDocumentSchema.parse({ ...rawData, id: settlementId });
        } catch (error) {
            logger.error('Settlement document validation failed', error as Error, {
                settlementId,
                userId,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_SETTLEMENT_DATA', 'Settlement document structure is invalid');
        }

        await verifyGroupMembership(settlement.groupId, userId);

        const [payerData, payeeData] = await Promise.all([
            this.fetchUserData(settlement.payerId),
            this.fetchUserData(settlement.payeeId)
        ]);

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
        };
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
        return PerformanceMonitor.monitorServiceCall(
            'SettlementService',
            'listSettlements',
            async () => this._listSettlements(groupId, userId, options),
            { groupId, userId, limit: options.limit }
        );
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
        
        await verifyGroupMembership(groupId, userId);

        return this._getGroupSettlementsData(groupId, options);
    }

    /**
     * Create a new settlement
     */
    async createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<Settlement> {
        return PerformanceMonitor.monitorServiceCall(
            'SettlementService',
            'createSettlement',
            async () => this._createSettlement(settlementData, userId),
            { userId, groupId: settlementData.groupId, amount: settlementData.amount }
        );
    }

    private async _createSettlement(settlementData: CreateSettlementRequest, userId: string): Promise<Settlement> {
        LoggerContext.setBusinessContext({ groupId: settlementData.groupId });
        LoggerContext.update({ userId, operation: 'create-settlement', amount: settlementData.amount });
        
        await verifyGroupMembership(settlementData.groupId, userId);
        await this.verifyUsersInGroup(settlementData.groupId, [settlementData.payerId, settlementData.payeeId]);

        const now = createServerTimestamp();
        const settlementDate = settlementData.date ? safeParseISOToTimestamp(settlementData.date) : now;

        const settlementId = this.settlementsCollection.doc().id;

        const settlement: any = {
            id: settlementId,
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
            settlement.note = settlementData.note;
        }

        // Validate settlement document structure before writing to Firestore
        const validatedSettlement = SettlementDocumentSchema.parse(settlement);

        await this.settlementsCollection.doc(settlementId).set(validatedSettlement);
        
        // Update context with the created settlement ID
        LoggerContext.setBusinessContext({ settlementId });

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
        return PerformanceMonitor.monitorServiceCall(
            'SettlementService',
            'updateSettlement',
            async () => this._updateSettlement(settlementId, updateData, userId),
            { settlementId, userId }
        );
    }

    private async _updateSettlement(settlementId: string, updateData: UpdateSettlementRequest, userId: string): Promise<SettlementListItem> {
        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'update-settlement' });
        
        const settlementRef = this.settlementsCollection.doc(settlementId);
        const settlementDoc = await settlementRef.get();

        if (!settlementDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Validate and parse settlement data structure  
        const rawData = settlementDoc.data();
        let settlement;
        try {
            settlement = SettlementDocumentSchema.parse({ ...rawData, id: settlementId });
        } catch (error) {
            logger.error('Settlement document validation failed in updateSettlement', error as Error, {
                settlementId,
                userId,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_SETTLEMENT_DATA', 'Settlement document structure is invalid');
        }

        await verifyGroupMembership(settlement.groupId, userId);

        if (settlement.createdBy !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can update this settlement');
        }

        const updates: any = {
            updatedAt: createServerTimestamp(),
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
        await runTransactionWithRetry(
            async (transaction) => {
                const freshDoc = await transaction.get(settlementRef);
                if (!freshDoc.exists) {
                    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
                }

                const originalUpdatedAt = getUpdatedAtTimestamp(freshDoc.data());
                await updateWithTimestamp(transaction, settlementRef, updates, originalUpdatedAt);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'updateSettlement',
                    userId,
                    groupId: settlement.groupId,
                    settlementId
                }
            }
        );

        const updatedDoc = await settlementRef.get();
        const updatedSettlement = updatedDoc.data();

        // Fetch user data for payer and payee to return complete response
        const [payerData, payeeData] = await Promise.all([
            this.fetchUserData(updatedSettlement!.payerId),
            this.fetchUserData(updatedSettlement!.payeeId)
        ]);

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
        return PerformanceMonitor.monitorServiceCall(
            'SettlementService',
            'deleteSettlement',
            async () => this._deleteSettlement(settlementId, userId),
            { settlementId, userId }
        );
    }

    private async _deleteSettlement(settlementId: string, userId: string): Promise<void> {
        LoggerContext.setBusinessContext({ settlementId });
        LoggerContext.update({ userId, operation: 'delete-settlement' });
        
        const settlementRef = this.settlementsCollection.doc(settlementId);
        const settlementDoc = await settlementRef.get();

        if (!settlementDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        // Validate and parse settlement data structure  
        const rawData = settlementDoc.data();
        let settlement;
        try {
            settlement = SettlementDocumentSchema.parse({ ...rawData, id: settlementId });
        } catch (error) {
            logger.error('Settlement document validation failed in deleteSettlement', error as Error, {
                settlementId,
                userId,
            });
            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INVALID_SETTLEMENT_DATA', 'Settlement document structure is invalid');
        }

        await verifyGroupMembership(settlement.groupId, userId);

        if (settlement.createdBy !== userId) {
            throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can delete this settlement');
        }

        // Delete with optimistic locking to prevent concurrent modifications
        await runTransactionWithRetry(
            async (transaction) => {
                // Step 1: Do ALL reads first
                const freshDoc = await transaction.get(settlementRef);
                if (!freshDoc.exists) {
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
                transaction.delete(settlementRef);
            },
            {
                maxAttempts: 3,
                context: {
                    operation: 'deleteSettlement',
                    userId,
                    groupId: settlement.groupId,
                    settlementId
                }
            }
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

        let query: Query = this.settlementsCollection
            .where('groupId', '==', groupId)
            .orderBy('date', 'desc')
            .limit(limit);

        if (filterUserId) {
            query = query.where(
                Filter.or(
                    Filter.where('payerId', '==', filterUserId),
                    Filter.where('payeeId', '==', filterUserId)
                )
            );
        }

        if (startDate) {
            query = query.where('date', '>=', safeParseISOToTimestamp(startDate));
        }

        if (endDate) {
            query = query.where('date', '<=', safeParseISOToTimestamp(endDate));
        }

        if (cursor) {
            const cursorDoc = await this.settlementsCollection.doc(cursor).get();
            if (cursorDoc.exists) {
                query = query.startAfter(cursorDoc);
            }
        }

        const snapshot = await query.get();

        const settlements: SettlementListItem[] = await Promise.all(
            snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const [payerData, payeeData] = await Promise.all([
                    this.fetchUserData(data.payerId),
                    this.fetchUserData(data.payeeId)
                ]);

                return {
                    id: doc.id,
                    groupId: data.groupId,
                    payer: payerData,
                    payee: payeeData,
                    amount: data.amount,
                    currency: data.currency,
                    date: timestampToISO(data.date),
                    note: data.note,
                    createdAt: timestampToISO(data.createdAt),
                };
            }),
        );

        const hasMore = snapshot.docs.length === limit;
        const nextCursor = hasMore && snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : undefined;

        return {
            settlements,
            count: settlements.length,
            hasMore,
            nextCursor,
        };
    }
}