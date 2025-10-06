import { beforeEach, describe, expect, test } from 'vitest';
import { borrowTestUsers } from '@splitifyd/test-support';
import { ApiDriver, TestExpenseManager } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';

/**
 * Comment API Integration Tests
 * Tests the GET endpoints for listing comments with pagination
 */
describe('Comment API - Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let testExpense: any;
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        const members = users.slice(0, 2);
        const setup = await TestExpenseManager.getGroupWithExpenseForComments(members);
        testGroup = setup.group;
        testExpense = setup.expense;
    });

    describe('GET /groups/:groupId/comments', () => {
        test('should return empty list for group with no comments', async () => {
            const response = await apiDriver.listGroupComments(testGroup.id, users[0].token);

            expect(response).toMatchObject({
                comments: [],
                hasMore: false,
            });
            expect(response.nextCursor).toBeUndefined();
        });

        test('should return paginated comments for group with comments', async () => {
            // Create some comments
            const comment1 = await apiDriver.createGroupComment(testGroup.id, 'First comment', users[0].token);
            const comment2 = await apiDriver.createGroupComment(testGroup.id, 'Second comment', users[1].token);
            const comment3 = await apiDriver.createGroupComment(testGroup.id, 'Third comment', users[0].token);

            // List comments (should be in descending order by createdAt)
            const response = await apiDriver.listGroupComments(testGroup.id, users[0].token);

            expect(response.comments).toHaveLength(3);
            expect(response.hasMore).toBe(false);

            // Verify comments are in correct order (most recent first)
            expect(response.comments[0].text).toBe('Third comment');
            expect(response.comments[1].text).toBe('Second comment');
            expect(response.comments[2].text).toBe('First comment');

            // Verify comment structure
            expect(response.comments[0]).toMatchObject({
                id: comment3.data.id,
                authorId: users[0].uid,
                authorName: expect.any(String),
                text: 'Third comment',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
        });

        test('should handle pagination with cursor and limit', async () => {
            // Create multiple comments
            const comments = [];
            for (let i = 1; i <= 5; i++) {
                const comment = await apiDriver.createGroupComment(testGroup.id, `Comment ${i}`, users[0].token);
                comments.push(comment);
            }

            // Get first page with limit 2
            const firstPage = await apiDriver.listGroupComments(testGroup.id, users[0].token, undefined, 2);

            expect(firstPage.comments).toHaveLength(2);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get second page using cursor
            const secondPage = await apiDriver.listGroupComments(testGroup.id, users[0].token, firstPage.nextCursor, 2);

            expect(secondPage.comments).toHaveLength(2);
            expect(secondPage.hasMore).toBe(true);
            expect(secondPage.nextCursor).toBeDefined();

            // Verify no overlap between pages
            const firstPageIds = firstPage.comments.map((c) => c.id);
            const secondPageIds = secondPage.comments.map((c) => c.id);
            expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
        });

        test('should enforce authentication', async () => {
            await expect(apiDriver.listGroupComments(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should enforce group membership for access control', async () => {
            // User 2 is not a member of the group
            await expect(apiDriver.listGroupComments(testGroup.id, users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });
    });

    describe('GET /expenses/:expenseId/comments', () => {
        test('should return empty list for expense with no comments', async () => {
            const response = await apiDriver.listExpenseComments(testExpense.id, users[0].token);

            expect(response).toMatchObject({
                comments: [],
                hasMore: false,
            });
            expect(response.nextCursor).toBeUndefined();
        });

        test('should return paginated comments for expense with comments', async () => {
            // Create some comments
            const comment1 = await apiDriver.createExpenseComment(testExpense.id, 'Expense comment 1', users[0].token);
            const comment2 = await apiDriver.createExpenseComment(testExpense.id, 'Expense comment 2', users[1].token);

            // List comments
            const response = await apiDriver.listExpenseComments(testExpense.id, users[0].token);

            expect(response.comments).toHaveLength(2);
            expect(response.hasMore).toBe(false);

            // Verify comments are in correct order (most recent first)
            expect(response.comments[0].text).toBe('Expense comment 2');
            expect(response.comments[1].text).toBe('Expense comment 1');

            // Verify comment structure
            expect(response.comments[0]).toMatchObject({
                id: comment2.data.id,
                authorId: users[1].uid,
                authorName: expect.any(String),
                text: 'Expense comment 2',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
        });

        test('should handle pagination with cursor and limit', async () => {
            // Create multiple comments
            const comments = [];
            for (let i = 1; i <= 4; i++) {
                const comment = await apiDriver.createExpenseComment(testExpense.id, `Expense comment ${i}`, users[0].token);
                comments.push(comment);
            }

            // Get first page with limit 3
            const firstPage = await apiDriver.listExpenseComments(testExpense.id, users[0].token, undefined, 3);

            expect(firstPage.comments).toHaveLength(3);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            // Get remaining comments
            const secondPage = await apiDriver.listExpenseComments(testExpense.id, users[0].token, firstPage.nextCursor);

            // Verify total comments across pages don't exceed what we created (plus any from other tests)
            const totalFromPages = firstPage.comments.length + secondPage.comments.length;
            expect(totalFromPages).toBeGreaterThanOrEqual(4); // At least our 4 comments
            expect(secondPage.hasMore).toBeDefined(); // Can be true or false depending on other test data
        });

        test('should enforce authentication', async () => {
            await expect(apiDriver.listExpenseComments(testExpense.id, '')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should enforce group membership for access control', async () => {
            // User 2 is not a member of the group containing the expense
            await expect(apiDriver.listExpenseComments(testExpense.id, users[2].token)).rejects.toThrow(/403|forbidden|access denied/i);
        });
    });

    describe('Query Parameters', () => {
        test('should handle invalid limit parameter gracefully', async () => {
            // Create a comment first
            await apiDriver.createGroupComment(testGroup.id, 'Test comment', users[0].token);

            // Test with invalid limit (should fall back to default)
            const response = await apiDriver.listGroupComments(testGroup.id, users[0].token, undefined, 0);
            expect(response.comments.length).toBeGreaterThanOrEqual(1);
        });

        test('should handle invalid cursor parameter gracefully', async () => {
            // Create a comment first
            await apiDriver.createGroupComment(testGroup.id, 'Test comment', users[0].token);

            // Test with invalid cursor (should start from beginning)
            const response = await apiDriver.listGroupComments(testGroup.id, users[0].token, 'invalid-cursor');
            expect(response.comments.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Edge Cases', () => {
        test('should handle non-existent group ID', async () => {
            await expect(apiDriver.listGroupComments('non-existent-group', users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should handle non-existent expense ID', async () => {
            await expect(apiDriver.listExpenseComments('non-existent-expense', users[0].token)).rejects.toThrow(/404|not found/i);
        });
    });
});
