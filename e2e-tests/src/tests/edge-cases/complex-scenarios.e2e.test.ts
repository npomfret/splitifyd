import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupDetailPage } from '../../pages';
import { JoinGroupPage } from '../../pages';
import { GroupWorkflow } from '../../workflows';

// Enable console error reporting and MCP debugging
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
    test('create group with multiple people and expenses that is NOT settled', async ({ authenticatedPage, secondUser, dashboardPage }) => {
        // Use fixture-provided users instead of creating new ones
        const { page: alicePage, user: alice } = authenticatedPage;
        const { page: bobPage, user: bob } = secondUser;
        const groupWorkflow = new GroupWorkflow(alicePage);

        // Navigate Alice to dashboard and create group
        await alicePage.goto('/dashboard');
        await dashboardPage.waitForDashboard();

        // Create group with Alice
        const groupName = 'Vacation Trip 2024';
        const groupDescription = 'Summer vacation expenses';
        const groupId = await groupWorkflow.createGroupAndNavigate(groupName, groupDescription);

        // Get share link from Alice's page
        const aliceGroupDetailPage = new GroupDetailPage(alicePage);
        const shareLink = await aliceGroupDetailPage.getShareLink();

        // Have Bob join via robust JoinGroupPage
        const bobJoinGroupPage = new JoinGroupPage(bobPage);
        await bobJoinGroupPage.joinGroupUsingShareLink(shareLink);

        // Verify Bob is now on the group page
        await expect(bobPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
        await expect(bobPage.getByText(groupName)).toBeVisible();

        // Alice adds beach house expense ($800)
        const memberCount = 2; // Alice and Bob
        const aliceExpenseFormPage = await aliceGroupDetailPage.clickAddExpenseButton(memberCount);
        await aliceExpenseFormPage.submitExpense({
            description: 'Beach House Rental',
            amount: 800.0,
            paidBy: alice.displayName,
            currency: 'USD',
            splitType: 'equal',
        });

        // Bob adds restaurant expense ($120)
        const bobGroupDetailPage = new GroupDetailPage(bobPage);
        const bobExpenseFormPage = await bobGroupDetailPage.clickAddExpenseButton(memberCount);
        await bobExpenseFormPage.submitExpense({
            description: 'Restaurant Dinner',
            amount: 120.0,
            paidBy: bob.displayName,
            currency: 'USD',
            splitType: 'equal',
        });

        // Wait for real-time updates to sync Alice's page with latest data
        await aliceGroupDetailPage.waitForBalancesToLoad(groupId);
        // Wait for balance section to be visible - indicates data loaded
        await expect(aliceGroupDetailPage.getBalancesHeading()).toBeVisible();

        // Verify both expenses are visible on Alice's page
        await expect(alicePage.getByText('Beach House Rental')).toBeVisible();
        await expect(alicePage.getByText('Restaurant Dinner')).toBeVisible();

        // Verify balances section shows unsettled state
        const balancesHeading = aliceGroupDetailPage.getBalancesHeading();
        await expect(balancesHeading).toBeVisible();

        // With Alice paying $800 and Bob paying $120, Bob owes Alice $340.00
        await expect(aliceGroupDetailPage.getBalancesSection().getByText('$340.00')).toBeVisible();

        // Verify member count shows 2 members
        await expect(aliceGroupDetailPage.getMembersCount()).toBeVisible();

        // No cleanup needed - fixtures handle it automatically
    });
});
