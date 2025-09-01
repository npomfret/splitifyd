// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import {beforeEach, describe, expect, test} from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder, User} from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';

describe('Comments API Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let testExpense: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);

        // Create a test group with multiple members
        const members = users.slice(0, 2);
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Comments Test Group ${uuidv4()}`)
            .withDescription('Test group for comment API testing')
            .withMembers(members)
            .build();

        testGroup = await apiDriver.createGroup(groupData, members[0].token);

        // Create a test expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withAmount(50.0)
            .withDescription('Test expense for comments')
            .withPaidBy(members[0].uid)
            .withParticipants([members[0].uid, members[1].uid])
            .build();

        testExpense = await apiDriver.createExpense(expenseData, users[0].token);
    })

    describe('Group Comments API', () => {
        describe('POST /groups/:groupId/comments', () => {
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

            test('should require authentication', async () => {
                await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
            });

            test('should require group membership', async () => {
                await expect(apiDriver.createGroupComment(testGroup.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
            });

            test('should validate comment text length', async () => {
                // Empty text
                await expect(apiDriver.createGroupComment(testGroup.id, '', users[0].token)).rejects.toThrow(/comment.*required|text.*required/i);

                // Text too long (501 characters)
                const longText = 'a'.repeat(501);
                await expect(apiDriver.createGroupComment(testGroup.id, longText, users[0].token)).rejects.toThrow(/exceed.*500|too long/i);
            });

            test('should reject non-existent group', async () => {
                const fakeGroupId = uuidv4();
                await expect(apiDriver.createGroupComment(fakeGroupId, 'Test comment', users[0].token)).rejects.toThrow(/not found|group.*not.*exist/i);
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

        describe('GET /groups/:groupId/comments', () => {
            test('should list group comments with pagination', async () => {
                // Create multiple comments first
                await apiDriver.createGroupComment(testGroup.id, 'First comment', users[0].token);
                await apiDriver.createGroupComment(testGroup.id, 'Second comment', users[1].token);

                const response = await apiDriver.listGroupComments(testGroup.id, users[0].token);

                expect(response.success).toBe(true);
                expect(response.data).toBeDefined();
                expect(response.data.comments).toBeDefined();
                expect(Array.isArray(response.data.comments)).toBe(true);
                expect(response.data.hasMore).toBeDefined();
                expect(typeof response.data.hasMore).toBe('boolean');

                // Should include our test comments
                const commentTexts = response.data.comments.map((c) => c.text);
                expect(commentTexts).toContain('First comment');
                expect(commentTexts).toContain('Second comment');
            });

            test('should respect pagination parameters', async () => {
                const response = await apiDriver.listGroupComments(testGroup.id, users[0].token, { limit: 1 });

                expect(response.success).toBe(true);
                expect(response.data.comments.length).toBeLessThanOrEqual(1);
            });

            test('should enforce maximum limit', async () => {
                await expect(apiDriver.listGroupComments(testGroup.id, users[0].token, { limit: 101 })).rejects.toThrow(/limit|maximum/i);
            });

            test('should require authentication', async () => {
                await expect(apiDriver.listGroupComments(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
            });

            test('should require group membership', async () => {
                await expect(apiDriver.listGroupComments(testGroup.id, users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
            });
        });
    });

    describe('Expense Comments API', () => {
        describe('POST /expenses/:expenseId/comments', () => {
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

            test('should require authentication', async () => {
                await expect(apiDriver.createExpenseComment(testExpense.id, 'Test comment', '')).rejects.toThrow(/401|unauthorized/i);
            });

            test('should require group membership for expense comments', async () => {
                await expect(apiDriver.createExpenseComment(testExpense.id, 'Test comment', users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
            });

            test('should validate comment text', async () => {
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

        describe('GET /expenses/:expenseId/comments', () => {
            test('should list expense comments', async () => {
                // Create a test comment first
                await apiDriver.createExpenseComment(testExpense.id, 'Test expense comment', users[1].token);

                const response = await apiDriver.listExpenseComments(testExpense.id, users[0].token);

                expect(response.success).toBe(true);
                expect(response.data).toBeDefined();
                expect(response.data.comments).toBeDefined();
                expect(Array.isArray(response.data.comments)).toBe(true);
                expect(response.data.hasMore).toBeDefined();

                // Should include our test comment
                const commentTexts = response.data.comments.map((c) => c.text);
                expect(commentTexts).toContain('Test expense comment');
            });

            test('should require authentication', async () => {
                await expect(apiDriver.listExpenseComments(testExpense.id, '')).rejects.toThrow(/401|unauthorized/i);
            });

            test('should require group membership', async () => {
                await expect(apiDriver.listExpenseComments(testExpense.id, users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
            });
        });
    });

    describe('Comment Ordering and Timestamps', () => {
        test('comments should be ordered by creation date (newest first)', async () => {
            await apiDriver.createGroupComment(testGroup.id, 'First comment', users[0].token);

            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 100));

            await apiDriver.createGroupComment(testGroup.id, 'Second comment', users[1].token);

            const response = await apiDriver.listGroupComments(testGroup.id, users[0].token);

            expect(response.data.comments.length).toBeGreaterThanOrEqual(2);

            // Find our test comments
            const firstCommentInList = response.data.comments.find((c) => c.text === 'First comment');
            const secondCommentInList = response.data.comments.find((c) => c.text === 'Second comment');

            expect(firstCommentInList).toBeDefined();
            expect(secondCommentInList).toBeDefined();

            // Newer comment should come first (descending order)
            const firstIndex = response.data.comments.indexOf(firstCommentInList!);
            const secondIndex = response.data.comments.indexOf(secondCommentInList!);

            expect(secondIndex).toBeLessThan(firstIndex);
        });

        test('timestamps should be valid ISO strings', async () => {
            const response = await apiDriver.createGroupComment(testGroup.id, 'Timestamp test', users[0].token);

            expect(response.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
            expect(response.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

            // Parse dates to ensure they're valid
            expect(() => new Date(response.data.createdAt)).not.toThrow();
            expect(() => new Date(response.data.updatedAt)).not.toThrow();
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

            // Both users should see all comments
            const response1 = await apiDriver.listGroupComments(testGroup.id, users[0].token);
            const response2 = await apiDriver.listGroupComments(testGroup.id, users[1].token);

            expect(response1.data.comments.length).toBe(response2.data.comments.length);

            const texts1 = response1.data.comments.map((c) => c.text);
            const texts2 = response2.data.comments.map((c) => c.text);

            expect(texts1).toContain('User 1 comment');
            expect(texts1).toContain('User 2 comment');
            expect(texts2).toContain('User 1 comment');
            expect(texts2).toContain('User 2 comment');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle malformed request bodies gracefully', async () => {
            const malformedRequests = [
                {
                    /* missing text */
                },
                { text: null },
                { text: 123 }, // non-string text
                { text: [] }, // array instead of string
                { text: {} }, // object instead of string
            ];

            for (const requestBody of malformedRequests) {
                const response = await fetch(`${apiDriver.getBaseUrl()}/${FirestoreCollections.GROUPS}/${testGroup.id}/${FirestoreCollections.COMMENTS}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${users[0].token}`,
                    },
                    body: JSON.stringify(requestBody),
                });

                expect(response.status).toBe(400);
            }
        });

        test('should handle invalid JSON gracefully', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/${FirestoreCollections.GROUPS}/${testGroup.id}/${FirestoreCollections.COMMENTS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${users[0].token}`,
                },
                body: 'invalid json{{{',
            });

            expect(response.status).toBe(400);
        });

        test('should handle missing Content-Type header', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/${FirestoreCollections.GROUPS}/${testGroup.id}/${FirestoreCollections.COMMENTS}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${users[0].token}`,
                },
                body: JSON.stringify({ text: 'Test comment' }),
            });

            // Should still work or give appropriate error
            expect([200, 201, 400, 415]).toContain(response.status);
        });
    });
});
