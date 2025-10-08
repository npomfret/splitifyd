import { PooledTestUser } from '@splitifyd/shared';
import { borrowTestUsers, NotificationDriver } from '@splitifyd/test-support';
import { ApiDriver, TestExpenseManager } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

/**
 * Minimal Comments integration tests - only testing Firebase-specific behavior
 * that cannot be stubbed. Most business logic is now covered by unit tests.
 */
describe('Comments Integration Tests (Essential Firebase Behavior)', () => {
    const apiDriver = new ApiDriver();
    const firestore = getFirestore();
    const notificationDriver = new NotificationDriver(firestore);
    let testGroup: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        const members = users.slice(0, 2);
        const setup = await TestExpenseManager.getGroupWithExpenseForComments(members);
        testGroup = setup.group;
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Firebase Security Rules and Authentication', () => {
        test('should enforce authentication for comment creation via API', async () => {
            // This tests actual Firebase security rules that cannot be stubbed
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should enforce group membership via security rules', async () => {
            // This tests actual Firebase security rules for access control
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });
    });

    describe('Real-time Firestore Subscriptions', () => {
        test('should handle real-time updates via onSnapshot pattern', async () => {
            // This tests actual Firestore real-time behavior that cannot be stubbed
            let receivedComments: any[] = [];
            let callbackCount = 0;

            // Set up listener like the frontend does
            const unsubscribe = firestore
                .collection(`groups/${testGroup.id}/comments`)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .onSnapshot((snapshot) => {
                    callbackCount++;
                    receivedComments = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                });

            // Wait for initial snapshot
            await new Promise((resolve) => setTimeout(resolve, 100));
            const initialCallbackCount = callbackCount;

            // Add a comment
            const commentText = `Real-time test ${uuidv4()}`;
            await apiDriver.createGroupComment(testGroup.id, commentText, users[0].token);

            // Wait for the update
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Should have received an update
            expect(callbackCount).toBeGreaterThan(initialCallbackCount);
            expect(receivedComments.some((c: any) => c.text === commentText)).toBe(true);

            unsubscribe();
        });

        test('should handle Firestore query ordering correctly', async () => {
            // This tests actual Firestore query behavior
            await apiDriver.createGroupComment(testGroup.id, 'First comment', users[0].token);
            await new Promise((resolve) => setTimeout(resolve, 100));
            await apiDriver.createGroupComment(testGroup.id, 'Second comment', users[1].token);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Query Firestore directly to test ordering
            const snapshot = await firestore.collection(`groups/${testGroup.id}/comments`).orderBy('createdAt', 'desc').get();
            const comments = snapshot.docs.map((doc) => doc.data());

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
    });
});
