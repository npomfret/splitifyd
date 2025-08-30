import { Change, FirestoreEvent, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { firestoreDb } from '../firebase';
import { logger } from '../logger';
import { getChangedFields, getGroupChangedFields, calculatePriority, createMinimalChangeDocument, createMinimalBalanceChangeDocument, ChangeType } from '../utils/change-detection';
import { FirestoreCollections } from '@splitifyd/shared';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import { ParamsOf } from 'firebase-functions';
import { 
    GroupChangeDocumentSchema,
    TransactionChangeDocumentSchema,
    BalanceChangeDocumentSchema 
} from '../schemas/change-documents';

// Change document schemas are now centralized in ../schemas/change-documents.ts

/**
 * Track changes to groups and create change documents for realtime updates
 */
export const trackGroupChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}`,
        region: 'us-central1',
    },
    async (event) => {
        const groupId = event.params.groupId;
        const { before, after, changeType } = extractDataChange(event);

        try {
            // Get changed fields (groups use flat structure)
            const changedFields = getGroupChangedFields(before, after);

            // Calculate priority (not currently used)
            calculatePriority(changeType, changedFields, 'group');

            // Get affected users from the group (flat structure)
            const afterData = after?.data();
            const beforeData = before?.data();

            // Members are stored as a map, not an array of IDs
            const afterMembers = afterData?.members || {};
            const beforeMembers = beforeData?.members || {};

            // Combine all member IDs from both before and after states
            const allMemberIds = new Set([...Object.keys(afterMembers), ...Object.keys(beforeMembers)]);
            const affectedUsers = Array.from(allMemberIds);

            // Create minimal change document for client notifications
            const changeDoc = createMinimalChangeDocument(groupId, 'group', changeType, affectedUsers);

            // Validate before writing to prevent corrupted documents
            const validatedChangeDoc = GroupChangeDocumentSchema.parse(changeDoc);

            // Write to group-changes collection
            await firestoreDb.collection(FirestoreCollections.GROUP_CHANGES).add(validatedChangeDoc);

            logger.info('group-changed', { id: groupId });
        } catch (error) {
            logger.error('Failed to track group change', error as Error, { groupId });
        }
    },
);

/**
 * Track changes to expenses and create change documents for realtime updates
 */
export const trackExpenseChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.EXPENSES}/{expenseId}`,
        region: 'us-central1',
    },
    async (event) => {
        const expenseId = event.params.expenseId;
        const { before, after, changeType } = extractDataChange(event);

        // Process expense changes immediately
        try {
            const beforeData = before?.data();
            const afterData = after?.data();

            // Get groupId from expense data
            const groupId = afterData?.groupId || beforeData?.groupId;
            if (!groupId) {
                return;
            }

            // Get changed fields
            const changedFields = getChangedFields(before, after);

            // Calculate priority (not currently used)
            calculatePriority(changeType, changedFields, 'expense');

            // Get affected users (paidBy and participants)
            const affectedUsers = new Set<string>();

            if (afterData) {
                affectedUsers.add(afterData.paidBy);
                // Handle both old (splitBetween) and new (participants) formats
                const participants = afterData.participants || afterData.splitBetween || [];
                participants.forEach((userId: string) => affectedUsers.add(userId));
            }
            if (beforeData) {
                affectedUsers.add(beforeData.paidBy);
                const participants = beforeData.participants || beforeData.splitBetween || [];
                participants.forEach((userId: string) => affectedUsers.add(userId));
            }

            // Create minimal change document for expense
            const changeDoc = createMinimalChangeDocument(expenseId, 'expense', changeType, Array.from(affectedUsers), groupId);

            // Validate before writing to prevent corrupted documents
            const validatedChangeDoc = TransactionChangeDocumentSchema.parse(changeDoc);

            // Write to transaction-changes collection (expenses use transaction-changes)
            await firestoreDb.collection(FirestoreCollections.TRANSACTION_CHANGES).add(validatedChangeDoc);

            // Also create a minimal balance change document since expenses affect balances
            const balanceChangeDoc = createMinimalBalanceChangeDocument(groupId, Array.from(affectedUsers));

            // Validate balance change document
            const validatedBalanceDoc = BalanceChangeDocumentSchema.parse(balanceChangeDoc);

            await firestoreDb.collection(FirestoreCollections.BALANCE_CHANGES).add(validatedBalanceDoc);

            logger.info('expense-changed', { id: expenseId, groupId });
        } catch (error) {
            logger.error('Failed to track expense change', error as Error, { expenseId });
        }
    },
);

/**
 * Track changes to settlements and create change documents for realtime updates
 */
export const trackSettlementChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        region: 'us-central1',
    },
    async (event) => {
        const settlementId = event.params.settlementId;
        const { before, after, changeType } = extractDataChange(event);

        // Process settlement changes immediately
        try {
            const beforeData = before?.data();
            const afterData = after?.data();

            // Get groupId from settlement data
            const groupId = afterData?.groupId || beforeData?.groupId;
            if (!groupId) {
                // Settlement has no groupId
                return;
            }

            // Get changed fields
            const changedFields = getChangedFields(before, after);

            // Calculate priority (not currently used)
            calculatePriority(changeType, changedFields, 'settlement');

            // Get affected users (payerId and payeeId for API settlements, or from/to for legacy)
            const affectedUsers = new Set<string>();

            if (afterData) {
                // Support both new API format (payerId/payeeId) and legacy format (from/to)
                const payer = afterData.payerId || afterData.from;
                const payee = afterData.payeeId || afterData.to;
                if (payer) affectedUsers.add(payer);
                if (payee) affectedUsers.add(payee);
            }
            if (beforeData) {
                // Support both new API format (payerId/payeeId) and legacy format (from/to)
                const payer = beforeData.payerId || beforeData.from;
                const payee = beforeData.payeeId || beforeData.to;
                if (payer) affectedUsers.add(payer);
                if (payee) affectedUsers.add(payee);
            }

            // Create minimal change document for settlement
            const changeDoc = createMinimalChangeDocument(settlementId, 'settlement', changeType, Array.from(affectedUsers), groupId);

            // Validate before writing to prevent corrupted documents
            const validatedChangeDoc = TransactionChangeDocumentSchema.parse(changeDoc);

            // Write to transaction-changes collection (settlements are a type of transaction)
            await firestoreDb.collection(FirestoreCollections.TRANSACTION_CHANGES).add(validatedChangeDoc);

            // Also create a minimal balance change document since settlements affect balances
            const balanceChangeDoc = createMinimalBalanceChangeDocument(groupId, Array.from(affectedUsers));

            // Validate balance change document
            const validatedBalanceDoc = BalanceChangeDocumentSchema.parse(balanceChangeDoc);

            await firestoreDb.collection(FirestoreCollections.BALANCE_CHANGES).add(validatedBalanceDoc);

            logger.info('settlement-changed', { id: settlementId, groupId });
        } catch (error) {
            logger.error('Failed to track settlement change', error, { settlementId });
        }
    },
);

function extractDataChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
    const before = event.data?.before;
    const after = event.data?.after;

    // Determine change type
    let changeType: ChangeType;
    if (!before?.exists && after?.exists) {
        changeType = 'created';
    } else if (before?.exists && !after?.exists) {
        changeType = 'deleted';
    } else {
        // For document updates, always treat as 'updated' (including soft deletes)
        // Soft deletes are updates that add deletedAt field, not true deletions
        changeType = 'updated';
    }

    return { before, after, changeType };
}
