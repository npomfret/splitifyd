import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from '../firebase';
import { logger } from '../logger';
import { 
    getChangedFields, 
    getGroupChangedFields, 
    calculatePriority, 
    createMinimalChangeDocument,
    createMinimalBalanceChangeDocument,
    ChangeType 
} from '../utils/change-detection';
import { FirestoreCollections } from '../shared/shared-types';

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
        const before = event.data?.before;
        const after = event.data?.after;

        logger.info('🔥 GROUP TRIGGER FIRED', {
            groupId,
            beforeExists: before?.exists,
            afterExists: after?.exists,
            eventId: event.id || 'unknown',
        });

        // Determine change type
        let changeType: ChangeType;
        if (!before?.exists && after?.exists) {
            changeType = 'created';
        } else if (before?.exists && !after?.exists) {
            changeType = 'deleted';
        } else {
            changeType = 'updated';
        }

        logger.info('🔥 GROUP CHANGE TYPE DETERMINED', { groupId, changeType });

        logger.info('🔥 GROUP TRIGGER EXECUTING', { groupId, changeType });
        try {
            // Get changed fields (groups have nested structure)
            const changedFields = getGroupChangedFields(before, after);

            logger.info('🔥 GROUP CHANGED FIELDS', { groupId, changedFields });

            // Calculate priority
            const priority = calculatePriority(changeType, changedFields, 'group');

            // Get affected users from the group (nested in data field)
            const afterData = after?.data();
            const beforeData = before?.data();
            const affectedUsers = afterData?.data?.memberIds || beforeData?.data?.memberIds || [];

            logger.info('🔥 GROUP DATA EXTRACTED', {
                groupId,
                afterData: afterData ? 'present' : 'missing',
                beforeData: beforeData ? 'present' : 'missing',
                affectedUsers,
            });

            logger.info('🔥 Creating group change document', {
                groupId,
                changeType,
                priority,
                affectedUsers: affectedUsers.length,
            });

            // Create minimal change document for client notifications
            const changeDoc = createMinimalChangeDocument(
                groupId,
                'group',
                changeType,
                affectedUsers
            );

            logger.info('🔥 GROUP CHANGE DOC CREATED', { 
                groupId, 
                docStructure: Object.keys(changeDoc) 
            });

            // Write to group-changes collection
            const docRef = await db.collection(FirestoreCollections.GROUP_CHANGES).add(changeDoc);

            logger.info('🔥 Group change tracked SUCCESS', {
                groupId,
                changeType,
                priority,
                changeDocId: docRef.id,
            });
        } catch (error) {
            logger.errorWithContext('🔥 Failed to track group change', error as Error, { groupId });
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
        const before = event.data?.before;
        const after = event.data?.after;

        logger.info('🔥 EXPENSE TRIGGER FIRED', {
            expenseId,
            beforeExists: before?.exists,
            afterExists: after?.exists,
            eventId: event.id || 'unknown',
        });

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

        logger.info('🔥 EXPENSE CHANGE TYPE DETERMINED', { expenseId, changeType });

        // Process expense changes immediately
        try {
            const beforeData = before?.data();
            const afterData = after?.data();

            // Get groupId from expense data
            const groupId = afterData?.groupId || beforeData?.groupId;
            if (!groupId) {
                logger.warn('Expense has no groupId', { expenseId });
                return;
            }

            // Get changed fields
            const changedFields = getChangedFields(before, after);

            // Calculate priority
            const priority = calculatePriority(changeType, changedFields, 'expense');

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

            logger.info('Creating expense change document', {
                expenseId,
                groupId,
                changeType,
                priority,
                affectedUsers: affectedUsers.size,
            });

            // Create minimal change document for expense
            const changeDoc = createMinimalChangeDocument(
                expenseId,
                'expense',
                changeType,
                Array.from(affectedUsers),
                groupId
            );

            // Write to transaction-changes collection (expenses use transaction-changes)
            await db.collection(FirestoreCollections.TRANSACTION_CHANGES).add(changeDoc);

            // Also create a minimal balance change document since expenses affect balances
            const balanceChangeDoc = createMinimalBalanceChangeDocument(
                groupId,
                Array.from(affectedUsers)
            );

            await db.collection(FirestoreCollections.BALANCE_CHANGES).add(balanceChangeDoc);

            logger.info('Expense change tracked', {
                expenseId,
                groupId,
                changeType,
                priority,
            });
        } catch (error) {
            logger.errorWithContext('Failed to track expense change', error as Error, { expenseId });
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

        // Process settlement changes immediately
        try {
            const beforeData = before?.data();
            const afterData = after?.data();

            // Get groupId from settlement data
            const groupId = afterData?.groupId || beforeData?.groupId;
            if (!groupId) {
                logger.warn('Settlement has no groupId', { settlementId });
                return;
            }

            // Get changed fields
            const changedFields = getChangedFields(before, after);

            // Calculate priority
            const priority = calculatePriority(changeType, changedFields, 'settlement');

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

            logger.info('Creating settlement change document', {
                settlementId,
                groupId,
                changeType,
                priority,
                affectedUsers: affectedUsers.size,
            });

            // Create minimal change document for settlement
            const changeDoc = createMinimalChangeDocument(
                settlementId,
                'settlement',
                changeType,
                Array.from(affectedUsers),
                groupId
            );

            // Write to transaction-changes collection (settlements are a type of transaction)
            await db.collection(FirestoreCollections.TRANSACTION_CHANGES).add(changeDoc);

            // Also create a minimal balance change document since settlements affect balances
            const balanceChangeDoc = createMinimalBalanceChangeDocument(
                groupId,
                Array.from(affectedUsers)
            );

            await db.collection(FirestoreCollections.BALANCE_CHANGES).add(balanceChangeDoc);

            logger.info('Settlement change tracked', {
                settlementId,
                groupId,
                changeType,
                priority,
            });
        } catch (error) {
            logger.errorWithContext('Failed to track settlement change', error as Error, { settlementId });
        }
    },
);
