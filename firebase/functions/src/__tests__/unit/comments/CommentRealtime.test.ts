// Unit tests for comment real-time subscriptions using TenantFirestoreTestDatabase
// Migrated from integration/comments.test.ts to avoid Firebase emulator dependency

import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppDriver } from '../AppDriver';

describe('Comment Real-time Subscriptions - Unit Tests', () => {
    let appDriver: AppDriver;
    const userIds = ['user-0', 'user-1', 'user-2'];

    beforeEach(() => {
        appDriver = new AppDriver();

        // Seed users
        userIds.forEach((userId, index) => {
            appDriver.seedUser(userId, {
                displayName: `User ${index}`,
                email: `user${index}@test.local`,
            });
        });
    });

    afterEach(() => {
        appDriver.dispose();
    });

    describe('Real-time onSnapshot Updates', () => {
        test('should receive real-time updates when comments are added', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Realtime Group')
                .withGroupDisplayName('Owner Display')
                .build(), userIds[0]);

            // Set up listener like the frontend does
            let receivedComments: any[] = [];
            let callbackCount = 0;

            const unsubscribe = appDriver.watchGroupComments(
                group.id,
                (comments) => {
                    callbackCount++;
                    receivedComments = comments;
                },
                { order: 'desc', limit: 20 },
            );

            // Wait for initial snapshot (empty)
            await new Promise((resolve) => setTimeout(resolve, 10));
            const initialCallbackCount = callbackCount;
            expect(receivedComments).toHaveLength(0);

            // Add a comment
            const commentText = 'Real-time test comment';
            await appDriver.createGroupComment(group.id, commentText, userIds[0]);

            // Wait for the update
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Should have received an update
            expect(callbackCount).toBeGreaterThan(initialCallbackCount);
            expect(receivedComments.some((c: any) => c.text === commentText)).toBe(true);

            unsubscribe();
        });

        test('should handle Firestore query ordering correctly', async () => {
            // Create group and add all users as members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Realtime Members Group')
                .withGroupDisplayName('Owner Display')
                .build(), userIds[0]);
            const shareLink = await appDriver.generateShareableLink(group.id, undefined, userIds[0]);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userIds[1]);

            // Add comments with slight delay to ensure ordering
            await appDriver.createGroupComment(group.id, 'First comment', userIds[0]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            await appDriver.createGroupComment(group.id, 'Second comment', userIds[1]);
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Query with descending order (newest first)
            const comments = await appDriver.getGroupCommentSnapshot(group.id, { order: 'desc' });

            expect(comments.length).toBeGreaterThanOrEqual(2);

            const firstComment = comments.find((c: any) => c.text === 'First comment');
            const secondComment = comments.find((c: any) => c.text === 'Second comment');

            expect(firstComment).toBeDefined();
            expect(secondComment).toBeDefined();

            // Newer comment should come first (descending order)
            const firstIndex = comments.indexOf(firstComment as any);
            const secondIndex = comments.indexOf(secondComment as any);
            expect(secondIndex).toBeLessThan(firstIndex);
        });

        test('should receive updates for multiple comments in real-time', async () => {
            // Create group and add all users as members
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Realtime Updates Group')
                .withGroupDisplayName('Owner Display')
                .build(), userIds[0]);
            const shareLink = await appDriver.generateShareableLink(group.id, undefined, userIds[0]);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userIds[1]);
            await appDriver.joinGroupByLink(shareLink.shareToken, undefined, userIds[2]);

            let receivedComments: any[] = [];

            const unsubscribe = appDriver.watchGroupComments(
                group.id,
                (comments) => {
                    receivedComments = comments;
                },
                { order: 'desc' },
            );

            // Wait for initial snapshot
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Add multiple comments
            await appDriver.createGroupComment(group.id, 'Comment 1', userIds[0]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(receivedComments).toHaveLength(1);

            await appDriver.createGroupComment(group.id, 'Comment 2', userIds[1]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(receivedComments).toHaveLength(2);

            await appDriver.createGroupComment(group.id, 'Comment 3', userIds[2]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(receivedComments).toHaveLength(3);

            // Verify all comments are present
            expect(receivedComments.some((c) => c.text === 'Comment 1')).toBe(true);
            expect(receivedComments.some((c) => c.text === 'Comment 2')).toBe(true);
            expect(receivedComments.some((c) => c.text === 'Comment 3')).toBe(true);

            unsubscribe();
        });
    });

    describe('Subscription Lifecycle', () => {
        test('should stop receiving updates after unsubscribe', async () => {
            // Create group
            const group = await appDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Realtime Error Group')
                .withGroupDisplayName('Owner Display')
                .build(), userIds[0]);

            let receivedComments: any[] = [];
            let callbackCount = 0;

            const unsubscribe = appDriver.watchGroupComments(
                group.id,
                (comments) => {
                    callbackCount++;
                    receivedComments = comments;
                },
                { order: 'desc' },
            );

            // Wait for initial snapshot
            await new Promise((resolve) => setTimeout(resolve, 10));
            const initialCallbackCount = callbackCount;

            // Add a comment while subscribed
            await appDriver.createGroupComment(group.id, 'Before unsubscribe', userIds[0]);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(callbackCount).toBeGreaterThan(initialCallbackCount);

            // Unsubscribe
            unsubscribe();

            const countAfterUnsubscribe = callbackCount;

            // Add another comment after unsubscribing
            await appDriver.createGroupComment(group.id, 'After unsubscribe', userIds[0]);
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Callback should not have been called again
            expect(callbackCount).toBe(countAfterUnsubscribe);
        });
    });
});
