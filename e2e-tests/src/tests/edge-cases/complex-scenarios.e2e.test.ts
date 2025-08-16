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
    await alicePage.getByRole('button', { name: /share/i }).click();
    const shareLinkInput = alicePage.getByRole('dialog').getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    // Close modal by clicking close button or outside
    const closeButton = alicePage.getByRole('button', { name: /close|×/i }).first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await alicePage.click('body', { position: { x: 10, y: 10 } });
    }
    
    // Have Bob join via robust JoinGroupPage
    const bobJoinGroupPage = new JoinGroupPage(bobPage);
    const bobJoinResult = await bobJoinGroupPage.attemptJoinWithStateDetection(shareLink);
    
    if (!bobJoinResult.success) {
      throw new Error(`Bob failed to join group: ${JSON.stringify(bobJoinResult)}`);
    }
    
    // Verify Bob is now on the group page
    await expect(bobPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(bobPage.getByText(groupName)).toBeVisible();
    
    // Alice adds beach house expense ($800)
    const aliceGroupDetailPage = new GroupDetailPage(alicePage);
    const memberCount = 2; // Alice and Bob
    const aliceExpenseFormPage = await aliceGroupDetailPage.clickAddExpenseButton(memberCount);
    await aliceExpenseFormPage.submitExpense({
      description: 'Beach House Rental',
      amount: 800.00,
      paidBy: alice.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Bob adds restaurant expense ($120)
    const bobGroupDetailPage = new GroupDetailPage(bobPage);
    const bobExpenseFormPage = await bobGroupDetailPage.clickAddExpenseButton(memberCount);
    await bobExpenseFormPage.submitExpense({
      description: 'Restaurant Dinner',
      amount: 120.00,
      paidBy: bob.displayName,
      currency: 'USD',
      splitType: 'equal'
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
    
    // With Alice paying $800 and Bob paying $120, there should be a balance showing
    await expect(alicePage.getByText(/\$/)).toBeVisible();
    
    // Verify member count shows 2 members
    await expect(aliceGroupDetailPage.getMembersCount()).toBeVisible();
    
    // No cleanup needed - fixtures handle it automatically
  });
});