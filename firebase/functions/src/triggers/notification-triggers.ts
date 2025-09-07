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
import {NotificationService, notificationService} from '../services/notification-service';
import { PerformanceMonitor } from '../utils/performance-monitor';

const notificationService = new NotificationService()

/**
 * Initialize notification document when a new user is created
 * This ensures every user has a notification document ready for updates
 */
export const initializeUserNotifications = onDocumentCreated(
    {
        document: `${FirestoreCollections.USERS}/{userId}`,
        region: 'us-central1',
    },
    async (event) => {

        const userId = event.params.userId;
        
        return PerformanceMonitor.monitorTriggerExecution(
            'NOTIFICATION_TRIGGER',
            `users/${userId}`,
            async () => {
                await notificationService.initializeUserNotifications(userId);
                
                logger.info('User notification document initialized', { 
                    userId,
                    trigger: 'user-created'
                });
            },
            { userId, action: 'initialize' }
        );
    }
);

/**
 * Add user to group notifications when they join a group
 * Triggered when a new member document is created in a group's members subcollection
 */
export const addUserToGroupNotifications = onDocumentCreated(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}/members/{userId}`,
        region: 'us-central1',
    },
    async (event) => {

        const groupId = event.params.groupId;
        const userId = event.params.userId;
        
        return PerformanceMonitor.monitorTriggerExecution(
            'NOTIFICATION_TRIGGER',
            `groups/${groupId}/members/${userId}`,
            async () => {
                // First ensure user has notification document
                await notificationService.initializeUserNotifications(userId);
                
                // Then add them to the group
                await notificationService.addUserToGroup(userId, groupId);
                
                // Send group change notification to the new user
                await notificationService.updateUserNotification(userId, groupId, 'group');
                
                logger.info('User added to group notifications', { 
                    userId,
                    groupId,
                    trigger: 'member-added'
                });
            },
            { userId, groupId, action: 'add-to-group' }
        );
    }
);

/**
 * Remove user from group notifications when they leave a group
 * Triggered when a member document is deleted from a group's members subcollection
 * 
 * IMPORTANT: This trigger fires for both individual member removal AND group deletion.
 * When a group is deleted, all member documents are deleted, causing this trigger
 * to fire for each member. We must notify users BEFORE removing them from notifications.
 */
export const removeUserFromGroupNotifications = onDocumentDeleted(
    {
        document: `${FirestoreCollections.GROUPS}/{groupId}/members/{userId}`,
        region: 'us-central1',
    },
    async (event) => {

        const groupId = event.params.groupId;
        const userId = event.params.userId;
        
        return PerformanceMonitor.monitorTriggerExecution(
            'NOTIFICATION_TRIGGER',
            `groups/${groupId}/members/${userId}`,
            async () => {
                // CRITICAL: Notify the user about the group change BEFORE removing them
                // This ensures they receive real-time updates about group deletion/removal
                await notificationService.updateUserNotification(userId, groupId, 'group');
                
                logger.info('Group change notification sent before member removal', { 
                    userId,
                    groupId,
                    trigger: 'member-removed'
                });
                
                // Then remove user from group notifications
                await notificationService.removeUserFromGroup(userId, groupId);
                
                logger.info('User removed from group notifications', { 
                    userId,
                    groupId,
                    trigger: 'member-removed'
                });
            },
            { userId, groupId, action: 'remove-from-group' }
        );
    }
);

/**
 * Clean up user notification document when user is deleted
 * This prevents orphaned notification documents from accumulating
 */
export const cleanupUserNotifications = onDocumentDeleted(
    {
        document: `${FirestoreCollections.USERS}/{userId}`,
        region: 'us-central1',
    },
    async (event) => {

        const userId = event.params.userId;
        
        return PerformanceMonitor.monitorTriggerExecution(
            'NOTIFICATION_TRIGGER',
            `users/${userId}`,
            async () => {
                // Delete the user's notification document
                // Using FirestoreWriter's bulkDelete method
                const { FirestoreWriter } = await import('../services/firestore/FirestoreWriter');
                const writer = new FirestoreWriter();
                
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
            },
            { userId, action: 'cleanup' }
        );
    }
);