import { Change, FirestoreEvent, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from '../logger';
import { ChangeType } from '../utils/change-detection';
import { DocumentSnapshot } from 'firebase-admin/firestore';
import { ParamsOf } from 'firebase-functions';
import { measureTrigger } from '../monitoring/measure';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { FirestoreCollections } from '../constants';

const firestore = getFirestore();
const appBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const firestoreReader = appBuilder.buildFirestoreReader();
const notificationService = appBuilder.buildNotificationService();

export const trackGroupChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}`,
        region: 'us-central1',
    },
    async (event) => {
        const groupId = event.params.groupId;
        const { changeType } = extractDataChange(event);

        if (changeType === 'deleted') {
            logger.info('group-deleted', { groupId });
            return;
        }

        return measureTrigger('trackGroupChanges', async () => {
            const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);

            if (affectedUsers.length > 0) {
                await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'group');
            }

            logger.info('group-changed', { id: groupId, groupId, usersNotified: affectedUsers.length });
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
        const { after } = extractDataChange(event);

        return measureTrigger('trackExpenseChanges', async () => {
            const afterData = after?.data();

            const groupId = afterData?.groupId;
            if (!groupId) {
                throw Error(`groupId missing from expense ${expenseId}`);
            }

            const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
            await notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, ['transaction', 'balance']);

            logger.info('expense-changed', { id: expenseId, groupId, usersNotified: affectedUsers.length });
        });
    },
);

export const trackSettlementChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        region: 'us-central1',
    },
    async (event) => {
        const settlementId = event.params.settlementId;
        const { after } = extractDataChange(event);

        return measureTrigger('trackSettlementChanges', async () => {
            const afterData = after?.data();

            const groupId = afterData?.groupId;
            if (!groupId) {
                throw Error(`groupId missing from ${JSON.stringify(event)}`);
            }

            const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
            await notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, ['transaction', 'balance']);

            logger.info('settlement-changed', { id: settlementId, groupId, usersNotified: affectedUsers.length });

            return { groupId, affectedUserCount: affectedUsers.length };
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

    return { before, after, changeType };
}
