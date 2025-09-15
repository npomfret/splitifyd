import { simpleTest, expect } from '../../fixtures';
import { GroupDetailPage, JoinGroupPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';

// Increase timeout for this complex multi-user test
simpleTest.setTimeout(30000);

simpleTest.describe('Three User Settlement Management', () => {
    simpleTest('should handle partial settlement with 3 users correctly', async ({ newLoggedInBrowser }) => {
        // Create three browser instances - User 1, User 2, and User 3
        const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
        const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage2 = new GroupDetailPage(user2Page, user2);
        const groupDetailPage3 = new GroupDetailPage(user3Page, user3);


        // Verify all 3 users are distinct to prevent flaky test failures

        // Assert all users have different emails
        expect(user1.email).not.toBe(user2.email);
        expect(user1.email).not.toBe(user3.email);
        expect(user2.email).not.toBe(user3.email);

        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.getCurrentUserDisplayName();
        // Assert all users have different display names
        expect(user1DisplayName).not.toBe(user2DisplayName);
        expect(user1DisplayName).not.toBe(user3DisplayName);
        expect(user2DisplayName).not.toBe(user3DisplayName);

        // 1. Create a group with 3 users
        const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('3UserSettle'), 'Testing 3-user settlement');
        const groupId = groupDetailPage.inferGroupId();

        // Verify correct users are shown in UI
        // The new UI shows display names in the user button but not as the accessible name
        // Use .first() to avoid strict mode violations when display name appears multiple times
        await expect(groupDetailPage.getTextElement(user1DisplayName).first()).toBeVisible();
        await expect(groupDetailPage2.getTextElement(user2DisplayName).first()).toBeVisible();
        await expect(groupDetailPage3.getTextElement(user3DisplayName).first()).toBeVisible();

        // Get share link and have users join SEQUENTIALLY (not concurrently)
        const shareLink = await groupDetailPage.getShareLink();

        // SEQUENTIAL JOIN 1: Second user joins first
        const joinGroupPage2 = new JoinGroupPage(user2Page);
        await joinGroupPage2.joinGroupUsingShareLink(shareLink);

        // Verify second user can actually access the group page
        const page2Url = user2Page.url();
        if (!page2Url.includes(`/groups/${groupId}`)) {
            throw new Error(`Second user join verification failed. Expected to be on /groups/${groupId}, but on: ${page2Url}`);
        }

        // WAIT for second user to be fully synchronized before third user joins
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: groupDetailPage2 },
            ],
            2,
            groupId,
        );

        // SEQUENTIAL JOIN 2: Third user joins ONLY AFTER second user is fully synchronized
        const joinGroupPage3 = new JoinGroupPage(user3Page);
        await joinGroupPage3.joinGroupUsingShareLink(shareLink);

        // Verify third user can actually access the group page
        const page3Url = user3Page.url();
        if (!page3Url.includes(`/groups/${groupId}`)) {
            throw new Error(`Third user join verification failed. Expected to be on /groups/${groupId}, but on: ${page3Url}`);
        }

        // Synchronize all pages to see all 3 members
        await groupDetailPage.synchronizeMultiUserState(
            [
                { page: user1Page, groupDetailPage },
                { page: user2Page, groupDetailPage: groupDetailPage2 },
                { page: user3Page, groupDetailPage: groupDetailPage3 },
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
            { page: user1Page, groupDetailPage },
            { page: user2Page, groupDetailPage: groupDetailPage2 },
            { page: user3Page, groupDetailPage: groupDetailPage3 },
        ];

        await groupDetailPage.addExpenseAndSync(
            {
                description: 'Group dinner expense',
                amount: 120,
                paidByDisplayName: user1DisplayName,
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
        await groupDetailPage.verifyDebtAcrossPages(allPages, user2DisplayName, user1DisplayName, '$40.00');
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3DisplayName, user1DisplayName, '$40.00');

        // 4. User 2 makes partial settlement of 30
        // SETTLEMENT CALCULATION:
        // - User2 current debt: $40
        // - Payment amount: $30
        // - Remaining debt after payment: $40 - $30 = $10

        await groupDetailPage.recordSettlementAndSync(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
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
        await groupDetailPage.verifyDebtAcrossPages(allPages, user2DisplayName, user1DisplayName, '$10.00');
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3DisplayName, user1DisplayName, '$40.00');

        // 6. User 2 makes final settlement of remaining $10
        // FINAL SETTLEMENT CALCULATION:
        // - User2 remaining debt: $10
        // - Payment amount: $10
        // - User2 will be fully settled after this payment

        await groupDetailPage.recordSettlementAndSync(
            {
                payerName: user2DisplayName,
                payeeName: user1DisplayName,
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

        await expect(groupDetailPage.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible();

        // User3 should still owe $40
        await groupDetailPage.verifyDebtAcrossPages(allPages, user3DisplayName, user1DisplayName, '$40.00');

        // Verify both settlements appear in history
        await groupDetailPage.openHistory();
        await expect(groupDetailPage.getTextElement(/Partial payment from user2/i)).toBeVisible();
        await expect(groupDetailPage.getTextElement(/Final payment from user2 - all settled!/i)).toBeVisible();
    });
});
