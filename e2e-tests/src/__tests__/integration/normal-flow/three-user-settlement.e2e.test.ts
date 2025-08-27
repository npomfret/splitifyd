import { expect, threeUserTest as test } from '../../../fixtures/three-user-test';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';

setupMCPDebugOnFailure();

// Increase timeout for this complex multi-user test
test.setTimeout(30000);

test.describe('Three User Settlement Management', () => {
    test('should handle partial settlement with 3 users correctly', async ({ authenticatedPage, groupDetailPage, secondUser, thirdUser }) => {
        const { page, user: user1 } = authenticatedPage;
        const { page: page2, user: user2 } = secondUser;
        const { page: page3, user: user3 } = thirdUser;
        const groupWorkflow = new GroupWorkflow(page);

        // Verify all 3 users are distinct to prevent flaky test failures

        // Assert all users have different emails
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user3.email);

        // Assert all users have different display names
        expect(user1.displayName).not.toBe(user2.displayName);
        expect(user1.displayName).not.toBe(user3.displayName);
        expect(user2.displayName).not.toBe(user3.displayName);

        // Verify correct users are shown in UI
        // The new UI shows display names in the user button but not as the accessible name
        // Use .first() to avoid strict mode violations when display name appears multiple times
        await expect(groupDetailPage.getTextElement(user1.displayName).first()).toBeVisible();
        await expect(secondUser.groupDetailPage.getTextElement(user2.displayName).first()).toBeVisible();
        await expect(thirdUser.groupDetailPage.getTextElement(user3.displayName).first()).toBeVisible();

        // 1. Create a group with 3 users
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('3UserSettle'), 'Testing 3-user settlement');

        // Get share link and have users join SEQUENTIALLY (not concurrently)
        const shareLink = await groupDetailPage.getShareLink();

        // SEQUENTIAL JOIN 1: Second user joins first
        const groupDetailPage2 = secondUser.groupDetailPage;
        const joinGroupPage2 = new JoinGroupPage(page2);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);

        // Verify second user can actually access the group page
        const page2Url = page2.url();
        if (!page2Url.includes(`/groups/${groupId}`)) {
            throw new Error(`Second user join verification failed. Expected to be on /groups/${groupId}, but on: ${page2Url}`);
        }

        // WAIT for second user to be fully synchronized before third user joins
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page, groupDetailPage },
                { page: page2, groupDetailPage: groupDetailPage2 },
            ],
            2,
            groupId,
        );

        // SEQUENTIAL JOIN 2: Third user joins ONLY AFTER second user is fully synchronized
        const groupDetailPage3 = thirdUser.groupDetailPage;
        const joinGroupPage3 = new JoinGroupPage(page3);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);

        // Verify third user can actually access the group page
        const page3Url = page3.url();
        if (!page3Url.includes(`/groups/${groupId}`)) {
            throw new Error(`Third user join verification failed. Expected to be on /groups/${groupId}, but on: ${page3Url}`);
        }

        // Synchronize all pages to see all 3 members
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page, groupDetailPage },
                { page: page2, groupDetailPage: groupDetailPage2 },
                { page: page3, groupDetailPage: groupDetailPage3 },
            ],
            3,
            groupId,
        );

        // 2. User 1 makes a expense for 120, split equally
        // DEBT CALCULATION:
        // - Total expense: $120
        // - Split 3 ways: $120 / 3 = $40 per person
        // - User1 paid full $120, but only owes $40 share
        // - User1 is owed: $120 - $40 = $80 total
        // - User2 owes: $40 to User1
        // - User3 owes: $40 to User1
        const allPages = [
            { page, groupDetailPage, userName: user1.displayName },
            { page: page2, groupDetailPage: groupDetailPage2, userName: user2.displayName },
            { page: page3, groupDetailPage: groupDetailPage3, userName: user3.displayName },
        ];

        await groupDetailPage.addExpenseAndSync(
            {
                description: 'Group dinner expense',
                amount: 120,
                paidBy: user1.displayName,
                currency: 'USD',
                splitType: 'equal',
            },
            allPages,
            3,
            groupId,
        );

        // Verify expense appears across all pages
        await groupDetailPage.verifyExpenseAcrossPages(allPages, 'Group dinner expense', '$120.00');

        // 3. Assert initial balances after first expense
        // EXPECTED STATE:
        // - User1 is owed $80 total ($40 from User2 + $40 from User3)
        // - User2 owes $40 to User1
        // - User3 owes $40 to User1
        // This represents the initial debt distribution after the group dinner

        // Verify both debts exist across all pages
        await groupDetailPage.verifyDebtAcrossPages(allPages, user2.displayName, user1.displayName, '$40.00');
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');

        // 4. User 2 makes partial settlement of 30
        // SETTLEMENT CALCULATION:
        // - User2 current debt: $40
        // - Payment amount: $30
        // - Remaining debt after payment: $40 - $30 = $10

        await groupDetailPage.recordSettlementAndSync(
            {
                payerName: user2.displayName,
                payeeName: user1.displayName,
                amount: '30',
                note: 'Partial payment from user2',
            },
            allPages,
            3,
            groupId,
        );

        // Verify settlement appears in history across all pages
        await groupDetailPage.verifySettlementInHistory(allPages, 'Partial payment from user2');

        // 5. Assert updated balances after partial settlement
        // EXPECTED STATE AFTER $30 PAYMENT:
        // - User1 is now owed $50 total (was $80, received $30)
        // - User2 now owes $10 to User1 (was $40, paid $30)
        // - User3 still owes $40 to User1 (unchanged)
        // The partial payment reduces User2's debt but doesn't fully settle

        // Verify updated debts across all pages
        await groupDetailPage.verifyDebtAcrossPages(allPages, user2.displayName, user1.displayName, '$10.00');
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');

        // 6. User 2 makes final settlement of remaining $10
        // FINAL SETTLEMENT CALCULATION:
        // - User2 remaining debt: $10
        // - Payment amount: $10
        // - User2 will be fully settled after this payment

        await groupDetailPage.recordSettlementAndSync(
            {
                payerName: user2.displayName,
                payeeName: user1.displayName,
                amount: '10',
                note: 'Final payment from user2 - all settled!',
            },
            allPages,
            3,
            groupId,
        );

        // 7. Assert final state after all settlements
        // EXPECTED FINAL STATE:
        // - User1 is now owed only $40 (from User3)
        // - User2 is FULLY SETTLED (paid $30 + $10 = $40 total)
        // - User3 still owes $40 to User1 (no payments made)
        // This verifies that partial settlements work correctly in 3-user groups

        // User2 should no longer appear in debt list (settled up)
        const balancesSection1 = groupDetailPage.getBalancesSection();

        await expect(groupDetailPage.getDebtInfo(user2.displayName, user1.displayName)).not.toBeVisible();

        // User3 should still owe $40
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3.displayName, user1.displayName, '$40.00');

        // Verify both settlements appear in history
        await groupDetailPage.openHistory();
        await expect(groupDetailPage.getTextElement(/Partial payment from user2/i)).toBeVisible();
        await expect(groupDetailPage.getTextElement(/Final payment from user2 - all settled!/i)).toBeVisible();
    });
});
