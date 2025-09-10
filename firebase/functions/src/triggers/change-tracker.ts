import {Change, FirestoreEvent, onDocumentWritten} from 'firebase-functions/v2/firestore';
import {logger} from '../logger';
import {getChangedFields, getGroupChangedFields, calculatePriority, ChangeType} from '../utils/change-detection';
import {FirestoreCollections} from '@splitifyd/shared';
import {DocumentSnapshot} from 'firebase-admin/firestore';
import {ParamsOf} from 'firebase-functions';
import {measureTrigger} from '../monitoring/measure';
import {getAppBuilder} from '../index';
import {getFirestore} from "../firebase";
import {ApplicationBuilder} from "../services/ApplicationBuilder";

const firestore = getFirestore();
const appBuilder = new ApplicationBuilder(firestore);
const firestoreReader = appBuilder.buildFirestoreReader();
const notificationService = appBuilder.buildNotificationService();

export const trackGroupChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}`,
        region: 'us-central1',
    },
    async (event) => {
        const groupId = event.params.groupId;
        const {before, after, changeType} = extractDataChange(event);

        if (changeType === 'deleted') {
            logger.info('group-deleted', {groupId});
            return;
        }

        return measureTrigger('trackGroupChanges', async () => {
            const changedFields = getGroupChangedFields(before, after);

            calculatePriority(changeType, changedFields, 'group');

            const affectedUsers = await (async (): Promise<string[]> => {
                const users: string[] = [];

                try {
                    const members = await firestoreReader.getAllGroupMembers(groupId);

                    members.forEach(member => {
                        users.push(member.userId);
                    });

                } catch (error) {
                    logger.error('group-members-fetch-failed', {groupId, error});
                }

                return users;
            })();

            await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
            logger.info('group-changed', {id: groupId, groupId, usersNotified: affectedUsers.length});
        });
    },
);

export const trackExpenseChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.EXPENSES}/{expenseId}`,
        region: 'us-central1',
    },
    async (event) => {
        const expenseId = event.params.expenseId;
        const {before, after, changeType} = extractDataChange(event);

        const beforeData = before?.data();
        const afterData = after?.data();

        const groupId = afterData?.groupId;
        if (!groupId) {
            throw Error(`groupId missing from ${JSON.stringify(event)}`)
        }


        const changedFields = getChangedFields(before, after);

        calculatePriority(changeType, changedFields, 'expense');

        const affectedUsers = new Set<string>();

        if (afterData) {
            affectedUsers.add(afterData.paidBy);
            afterData.participants.forEach((userId: string) => affectedUsers.add(userId));
        }
        if (beforeData) {
            affectedUsers.add(beforeData.paidBy);
            beforeData.participants.forEach((userId: string) => affectedUsers.add(userId));
        }



        await notificationService.batchUpdateNotifications(Array.from(affectedUsers), groupId!, 'transaction');
        await notificationService.batchUpdateNotifications(Array.from(affectedUsers), groupId!, 'balance');

        logger.info('expense-changed', {id: expenseId, groupId, usersNotified: affectedUsers.size});
    },
);

export const trackSettlementChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        region: 'us-central1',
    },
    async (event) => {
        const settlementId = event.params.settlementId;
        const {before, after, changeType} = extractDataChange(event);

        return measureTrigger('trackSettlementChanges', async () => {
            const beforeData = before?.data();
            const afterData = after?.data();

            const groupId = afterData?.groupId;
            if (!groupId) {
                return;
            }

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

            await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'transaction');
            await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'balance');

            logger.info('settlement-changed', {id: settlementId, groupId, usersNotified: affectedUsers.length});

            return {groupId, affectedUserCount: affectedUsers.length};
        });
    },
);

function extractDataChange(event: FirestoreEvent<Change<DocumentSnapshot> | undefined, ParamsOf<string>>) {
    const before = event.data?.before;
    const after = event.data?.after;

    let changeType: ChangeType;
    if (!before?.exists && after?.exists) {
        changeType = 'created';
    } else if (before?.exists && !after?.exists) {
        changeType = 'deleted';
    } else {
        changeType = 'updated';
    }

    return {before, after, changeType};
}
