/**
 * Notification Triggers for User Lifecycle Events
 *
 * These triggers manage the lifecycle of user notification documents:
 * - Initialize notification documents when users are created
 * - Add users to group notifications when they join groups
 * - Remove users from group notifications when they leave groups
 * - Clean up notification documents when users are deleted
 *
 * These triggers only run when the new notification system is enabled.
 */

import {onDocumentCreated, onDocumentDeleted} from 'firebase-functions/v2/firestore';
import {FirestoreCollections} from '@splitifyd/shared';
import {logger} from '../logger';
import {measureTrigger} from '../monitoring/measure';
import {getAppBuilder} from '../index';

// Use singleton ApplicationBuilder
const notificationService = getAppBuilder().buildNotificationService();

/**
 * Create notification triggers
 */
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

                    logger.info('User notification document initialized', {
                        userId,
                        trigger: 'user-created'
                    });
                });
            }
        ),

        addUserToGroupNotifications: onDocumentCreated(
            {
                document: `${FirestoreCollections.GROUP_MEMBERSHIPS}/{membershipId}`,
                region: 'us-central1',
            },
            async (event) => {
                // Extract userId and groupId from the membership document data
                const membershipData = event.data?.data();
                if (!membershipData) {
                    logger.warn('No membership data found in trigger event', {membershipId: event.params.membershipId});
                    return;
                }

                const groupId = membershipData.groupId;
                const userId = membershipData.userId;

                return measureTrigger('addUserToGroupNotifications',
                    async () => {

                        // First ensure user has notification document
                        await notificationService.initializeUserNotifications(userId);

                        // Then add them to the group
                        await notificationService.addUserToGroupNotificationTracking(userId, groupId);

                        // Send group change notification to the new user
                        await notificationService.updateUserNotification(userId, groupId, 'group');

                        logger.info('User added to group notifications', {
                            userId,
                            groupId,
                            trigger: 'member-added'
                        });
                    });
            }
        ),

        removeUserFromGroupNotifications: onDocumentDeleted(
            {
                document: `${FirestoreCollections.GROUP_MEMBERSHIPS}/{membershipId}`,
                region: 'us-central1',
            },
            async (event) => {
                // Extract userId and groupId from the deleted membership document data
                const membershipData = event.data?.data();
                if (!membershipData) {
                    logger.warn('No membership data found in deleted document trigger event', {membershipId: event.params.membershipId});
                    return;
                }

                const groupId = membershipData.groupId;
                const userId = membershipData.userId;

                return measureTrigger('removeUserFromGroupNotifications',
                    async () => {

                        // CRITICAL: Notify the user about the group change BEFORE removing them
                        // This ensures they receive real-time updates about group deletion/removal
                        await notificationService.updateUserNotification(userId, groupId, 'group');

                        // Then remove user from group notifications
                        await notificationService.removeUserFromGroup(userId, groupId);

                        logger.info('User removed from group notifications', {
                            userId,
                            groupId,
                            trigger: 'member-removed'
                        });
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
                    // Use singleton ApplicationBuilder
                    const firestoreWriter = getAppBuilder().buildFirestoreWriter();

                    // Delete the user's notification document
                    const result = await firestoreWriter.bulkDelete([`user-notifications/${userId}`]);

                    if (result.successCount > 0) {
                        logger.info('User notification document cleaned up', {
                            userId,
                            trigger: 'user-deleted'
                        });
                    } else {
                        logger.warn('User notification document cleanup failed or not found', {
                            userId,
                            failureCount: result.failureCount
                        });
                    }
                });
            }
        )
    };
}