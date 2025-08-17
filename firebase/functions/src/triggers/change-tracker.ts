import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin } from '../firebase';
import { logger } from '../logger';
import * as adminFirestore from 'firebase-admin/firestore';
import { 
    ChangeDebouncer, 
    getChangedFields,
    getGroupChangedFields,
    calculatePriority,
    createChangeDocument,
    ChangeType 
} from '../utils/change-detection';

const db = admin.firestore();

/**
 * Track changes to groups and create change documents for realtime updates
 */
export const trackGroupChanges = onDocumentWritten(
    {
        document: 'groups/{groupId}',
        region: 'us-central1',
    },
    async (event) => {
        const groupId = event.params.groupId;
        const before = event.data?.before;
        const after = event.data?.after;

        // Determine change type
        let changeType: ChangeType;
        if (!before?.exists && after?.exists) {
            changeType = 'created';
        } else if (before?.exists && !after?.exists) {
            changeType = 'deleted';
        } else {
            changeType = 'updated';
        }

        // Debounce rapid changes (except for deletes which should be immediate)
        const debounceDelay = changeType === 'deleted' ? 0 : 500;
        
        ChangeDebouncer.debounce(
            `group-${groupId}`,
            async () => {
                try {
                    // Get changed fields (groups have nested structure)
                    const changedFields = getGroupChangedFields(before, after);
                    
                    // Calculate priority
                    const priority = calculatePriority(changeType, changedFields, 'group');
                    
                    // Get affected users from the group (nested in data field)
                    const afterData = after?.data();
                    const beforeData = before?.data();
                    const affectedUsers = afterData?.data?.memberIds || beforeData?.data?.memberIds || [];
                    
                    // Get the user who made the change (if available)
                    const changeUserId = afterData?.userId || afterData?.data?.lastModifiedBy;

                    logger.info('Creating group change document', { 
                        groupId, 
                        changeType, 
                        priority,
                        changedFields: changedFields.slice(0, 10), // Log first 10 fields
                        affectedUsers 
                    });

                    // Create standardized change document
                    const changeDoc = createChangeDocument(
                        groupId,
                        'group',
                        changeType,
                        {
                            priority,
                            affectedUsers,
                            changedFields
                        },
                        {
                            groupId, // Include for consistency
                            changeUserId
                        }
                    );

                    // Write to group-changes collection
                    const docRef = await db.collection('group-changes').add(changeDoc);

                    logger.info('Group change tracked', { 
                        groupId, 
                        changeType, 
                        priority,
                        changeDocId: docRef.id 
                    });
                } catch (error) {
                    logger.errorWithContext('Failed to track group change', error as Error, { groupId });
                }
            },
            debounceDelay
        );
    },
);

/**
 * Track changes to expenses and create change documents for realtime updates
 */
export const trackExpenseChanges = onDocumentWritten(
    {
        document: 'expenses/{expenseId}',
        region: 'us-central1',
    },
    async (event) => {
        const expenseId = event.params.expenseId;
        const before = event.data?.before;
        const after = event.data?.after;

        // Determine change type
        let changeType: ChangeType;
        if (!before?.exists && after?.exists) {
            changeType = 'created';
        } else if (before?.exists && !after?.exists) {
            changeType = 'deleted';
        } else {
            changeType = 'updated';
        }

        // Expenses affect balances immediately, use shorter debounce
        const debounceDelay = changeType === 'deleted' ? 0 : 200;
        
        ChangeDebouncer.debounce(
            `expense-${expenseId}`,
            async () => {
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
                    
                    // Get the user who made the change
                    const changeUserId = afterData?.createdBy || afterData?.lastModifiedBy;

                    logger.info('Creating expense change document', { 
                        expenseId, 
                        groupId,
                        changeType, 
                        priority,
                        changedFields: changedFields.slice(0, 10)
                    });

                    // Create standardized change document
                    const changeDoc = createChangeDocument(
                        expenseId,
                        'expense',
                        changeType,
                        {
                            priority,
                            affectedUsers: Array.from(affectedUsers),
                            changedFields
                        },
                        {
                            groupId,
                            changeUserId
                        }
                    );

                    // Write to expense-changes collection
                    await db.collection('expense-changes').add(changeDoc);

                    // Also create a balance change document since expenses affect balances
                    // Balance changes are always high priority
                    const balanceChangeDoc = {
                        groupId,
                        changeType: 'recalculated' as const,
                        timestamp: adminFirestore.Timestamp.now(),
                        metadata: {
                            priority: 'high' as const,
                            affectedUsers: Array.from(affectedUsers),
                            triggeredBy: 'expense',
                            triggerId: expenseId,
                        },
                    };

                    await db.collection('balance-changes').add(balanceChangeDoc);

                    logger.info('Expense change tracked', { 
                        expenseId, 
                        groupId, 
                        changeType,
                        priority 
                    });
                } catch (error) {
                    logger.errorWithContext('Failed to track expense change', error as Error, { expenseId });
                }
            },
            debounceDelay
        );
    },
);

/**
 * Track changes to settlements and create change documents for realtime updates
 */
export const trackSettlementChanges = onDocumentWritten(
    {
        document: 'settlements/{settlementId}',
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
            changeType = 'updated';
        }

        // Settlements affect balances immediately, use shorter debounce
        const debounceDelay = changeType === 'deleted' ? 0 : 200;
        
        ChangeDebouncer.debounce(
            `settlement-${settlementId}`,
            async () => {
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
                    
                    // Get the user who made the change
                    const changeUserId = afterData?.createdBy || afterData?.lastModifiedBy;

                    logger.info('Creating settlement change document', { 
                        settlementId, 
                        groupId,
                        changeType, 
                        priority,
                        changedFields: changedFields.slice(0, 10)
                    });

                    // Create standardized change document
                    const changeDoc = createChangeDocument(
                        settlementId,
                        'settlement',
                        changeType,
                        {
                            priority,
                            affectedUsers: Array.from(affectedUsers),
                            changedFields
                        },
                        {
                            groupId,
                            changeUserId
                        }
                    );

                    // Write to expense-changes collection (settlements are treated as expenses)
                    await db.collection('expense-changes').add(changeDoc);

                    // Also create a balance change document since settlements affect balances
                    // Balance changes are always high priority
                    const balanceChangeDoc = {
                        groupId,
                        changeType: 'recalculated' as const,
                        timestamp: adminFirestore.Timestamp.now(),
                        metadata: {
                            priority: 'high' as const,
                            affectedUsers: Array.from(affectedUsers),
                            triggeredBy: 'settlement',
                            triggerId: settlementId,
                        },
                    };

                    await db.collection('balance-changes').add(balanceChangeDoc);

                    logger.info('Settlement change tracked', { 
                        settlementId, 
                        groupId, 
                        changeType,
                        priority 
                    });
                } catch (error) {
                    logger.errorWithContext('Failed to track settlement change', error as Error, { settlementId });
                }
            },
            debounceDelay
        );
    },
);
