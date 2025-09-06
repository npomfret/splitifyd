// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import {beforeEach, describe, expect, test} from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, TestExpenseManager} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";
import {getFirestore} from '../../../firebase';

describe('Comments Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let testExpense: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);

        // Use shared group and expense for comment testing
        const members = users.slice(0, 2);
        const setup = await TestExpenseManager.getGroupWithExpenseForComments(members);
        testGroup = setup.group;
        testExpense = setup.expense;
    });

    describe('Group Comments via API', () => {
        test('should create a group comment successfully', async () => {
            const commentText = `Test group comment ${uuidv4()}`;

            const response = await apiDriver.createGroupComment(testGroup.id, commentText, users[0].token);

            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
            expect(response.data.id).toBeDefined();
            expect(response.data.authorId).toBe(users[0].uid);
            expect(response.data.authorName).toBe(users[0].displayName);
            expect(response.data.text).toBe(commentText);
            expect(response.data.createdAt).toBeDefined();
            expect(response.data.updatedAt).toBeDefined();
        });

        test('should require authentication for creating comments', async () => {
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should require group membership for creating comments', async () => {
            await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });

        test('should validate comment text length', async () => {
            // Empty text
            await expect(apiDriver.createGroupComment(testGroup.id, '', users[0].token)).rejects.toThrow(/comment.*required|text.*required/i);

            // Text too long (501 characters)
            const longText = 'a'.repeat(501);
            await expect(apiDriver.createGroupComment(testGroup.id, longText, users[0].token)).rejects.toThrow(/exceed.*500|too long/i);
        });

        test('should reject dangerous comment text', async () => {
            const dangerousText = '<script>console.log("xss")</script>Safe text';

            await expect(apiDriver.createGroupComment(testGroup.id, dangerousText, users[0].token)).rejects.toThrow(/400|dangerous.*content|invalid.*input/i);
        });

        test('should accept safe content with special characters', async () => {
            const safeText = 'Price: $29.99 - café restaurant visit! Special chars: @#$%^*()[]{}';

            const response = await apiDriver.createGroupComment(testGroup.id, safeText, users[0].token);

            expect(response.success).toBe(true);
            expect(response.data.text).toBe(safeText);
            expect(response.data.text).toContain('$29.99');
            expect(response.data.text).toContain('café');
            expect(response.data.text).toContain('Special chars');
        });
    });

    describe('Group Comments via Firestore (Frontend Behavior)', () => {
        test('should be able to query group comments directly from Firestore', async () => {
            // First create a comment via the API
            const commentText = `Direct Firestore test ${uuidv4()}`;
            await apiDriver.createGroupComment(testGroup.id, commentText, users[0].token);

            // Wait a moment for the data to be written
            await new Promise(resolve => setTimeout(resolve, 100));

            // Query Firestore directly like the frontend does
            const snapshot = await getFirestore()
                .collection(`groups/${testGroup.id}/comments`)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            expect(comments.length).toBeGreaterThan(0);
            
            const ourComment = comments.find((c: any) => c.text === commentText);
            expect(ourComment).toBeDefined();
            expect(ourComment!.authorId).toBe(users[0].uid);
            expect(ourComment!.authorName).toBe(users[0].displayName);
            expect(ourComment!.createdAt).toBeDefined();
        });

        test('should order comments by creation date (newest first) in Firestore', async () => {
            await apiDriver.createGroupComment(testGroup.id, 'First comment', users[0].token);

            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 100));

            await apiDriver.createGroupComment(testGroup.id, 'Second comment', users[1].token);

            // Wait a moment for data to be written
            await new Promise(resolve => setTimeout(resolve, 100));

            // Query Firestore directly
            const snapshot = await getFirestore()
                .collection(`groups/${testGroup.id}/comments`)
                .orderBy('createdAt', 'desc')
                .get();

            const comments = snapshot.docs.map(doc => doc.data());

            expect(comments.length).toBeGreaterThanOrEqual(2);

            // Find our test comments
            const firstCommentInList = comments.find((c: any) => c.text === 'First comment');
            const secondCommentInList = comments.find((c: any) => c.text === 'Second comment');

            expect(firstCommentInList).toBeDefined();
            expect(secondCommentInList).toBeDefined();

            // Newer comment should come first (descending order)
            const firstIndex = comments.indexOf(firstCommentInList as any);
            const secondIndex = comments.indexOf(secondCommentInList as any);

            expect(secondIndex).toBeLessThan(firstIndex);
        });

        test('should handle real-time updates via onSnapshot pattern', async () => {
            let receivedComments: any[] = [];
            let callbackCount = 0;

            // Set up listener like the frontend does
            const unsubscribe = getFirestore()
                .collection(`groups/${testGroup.id}/comments`)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .onSnapshot((snapshot) => {
                    callbackCount++;
                    receivedComments = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                });

            // Wait for initial snapshot
            await new Promise(resolve => setTimeout(resolve, 100));
            const initialCallbackCount = callbackCount;

            // Add a comment
            const commentText = `Real-time test ${uuidv4()}`;
            await apiDriver.createGroupComment(testGroup.id, commentText, users[0].token);

            // Wait for the update
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should have received an update
            expect(callbackCount).toBeGreaterThan(initialCallbackCount);
            expect(receivedComments.some((c: any) => c.text === commentText)).toBe(true);

            unsubscribe();
        });
    });

    describe('Expense Comments via API', () => {
        test('should create an expense comment successfully', async () => {
            const commentText = `Test expense comment ${uuidv4()}`;

            const response = await apiDriver.createExpenseComment(testExpense.id, commentText, users[0].token);

            expect(response.success).toBe(true);
            expect(response.data).toBeDefined();
            expect(response.data.id).toBeDefined();
            expect(response.data.authorId).toBe(users[0].uid);
            expect(response.data.authorName).toBe(users[0].displayName);
            expect(response.data.text).toBe(commentText);
            expect(response.data.createdAt).toBeDefined();
            expect(response.data.updatedAt).toBeDefined();
        });

        test('should require authentication for creating expense comments', async () => {
            await expect(apiDriver.createExpenseComment(testExpense.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should require group membership for expense comments', async () => {
            await expect(apiDriver.createExpenseComment(testExpense.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });

        test('should validate expense comment text', async () => {
            // Empty text
            await expect(apiDriver.createExpenseComment(testExpense.id, '', users[0].token)).rejects.toThrow(/comment.*required|text.*required/i);

            // Text too long
            const longText = 'a'.repeat(501);
            await expect(apiDriver.createExpenseComment(testExpense.id, longText, users[0].token)).rejects.toThrow(/exceed.*500|too long/i);
        });

        test('should reject non-existent expense', async () => {
            const fakeExpenseId = uuidv4();
            await expect(apiDriver.createExpenseComment(fakeExpenseId, 'Test comment', users[0].token)).rejects.toThrow(/not found|expense.*not.*exist/i);
        });
    });

    describe('Expense Comments via Firestore (Frontend Behavior)', () => {
        test('should be able to query expense comments directly from Firestore', async () => {
            // First create a comment via the API
            const commentText = `Expense Firestore test ${uuidv4()}`;
            await apiDriver.createExpenseComment(testExpense.id, commentText, users[0].token);

            // Wait a moment for the data to be written
            await new Promise(resolve => setTimeout(resolve, 100));

            // Query Firestore directly like the frontend does
            const snapshot = await getFirestore()
                .collection(`expenses/${testExpense.id}/comments`)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            expect(comments.length).toBeGreaterThan(0);
            
            const ourComment = comments.find((c: any) => c.text === commentText);
            expect(ourComment).toBeDefined();
            expect(ourComment!.authorId).toBe(users[0].uid);
            expect(ourComment!.authorName).toBe(users[0].displayName);
        });
    });

    describe('Multi-User Comment Scenarios', () => {
        test('multiple group members should be able to comment', async () => {
            const user1Comment = await apiDriver.createGroupComment(testGroup.id, 'User 1 comment', users[0].token);
            const user2Comment = await apiDriver.createGroupComment(testGroup.id, 'User 2 comment', users[1].token);

            expect(user1Comment.data.authorId).toBe(users[0].uid);
            expect(user1Comment.data.authorName).toBe(users[0].displayName);

            expect(user2Comment.data.authorId).toBe(users[1].uid);
            expect(user2Comment.data.authorName).toBe(users[1].displayName);

            // Both comments should exist in Firestore
            await new Promise(resolve => setTimeout(resolve, 100));

            const snapshot = await getFirestore()
                .collection(`groups/${testGroup.id}/comments`)
                .get();

            const comments = snapshot.docs.map(doc => doc.data());
            const texts = comments.map((c: any) => c.text);

            expect(texts).toContain('User 1 comment');
            expect(texts).toContain('User 2 comment');
        });
    });

    describe('Timestamp Validation', () => {
        test('timestamps should be valid ISO strings or Firestore Timestamps', async () => {
            const response = await apiDriver.createGroupComment(testGroup.id, 'Timestamp test', users[0].token);

            expect(response.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
            expect(response.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

            // Parse dates to ensure they're valid
            expect(() => new Date(response.data.createdAt)).not.toThrow();
            expect(() => new Date(response.data.updatedAt)).not.toThrow();

            // Also check Firestore document
            await new Promise(resolve => setTimeout(resolve, 100));

            const snapshot = await getFirestore()
                .collection(`groups/${testGroup.id}/comments`)
                .where('text', '==', 'Timestamp test')
                .limit(1)
                .get();

            expect(snapshot.docs.length).toBe(1);
            const doc = snapshot.docs[0];
            const data = doc.data();

            // In Firestore, timestamps are stored as Timestamp objects
            expect(data.createdAt).toBeDefined();
            expect(data.updatedAt).toBeDefined();
        });
    });
});