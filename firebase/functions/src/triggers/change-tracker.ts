import {Change, FirestoreEvent, onDocumentWritten, onDocumentDeleted} from 'firebase-functions/v2/firestore';
import {logger} from '../logger';
import {ChangeType} from '../utils/change-detection';
import {FirestoreCollections} from '@splitifyd/shared';
import {DocumentSnapshot} from 'firebase-admin/firestore';
import {ParamsOf} from 'firebase-functions';
import {measureTrigger} from '../monitoring/measure';
import {getFirestore} from '../firebase';
import {ApplicationBuilder} from '../services/ApplicationBuilder';

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
        const {changeType} = extractDataChange(event);

        if (changeType === 'deleted') {
            logger.info('group-deleted', {groupId});
            return;
        }

        return measureTrigger('trackGroupChanges', async () => {
            const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
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
        const {after} = extractDataChange(event);

        const afterData = after?.data();

        const groupId = afterData?.groupId;
        if (!groupId) {
            throw Error(`groupId missing from ${JSON.stringify(event)}`);
        }

        const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
        await notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId!, ['transaction', 'balance']);

        logger.info('expense-changed', {id: expenseId, groupId, usersNotified: affectedUsers.length});
    },
);

export const trackSettlementChanges = onDocumentWritten(
    {
        document: `${FirestoreCollections.SETTLEMENTS}/{settlementId}`,
        region: 'us-central1',
    },
    async (event) => {
        const settlementId = event.params.settlementId;
        const {after} = extractDataChange(event);

        return measureTrigger('trackSettlementChanges', async () => {
            const afterData = after?.data();

            const groupId = afterData?.groupId;
            if (!groupId) {
                throw Error(`groupId missing from ${JSON.stringify(event)}`);
            }

            const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
            await notificationService.batchUpdateNotificationsMultipleTypes(affectedUsers, groupId, ['transaction', 'balance']);

            logger.info('settlement-changed', {id: settlementId, groupId, usersNotified: affectedUsers.length});

            return {groupId, affectedUserCount: affectedUsers.length};
        });
    },
);

export const trackMembershipDeletion = onDocumentDeleted(
    {
        document: `${FirestoreCollections.GROUP_MEMBERSHIPS}/{membershipId}`,
        region: 'us-central1',
    },
    async (event) => {
        const membershipId = event.params.membershipId;
        const deletedData = event.data?.data();

        if (!deletedData) {
            throw Error(`No data found for deleted membership ${membershipId}`);
        }

        const userId = deletedData.userId;
        const groupId = deletedData.groupId;

        if (!userId || !groupId) {
            throw Error(`Missing required fields in deleted membership ${membershipId}: userId=${userId}, groupId=${groupId}`);
        }

        return measureTrigger('trackMembershipDeletion', async () => {
            // Get group details for the notification
            const group = await firestoreReader.getGroup(groupId);
            
            // Send removal notification to the user using standard group change notification
            await notificationService.batchUpdateNotifications([userId], groupId, 'group');
            
            // Clean up the user's notification document after sending the notification
            await notificationService.removeUserFromGroup(userId, groupId);

            logger.info('user-removal-notification-sent', {
                userId,
                groupId,
                groupName: group?.name || 'Unknown Group',
                membershipId
            });
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
