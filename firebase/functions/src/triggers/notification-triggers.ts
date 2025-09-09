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

import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FirestoreCollections } from '@splitifyd/shared';
import { logger } from '../logger';
import { measureTrigger } from '../monitoring/measure';
import { registerAllServices } from '../services/serviceRegistration';
import {getFirestore} from "../firebase";
import { IFirestoreWriter } from "../services/firestore/IFirestoreWriter";
import { NotificationService } from "../services/notification-service";
import { FirestoreReader } from "../services/firestore";

const firestore = getFirestore();
const notificationService = new NotificationService(firestore, new FirestoreReader(firestore));

// Services registration state
let servicesRegistered = false;

function ensureServicesRegistered() {
    if (!servicesRegistered) {
        registerAllServices(firestore);
        servicesRegistered = true;
    }
}

/**
 * Create notification triggers
 */
export function createNotificationTriggers() {
    // Ensure services are registered once
    ensureServicesRegistered();

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
                document: `${FirestoreCollections.GROUPS}/{groupId}/members/{userId}`,
                region: 'us-central1',
            },
            async (event) => {
                const groupId = event.params.groupId;
                const userId = event.params.userId;
                
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
                document: `${FirestoreCollections.GROUPS}/{groupId}/members/{userId}`,
                region: 'us-central1',
            },
            async (event) => {
                const groupId = event.params.groupId;
                const userId = event.params.userId;
                
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
                        // Delete the user's notification document
                        // Using FirestoreWriter's bulkDelete method
                        const { FirestoreWriter } = await import('../services/firestore/FirestoreWriter');
                        const writer: IFirestoreWriter = new FirestoreWriter(firestore);
                        
                        const result = await writer.bulkDelete([`user-notifications/${userId}`]);
                        
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