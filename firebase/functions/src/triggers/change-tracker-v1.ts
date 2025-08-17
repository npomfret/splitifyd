import * as functionsV1 from 'firebase-functions/v1';
import { db } from '../firebase';
import { logger } from '../logger';
import { 
    ChangeDebouncer, 
    getChangedFields,
    getGroupChangedFields,
    calculatePriority,
    createChangeDocument,
    ChangeType 
} from '../utils/change-detection';

/**
 * Track changes to groups and create change documents for realtime updates
 */
export const trackGroupChanges = functionsV1.firestore
    .document('groups/{groupId}')
    .onWrite(async (change, context) => {
        const groupId = context.params.groupId;
        const before = change.before;
        const after = change.after;

        // Determine change type
        let changeType: ChangeType;
        if (!before.exists && after.exists) {
            changeType = 'created';
        } else if (before.exists && !after.exists) {
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
                    const changedFields = getGroupChangedFields(
                        before.exists ? before : undefined,
                        after.exists ? after : undefined
                    );
                    
                    // Calculate priority
                    const priority = calculatePriority(changeType, changedFields, 'group');
                    
                    // Get affected users from the group (nested in data field)
                    const afterData = after.exists ? after.data() : undefined;
                    const beforeData = before.exists ? before.data() : undefined;
                    const affectedUsers = afterData?.data?.memberIds || beforeData?.data?.memberIds || [];
                    
                    // Get the user who made the change (if available)
                    const changeUserId = afterData?.userId || afterData?.data?.lastModifiedBy;

                    logger.info('Creating group change document', { 
                        groupId, 
                        changeType, 
                        priority,
                        changedFields: changedFields.slice(0, 10),
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
                            groupId,
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
    });

/**
 * Track changes to expenses and create change documents for realtime updates
 */
export const trackExpenseChanges = functionsV1.firestore
    .document('expenses/{expenseId}')
    .onWrite(async (change, context) => {
        const expenseId = context.params.expenseId;
        const before = change.before;
        const after = change.after;
        
        // Determine change type
        let changeType: ChangeType;
        if (!before.exists && after.exists) {
            changeType = 'created';
        } else if (before.exists && !after.exists) {
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
                    const beforeData = before.exists ? before.data() : undefined;
                    const afterData = after.exists ? after.data() : undefined;
                    
                    // Get groupId from expense data
                    const groupId = afterData?.groupId || beforeData?.groupId;
                    if (!groupId) {
                        logger.warn('Expense has no groupId', { expenseId });
                        return;
                    }

                    // Get changed fields
                    const changedFields = getChangedFields(
                        before.exists ? before : undefined,
                        after.exists ? after : undefined
                    );
                    
                    // Calculate priority
                    const priority = calculatePriority(changeType, changedFields, 'expense');

                    // Get affected users (participants in the expense)
                    const affectedUsers = new Set<string>();
                    if (afterData) {
                        if (afterData.paidBy) affectedUsers.add(afterData.paidBy);
                        if (afterData.participants) {
                            afterData.participants.forEach((userId: string) => affectedUsers.add(userId));
                        }
                    }
                    if (beforeData) {
                        if (beforeData.paidBy) affectedUsers.add(beforeData.paidBy);
                        if (beforeData.participants) {
                            beforeData.participants.forEach((userId: string) => affectedUsers.add(userId));
                        }
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
                    const docRef = await db.collection('expense-changes').add(changeDoc);

                    logger.info('Expense change tracked', { 
                        expenseId, 
                        groupId,
                        changeType, 
                        priority,
                        changeDocId: docRef.id 
                    });

                    // Also trigger balance recalculation change
                    if (changeType !== 'updated' || changedFields.some(f => ['amount', 'splits', 'paidBy'].includes(f))) {
                        const balanceChangeDoc = createChangeDocument(
                            groupId,
                            'group',
                            'updated' as ChangeType,
                            {
                                priority: 'high',
                                affectedUsers: Array.from(affectedUsers),
                                changedFields: ['balances']
                            },
                            {
                                groupId,
                                triggeredBy: 'expense',
                                triggerId: expenseId
                            }
                        );
                        
                        // Change the collection to balance-changes for balance updates
                        const balanceDoc: any = {
                            ...balanceChangeDoc,
                            changeType: 'recalculated',
                            metadata: {
                                ...balanceChangeDoc.metadata,
                                triggeredBy: 'expense',
                                triggerId: expenseId
                            }
                        };
                        delete balanceDoc.groupId; // Remove duplicate field
                        
                        await db.collection('balance-changes').add(balanceDoc);
                        logger.info('Balance change triggered by expense', { expenseId, groupId });
                    }
                } catch (error) {
                    logger.errorWithContext('Failed to track expense change', error as Error, { expenseId });
                }
            },
            debounceDelay
        );
    });

/**
 * Track changes to settlements and create change documents for realtime updates
 */
export const trackSettlementChanges = functionsV1.firestore
    .document('settlements/{settlementId}')
    .onWrite(async (change, context) => {
        const settlementId = context.params.settlementId;
        const before = change.before;
        const after = change.after;

        // Determine change type
        let changeType: ChangeType;
        if (!before.exists && after.exists) {
            changeType = 'created';
        } else if (before.exists && !after.exists) {
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
                    const beforeData = before.exists ? before.data() : undefined;
                    const afterData = after.exists ? after.data() : undefined;
                    
                    // Get groupId from settlement data
                    const groupId = afterData?.groupId || beforeData?.groupId;
                    if (!groupId) {
                        logger.warn('Settlement has no groupId', { settlementId });
                        return;
                    }

                    // Get changed fields
                    const changedFields = getChangedFields(
                        before.exists ? before : undefined,
                        after.exists ? after : undefined
                    );
                    
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

                    // Write to expense-changes collection (settlements share the same collection)
                    const docRef = await db.collection('expense-changes').add(changeDoc);

                    logger.info('Settlement change tracked', { 
                        settlementId,
                        groupId,
                        changeType, 
                        priority,
                        changeDocId: docRef.id 
                    });

                    // Also trigger balance recalculation change
                    const balanceChangeDoc = createChangeDocument(
                        groupId,
                        'group',
                        'updated' as ChangeType,
                        {
                            priority: 'high',
                            affectedUsers: Array.from(affectedUsers),
                            changedFields: ['balances']
                        },
                        {
                            groupId,
                            triggeredBy: 'settlement',
                            triggerId: settlementId
                        }
                    );
                    
                    // Change the collection to balance-changes for balance updates
                    const balanceDoc: any = {
                        ...balanceChangeDoc,
                        changeType: 'recalculated',
                        metadata: {
                            ...balanceChangeDoc.metadata,
                            triggeredBy: 'settlement',
                            triggerId: settlementId
                        }
                    };
                    delete balanceDoc.groupId; // Remove duplicate field
                    
                    await db.collection('balance-changes').add(balanceDoc);
                    logger.info('Balance change triggered by settlement', { settlementId, groupId });
                } catch (error) {
                    logger.errorWithContext('Failed to track settlement change', error as Error, { settlementId });
                }
            },
            debounceDelay
        );
    });