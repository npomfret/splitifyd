
import {onDocumentCreated, onDocumentDeleted} from 'firebase-functions/v2/firestore';
import {FirestoreCollections} from '@splitifyd/shared';
import {logger} from '../logger';
import {measureTrigger} from '../monitoring/measure';
import {getFirestore} from "../firebase";
import {ApplicationBuilder} from "../services/ApplicationBuilder";

const firestore = getFirestore();
const appBuilder = new ApplicationBuilder(firestore);
const notificationService = appBuilder.buildNotificationService();

export function createNotificationTriggers() {

    return {
        initializeUserNotifications: onDocumentCreated(
            {
                document: `${FirestoreCollections.USERS}/{userId}`,
                region: 'us-central1',
            },
            async (event) => {
                const userId = event.params.userId;

                return measureTrigger('initializeUserNotifications', async () => {

                    await notificationService.initializeUserNotifications(userId);

                    logger.info('user-notifications-init', {userId});
                });
            }
        ),


        removeUserFromGroupNotifications: onDocumentDeleted(
            {
                document: `${FirestoreCollections.GROUP_MEMBERSHIPS}/{membershipId}`,
                region: 'us-central1',
            },
            async (event) => {
                const membershipData = event.data?.data();
                if (!membershipData) {
                    logger.error('membership-data-missing', {membershipId: event.params.membershipId});
                    return;
                }

                const groupId = membershipData.groupId;
                const userId = membershipData.userId;

                return measureTrigger('removeUserFromGroupNotifications',
                    async () => {

                        await notificationService.updateUserNotification(userId, groupId, 'group');

                        await notificationService.removeUserFromGroup(userId, groupId);

                        logger.info('user-removed-from-group', {userId, groupId});
                    });
            }
        ),

        cleanupUserNotifications: onDocumentDeleted(
            {
                document: `${FirestoreCollections.USERS}/{userId}`,
                region: 'us-central1',
            },
            async (event) => {
                const userId = event.params.userId;

                return measureTrigger('cleanupUserNotifications', async () => {
                    const firestoreWriter = appBuilder.buildFirestoreWriter();

                    const result = await firestoreWriter.bulkDelete([`user-notifications/${userId}`]);

                    if (result.successCount > 0) {
                        logger.info('user-notifications-cleanup', {userId});
                    } else {
                        logger.error('user-notifications-cleanup-failed', {userId, failureCount: result.failureCount});
                    }
                });
            }
        )
    };
}