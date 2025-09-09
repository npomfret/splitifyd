import { Change, FirestoreEvent, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from '../logger';
import { getChangedFields, getGroupChangedFields, calculatePriority, ChangeType } from '../utils/change-detection';
import { FirestoreCollections } from '@splitifyd/shared';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import { ParamsOf } from 'firebase-functions';
import { measureTrigger } from '../monitoring/measure';
import { FirestoreReader } from '../services/firestore/FirestoreReader';
import {getFirestore} from "../firebase";
import {IFirestoreReader} from "../services/firestore";
import { NotificationService } from "../services/notification-service";

const firestore = getFirestore();
const notificationService = new NotificationService(firestore, new FirestoreReader(firestore));

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

        return measureTrigger('trackGroupChanges', async () => {
                // Get changed fields (groups use flat structure)
                const changedFields = getGroupChangedFields(before, after);

                // Calculate priority (not currently used)
                calculatePriority(changeType, changedFields, 'group');

                // Get affected users from the group subcollection
                const affectedUsers = await (async (): Promise<string[]> => {
                    const users: string[] = [];
                    
                    // For CREATE/UPDATE events, query the current subcollection using FirestoreReader
                    try {
                        const firestoreReader: IFirestoreReader = new FirestoreReader(getFirestore());
                        const members = await firestoreReader.getMembersFromSubcollection(groupId);
                        
                        members.forEach(member => {
                            users.push(member.userId);
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
                })();

                // Update user notifications for CREATE/UPDATE events
                await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
                logger.info('group-changed', { id: groupId, groupId, usersNotified: affectedUsers.length });
        });
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
            const groupId = afterData?.groupId;
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
                afterData.participants.forEach((userId: string) => affectedUsers.add(userId));
            }
            if (beforeData) {
                affectedUsers.add(beforeData.paidBy);
                beforeData.participants.forEach((userId: string) => affectedUsers.add(userId));
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

        return measureTrigger('trackGroupChanges', async () => {
                const beforeData = before?.data();
                const afterData = after?.data();

                // Get groupId from settlement data
                const groupId = afterData?.groupId;
                if (!groupId) {
                    return;
                }

                // Get affected users (payerId and payeeId)
                const affectedUsers = await (async (): Promise<string[]> => {
                    const users = new Set<string>();

                    if (afterData) {
                        users.add(afterData.payerId);
                        users.add(afterData.payeeId);
                    }
                    if (beforeData) {
                        users.add(beforeData.payerId);
                        users.add(beforeData.payeeId);
                    }

                    return Array.from(users);
                })();

                // Update user notifications for transaction and balance changes
                await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'transaction');
                await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'balance');
                
                logger.info('settlement-changed', { id: settlementId, groupId, usersNotified: affectedUsers.length });

                return { groupId, affectedUserCount: affectedUsers.length };
        });
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
