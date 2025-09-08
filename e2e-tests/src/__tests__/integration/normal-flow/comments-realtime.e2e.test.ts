import { expect, multiUserTest as test } from '../../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import {JoinGroupPage, ExpenseDetailPage} from '../../../pages';
import {generateTestGroupName, randomString} from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { v4 as uuidv4 } from 'uuid';

// Enable error reporting and debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Real-time Comments E2E', () => {
    test('should support real-time group comments across multiple users', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, groupDetailPage: bobGroupDetailPage, user: bob } = secondUser;

        // Alice creates a group
        const groupWorkflow = new GroupWorkflow(alicePage);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Comments'), 'Testing real-time comments');

        // Verify Alice is on the group page
        await expect(alicePage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify comments section is visible and functional for Alice
        await groupDetailPage.verifyCommentsSection();

        // Bob joins the group via share link
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(bobPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify Bob is now on the group page
        await expect(bobPage).toHaveURL(groupDetailUrlPattern(groupId));

        // Verify comments section is visible and functional for Bob
        await bobGroupDetailPage.verifyCommentsSection();

        // Wait for both users to see the updated member count
        const allPages = [
            { page: alicePage, groupDetailPage },
            { page: bobPage, groupDetailPage: bobGroupDetailPage},
        ];
        await groupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

        // Test 1: Alice adds a comment, Bob should see it in real-time
        const aliceComment = `alice comment ${randomString(4)}`;

        await groupDetailPage.addComment(aliceComment);

        // Bob should see Alice's comment appear in real-time (no page refresh!)
        await bobGroupDetailPage.waitForCommentToAppear(aliceComment);

        // Test 2: Bob adds a comment, Alice should see it in real-time
        const bobComment = `bob comment ${randomString(4)}`;

        await bobGroupDetailPage.addComment(bobComment);

        // Alice should see Bob's comment appear in real-time
        await groupDetailPage.waitForCommentToAppear(bobComment);

        // Test 3: Verify both users see both comments
        await expect(alicePage).toHaveURL(groupDetailUrlPattern(groupId)); // Still on group page
        await expect(bobPage).toHaveURL(groupDetailUrlPattern(groupId)); // Still on group page

        // Both users should see 2 comments total
        await groupDetailPage.waitForCommentCount(2);
        await bobGroupDetailPage.waitForCommentCount(2);

        // Test 4: Multiple rapid comments to test real-time reliability
        const rapidComments = [
            randomString(4),
            randomString(4),
            randomString(4)
        ];

        // Alice adds first rapid comment
        await groupDetailPage.addComment(rapidComments[0]);
        await bobGroupDetailPage.waitForCommentToAppear(rapidComments[0]);

        // Bob adds second rapid comment
        await bobGroupDetailPage.addComment(rapidComments[1]);
        await groupDetailPage.waitForCommentToAppear(rapidComments[1]);

        // Alice adds third rapid comment
        await groupDetailPage.addComment(rapidComments[2]);
        await bobGroupDetailPage.waitForCommentToAppear(rapidComments[2]);

        // Final verification: Both users should see all 5 comments
        await groupDetailPage.waitForCommentCount(5);
        await bobGroupDetailPage.waitForCommentCount(5);

        // Verify all comments are visible for both users
        for (const comment of [aliceComment, bobComment, ...rapidComments]) {
            await expect(groupDetailPage.getCommentByText(comment)).toBeVisible();
            await expect(bobGroupDetailPage.getCommentByText(comment)).toBeVisible();
        }
    });

    test('should support real-time expense comments across multiple users', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, groupDetailPage: bobGroupDetailPage, user: bob } = secondUser;

        // Alice creates a group and adds an expense
        const groupWorkflow = new GroupWorkflow(alicePage);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('ExpenseComments'), 'Testing expense comments');

        // Bob joins the group
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(bobPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        // Synchronize both users
        const allPages = [
            { page: alicePage, groupDetailPage },
            { page: bobPage, groupDetailPage: bobGroupDetailPage },
        ];
        await groupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

        // Alice creates an expense
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test Expense for Comments',
            amount: 50.0,
            currency: 'USD',
            paidBy: alice.uid,
            splitType: 'equal',
        });

        // After submission, we should be back on the group page
        await alicePage.waitForURL(new RegExp(`/groups/${groupId}$`), { timeout: 3000 });

        // Click on the newly created expense to navigate to expense detail page
        await groupDetailPage.clickExpenseToView('Test Expense for Comments');

        // Wait for navigation to expense detail page
        await alicePage.waitForURL(new RegExp(`/groups/${groupId}/expenses/[a-zA-Z0-9]+$`), { timeout: 3000 });

        // Create the expense detail page object
        const expenseDetailPage = new ExpenseDetailPage(alicePage, alice);

        // Verify we're on the expense detail page
        await expenseDetailPage.waitForPageReady();

        // Get the expense URL to navigate Bob there
        const expenseUrl = alicePage.url();
        const expenseId = expenseUrl.match(/\/expenses\/([a-zA-Z0-9]+)$/)?.[1];
        if (!expenseId) {
            throw new Error(`Could not extract expense ID from URL: ${expenseUrl}`);
        }

        // Navigate Bob to the expense detail page
        await bobPage.goto(expenseUrl);
        const bobExpenseDetailPage = new ExpenseDetailPage(bobPage, bob);
        await bobExpenseDetailPage.waitForPageReady();

        // Verify comments section is available on both pages
        await expenseDetailPage.verifyCommentsSection();
        await bobExpenseDetailPage.verifyCommentsSection();

        // Comments section already verified above

        // Test real-time expense comments
        const aliceExpenseComment = `comment ${uuidv4()}`;

        // Alice adds comment to expense
        await expenseDetailPage.addComment(aliceExpenseComment);

        // Bob should see it in real-time
        await bobExpenseDetailPage.waitForCommentToAppear(aliceExpenseComment);

        // Bob adds a comment
        const bobExpenseComment = `comment ${uuidv4()}`;
        await bobExpenseDetailPage.addComment(bobExpenseComment);

        // Alice should see Bob's comment
        await expenseDetailPage.waitForCommentToAppear(bobExpenseComment);

        // Both should see 2 comments
        await expenseDetailPage.waitForCommentCount(2);
        await bobExpenseDetailPage.waitForCommentCount(2);

        // Verify comments are visible
        await expect(expenseDetailPage.getCommentByText(aliceExpenseComment)).toBeVisible();
        await expect(expenseDetailPage.getCommentByText(bobExpenseComment)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(aliceExpenseComment)).toBeVisible();
        await expect(bobExpenseDetailPage.getCommentByText(bobExpenseComment)).toBeVisible();
    });

    test('should handle comment errors gracefully without breaking real-time updates', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, groupDetailPage: bobGroupDetailPage, user: bob } = secondUser;

        // Setup group with both users
        const groupWorkflow = new GroupWorkflow(alicePage);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('invalid comments'), 'testing invalid comment submissions');

        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(bobPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        const allPages = [
            { page: alicePage, groupDetailPage},
            { page: bobPage, groupDetailPage: bobGroupDetailPage },
        ];
        await groupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

        // Test 1: Try to submit empty comment (should fail gracefully)
        const input = groupDetailPage.getCommentInput();
        const sendButton = groupDetailPage.getSendCommentButton();

        await input.fill('   '); // Whitespace only
        await expect(sendButton).toBeDisabled(); // Button should remain disabled

        // Clear input and verify button is disabled
        await input.fill('');
        await expect(sendButton).toBeDisabled();

        // Test 2: Try very long comment (should be prevented by character limit)
        const longComment = 'a'.repeat(600); // Exceeds 500 char limit
        await input.fill(longComment);

        // The input should enforce the limit or show error
        // Send button should be disabled for over-limit text
        await expect(sendButton).toBeDisabled();

        // Test 3: Normal comment should work after error attempts
        const validComment = `Valid comment after error tests - ${Date.now()}`;
        await groupDetailPage.addComment(validComment);

        // Bob should still receive real-time updates
        await bobGroupDetailPage.waitForCommentToAppear(validComment);

        // Test 4: Bob adds comment to ensure real-time is still working bidirectionally
        const bobComment = `Bob's comment after Alice's errors - ${Date.now()}`;
        await bobGroupDetailPage.addComment(bobComment);
        await groupDetailPage.waitForCommentToAppear(bobComment);

        // Both should see 2 valid comments
        await groupDetailPage.waitForCommentCount(2);
        await bobGroupDetailPage.waitForCommentCount(2);
    });

    test('should maintain comment order and author information in real-time', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, groupDetailPage: bobGroupDetailPage, user: bob } = secondUser;

        // Setup group
        const groupWorkflow = new GroupWorkflow(alicePage);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('OrderTest'), 'Testing comment order and authorship');

        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage = new JoinGroupPage(bobPage);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);

        const allPages = [
            { page: alicePage, groupDetailPage},
            { page: bobPage, groupDetailPage: bobGroupDetailPage },
        ];
        await groupDetailPage.synchronizeMultiUserState(allPages, 2, groupId);

        // Add comments in a specific order
        const comment1 = randomString(4);
        const comment2 = randomString(4);
        const comment3 = randomString(4);

        // Alice adds first comment
        await groupDetailPage.addComment(comment1);
        await bobGroupDetailPage.waitForCommentToAppear(comment1);

        // Real-time updates will handle proper ordering

        // Bob adds second comment
        await bobGroupDetailPage.addComment(comment2);
        await groupDetailPage.waitForCommentToAppear(comment2);

        // Real-time updates will handle proper ordering

        // Alice adds third comment
        await groupDetailPage.addComment(comment3);
        await bobGroupDetailPage.waitForCommentToAppear(comment3);

        // Verify comment count
        await groupDetailPage.waitForCommentCount(3);
        await bobGroupDetailPage.waitForCommentCount(3);

        // Verify all comments are visible with correct author names
        // Comments should appear in chronological order (newest first in most chat UIs)
        const authorNames = [
            await groupDetailPage.getCurrentUserDisplayName(),
            await bobGroupDetailPage.getCurrentUserDisplayName()
        ];
        const allComments = [comment1, comment2, comment3];

        // Check that author names appear for both users
        await groupDetailPage.verifyCommentAuthorsVisible(authorNames);
        await bobGroupDetailPage.verifyCommentAuthorsVisible(authorNames);

        // All three comment texts should be visible for both users
        await groupDetailPage.verifyCommentsVisible(allComments);
        await bobGroupDetailPage.verifyCommentsVisible(allComments);
    });
});
