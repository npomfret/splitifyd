import * as admin from 'firebase-admin';
import { z } from 'zod';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { safeParseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import {
    SettlementListItem,
    User,
    FirestoreCollections,
} from '@splitifyd/shared';
import { verifyGroupMembership } from '../utils/groupHelpers';

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
 * Zod schema for Settlement document - validates before writing to Firestore
 */
const SettlementDocumentSchema = z.object({
    id: z.string().min(1),
    groupId: z.string().min(1),
    payerId: z.string().min(1),
    payeeId: z.string().min(1),
    amount: z.number().min(0),
    currency: z.string().min(1),
    date: z.any(), // Firestore Timestamp
    createdBy: z.string().min(1),
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
    note: z.string().optional(),
});

/**
 * Service for managing settlement operations
 */
export class SettlementService {
    private settlementsCollection = firestoreDb.collection(FirestoreCollections.SETTLEMENTS);
    private usersCollection = firestoreDb.collection(FirestoreCollections.USERS);


    /**
     * Fetch user data with validation
     */
    private async fetchUserData(userId: string): Promise<User> {
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
        const settlementDoc = await this.settlementsCollection.doc(settlementId).get();

        if (!settlementDoc.exists) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
        }

        const settlement = settlementDoc.data() as any;

        // Validate settlement data structure - strict enforcement
        try {
            SettlementDocumentSchema.parse({ ...settlement, id: settlementId });
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
        await verifyGroupMembership(groupId, userId);

        return this._getGroupSettlementsData(groupId, options);
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
        const limit = options.limit || 50;
        const cursor = options.cursor;
        const filterUserId = options.userId;
        const startDate = options.startDate;
        const endDate = options.endDate;

        let query: admin.firestore.Query = this.settlementsCollection
            .where('groupId', '==', groupId)
            .orderBy('date', 'desc')
            .limit(limit);

        if (filterUserId) {
            query = query.where(
                admin.firestore.Filter.or(
                    admin.firestore.Filter.where('payerId', '==', filterUserId),
                    admin.firestore.Filter.where('payeeId', '==', filterUserId)
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