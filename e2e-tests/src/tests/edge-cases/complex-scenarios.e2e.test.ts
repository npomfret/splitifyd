import { test, expect } from '../../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
  test('create group with multiple people and expenses that is NOT settled', async ({ page, browser }) => {
    // Initialize multi-user workflow with clean browser state
    const workflow = new MultiUserWorkflow(browser);
    
    // Add users - each gets a fresh browser context and authenticated session
    const { user: alice, page: alicePage } = await workflow.addUser();
    const { user: bob, page: bobPage } = await workflow.addUser();
    
    // Verify Alice is on dashboard after authentication
    await expect(alicePage).toHaveURL(/\/dashboard/);
    
    // Verify Bob is on dashboard after authentication  
    await expect(bobPage).toHaveURL(/\/dashboard/);
    
    // Create group with Alice
    const groupId = await workflow.createGroupWithFirstUser('Vacation Trip 2024', 'Beach house rental and activities');
    
    // Verify Alice navigated to the new group page
    await expect(alicePage).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(alicePage.getByText('Vacation Trip 2024')).toBeVisible();
    
    // Add Bob to the group via share link
    await workflow.addUsersToGroup();
    
    // Verify Bob is now on the group page
    await expect(bobPage).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(bobPage.getByText('Vacation Trip 2024')).toBeVisible();
    
    // Alice adds beach house expense ($800)
    await workflow.addExpense('Beach House Rental', 800.00, 0);
    
    // Bob adds restaurant expense ($120)
    await workflow.addExpense('Restaurant Dinner', 120.00, 1);
    
    // Refresh Alice's page to ensure latest data
    await alicePage.reload();
    await alicePage.waitForLoadState('networkidle');
    // Wait for balance section to be visible - indicates data loaded
    await expect(alicePage.getByRole('heading', { name: /balance/i })).toBeVisible();
    
    // Verify both expenses are visible
    const expenses = workflow.getExpenses();
    expect(expenses).toHaveLength(2);
    expect(expenses.map(e => e.description)).toContain('Beach House Rental');
    expect(expenses.map(e => e.description)).toContain('Restaurant Dinner');
    
    // Verify balances section shows unsettled state
    const balanceSection = alicePage.getByRole('heading', { name: /balance/i }).locator('..');
    await expect(balanceSection).toBeVisible();
    
    // With Alice paying $800 and Bob paying $120, there should be a balance showing
    await expect(balanceSection.getByText(/\$/)).toBeVisible();
    
    // Verify member count shows 2 members
    await expect(alicePage.getByText(/2 members/i)).toBeVisible();
    
    // Clean up all browser contexts created by this test
    await workflow.cleanup();
  });
});