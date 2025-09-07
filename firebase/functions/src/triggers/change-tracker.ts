import { Change, FirestoreEvent, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from '../firebase';
import { logger } from '../logger';
import { getChangedFields, getGroupChangedFields, calculatePriority, ChangeType } from '../utils/change-detection';
import { FirestoreCollections } from '@splitifyd/shared';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import { ParamsOf } from 'firebase-functions';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { NotificationService } from '../services/notification-service';

const notificationService = new NotificationService();

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
        const documentPath = `groups/${groupId}`;

        // For DELETE events, notification-triggers handle member removal automatically
        // when member documents are deleted, so no additional work needed here
        if (changeType === 'deleted') {
            logger.info('Group deletion detected - notifications handled by member deletion triggers', { 
                groupId, 
                changeType 
            });
            return;
        }

        return PerformanceMonitor.monitorTriggerExecution(
            'CHANGE_TRACKER',
            documentPath,
            async (stepTracker) => {
                // Get changed fields (groups use flat structure)
                const changedFields = getGroupChangedFields(before, after);

                // Calculate priority (not currently used)
                calculatePriority(changeType, changedFields, 'group');

                // Get affected users from the group subcollection
                const affectedUsers: string[] = await stepTracker('member-fetch', async () => {
                    const users: string[] = [];
                    
                    // For CREATE/UPDATE events, query the current subcollection
                    try {
                        const membersSnapshot = await getFirestore()
                            .collection(FirestoreCollections.GROUPS)
                            .doc(groupId)
                            .collection('members')
                            .get();
                        
                        membersSnapshot.forEach(memberDoc => {
                            users.push(memberDoc.id);
                        });
                        
                        logger.info('Fetched group members for change tracking', { 
                            groupId, 
                            changeType,
                            memberCount: users.length,
                            members: users 
                        });
                    } catch (error) {
                        logger.warn('Could not fetch group members for change tracking', { groupId, changeType, error });
                        // If we can't get members, we still create the change document but with empty users array
                        // This ensures change detection still works at the group level
                    }
                    
                    return users;
                });

                // Update user notifications for CREATE/UPDATE events
                await stepTracker('notification-update', async () => {
                    await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
                    logger.info('group-changed', { id: groupId, groupId, usersNotified: affectedUsers.length });
                });
            },
            { changeType, changedFieldsCount: Object.keys(getGroupChangedFields(before, after)).length }
        );
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

            // Update user notifications for transaction and balance changes
            await notificationService.batchUpdateNotifications(Array.from(affectedUsers), groupId!, 'transaction');
            await notificationService.batchUpdateNotifications(Array.from(affectedUsers), groupId!, 'balance');

            logger.info('expense-changed', { id: expenseId, groupId, usersNotified: affectedUsers.size });
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
        const documentPath = `settlements/${settlementId}`;

        return PerformanceMonitor.monitorTriggerExecution(
            'CHANGE_TRACKER',
            documentPath,
            async (stepTracker) => {
                const beforeData = before?.data();
                const afterData = after?.data();

                // Get groupId from settlement data
                const groupId = afterData?.groupId || beforeData?.groupId;
                if (!groupId) {
                    // Settlement has no groupId
                    return;
                }

                // Get affected users (payerId and payeeId for API settlements, or from/to for legacy)
                const affectedUsers: string[] = await stepTracker('user-extraction', async () => {
                    const users = new Set<string>();

                    if (afterData) {
                        // Support both new API format (payerId/payeeId) and legacy format (from/to)
                        const payer = afterData.payerId || afterData.from;
                        const payee = afterData.payeeId || afterData.to;
                        if (payer) users.add(payer);
                        if (payee) users.add(payee);
                    }
                    if (beforeData) {
                        // Support both new API format (payerId/payeeId) and legacy format (from/to)
                        const payer = beforeData.payerId || beforeData.from;
                        const payee = beforeData.payeeId || beforeData.to;
                        if (payer) users.add(payer);
                        if (payee) users.add(payee);
                    }

                    return Array.from(users);
                });

                // Update user notifications for transaction and balance changes
                await stepTracker('notification-update', async () => {
                    await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'transaction');
                    await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'balance');
                    
                    logger.info('settlement-changed', { id: settlementId, groupId, usersNotified: affectedUsers.length });
                });

                return { groupId, affectedUserCount: affectedUsers.length };
            },
            { changeType, entityType: 'settlement' }
        );
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
