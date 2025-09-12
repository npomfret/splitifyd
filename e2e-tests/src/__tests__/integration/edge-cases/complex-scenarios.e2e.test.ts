import { expect, simpleTest as test } from '../../../fixtures/simple-test.fixture';

import { GroupDetailPage, JoinGroupPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';

test.describe('Complex Unsettled Group Scenario', () => {
    test('create group with multiple people and expenses that is NOT settled', async ({ newLoggedInBrowser }) => {
        // Create first user
        const { page: alicePage, dashboardPage, user: alice } = await newLoggedInBrowser();

        // Create second user
        const { page: bobPage, dashboardPage: bobDashboardPage, user: bob } = await newLoggedInBrowser();

        // Get display names
        const aliceDisplayName = await dashboardPage.getCurrentUserDisplayName();
        const bobDisplayName = await bobDashboardPage.getCurrentUserDisplayName();
        const groupWorkflow = new GroupWorkflow(alicePage);

        // Navigate Alice to dashboard and create group
        await dashboardPage.navigateToDashboard();
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
        await expect(bobPage).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(bobPage.getByText(groupName)).toBeVisible();

        // Alice adds beach house expense ($800)
        const memberCount = 2; // Alice and Bob
        const aliceExpenseFormPage = await aliceGroupDetailPage.clickAddExpenseButton(memberCount);
        await aliceExpenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription('Beach House Rental')
            .withAmount(800.0)
            .withPaidByDisplayName(aliceDisplayName)
            .withCurrency('USD')
            .withSplitType('equal')
            .build()
        );

        // Wait for Alice's expense to be fully processed and synced
        await aliceGroupDetailPage.waitForBalancesToLoad(groupId);

        // Bob adds restaurant expense ($120)
        const bobGroupDetailPage = new GroupDetailPage(bobPage);
        const bobExpenseFormPage = await bobGroupDetailPage.clickAddExpenseButton(memberCount);
        await bobExpenseFormPage.submitExpense(new ExpenseFormDataBuilder()
            .withDescription('Restaurant Dinner')
            .withAmount(120.0)
            .withPaidByDisplayName(bobDisplayName)
            .withCurrency('USD')
            .withSplitType('equal')
            .build()
        );

        // Wait for Bob's expense to be fully processed and synced
        await aliceGroupDetailPage.waitForBalancesToLoad(groupId);
        await bobGroupDetailPage.waitForBalancesToLoad(groupId);

        // Verify both expenses are visible to both users
        await expect(alicePage.getByText('Beach House Rental')).toBeVisible();
        await expect(alicePage.getByText('Restaurant Dinner')).toBeVisible();
        await expect(bobPage.getByText('Beach House Rental')).toBeVisible();
        await expect(bobPage.getByText('Restaurant Dinner')).toBeVisible();

        // Verify balances section shows unsettled state
        const balancesHeading = aliceGroupDetailPage.getBalancesHeading();
        await expect(balancesHeading).toBeVisible();

        // With Alice paying $800 and Bob paying $120, Bob owes Alice $340.00
        await expect(aliceGroupDetailPage.getBalancesSection().getByText('$340.00')).toBeVisible();
    });
});
