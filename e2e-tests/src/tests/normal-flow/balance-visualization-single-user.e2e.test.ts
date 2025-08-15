import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from "../../helpers";
import { GroupWorkflow } from '../../workflows';
import {generateShortId} from "../../utils/test-helpers.ts";

setupMCPDebugOnFailure();

test.describe('Single User Balance Visualization', () => {
  test('should display settled state for empty group', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create test group with unique ID
    const uniqueId = generateShortId();
    const groupName = `Empty Balance Group ${uniqueId}`;
    await groupWorkflow.createGroupAndNavigate(groupName, 'Testing empty group balance');
    
    // Balance section should show "All settled up!" for empty group
    // Check if Balances heading is visible
    const balancesHeading = groupDetailPage.getBalancesHeading();
    await expect(balancesHeading).toBeVisible();
    
    // The "All settled up!" message exists but might be in a collapsed section
    // Just verify it exists in the DOM (don't check visibility since section might be collapsed on mobile)
    const settledElements = await groupDetailPage.getAllSettledUpElementsCount();
    expect(settledElements).toBeGreaterThan(0);
    
    // Members section should show the creator - use first() since display name might appear multiple times
    await expect(groupDetailPage.getMainSection().getByText(user.displayName).first()).toBeVisible();
    
    // Expenses section should show empty state
    await expect(groupDetailPage.getExpensesHeading()).toBeVisible();
    await expect(groupDetailPage.getNoExpensesText()).toBeVisible();
  });

  test('should show settled up state for single-user groups', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const memberCount = 1;

    // Create test group using dashboard page object with unique ID
    const uniqueId = generateShortId();
    const groupName = `Single User Test ${uniqueId}`;
    await groupWorkflow.createGroupAndNavigate(groupName, 'Testing single user balance');
    
    // Add expenses
    await groupDetailPage.addExpense({
      description: 'Dinner',
      amount: 120,
      currency: 'USD',
      paidBy: user.displayName,
      splitType: 'equal'
    }, memberCount);
    
    await groupDetailPage.addExpense({
      description: 'Groceries',
      amount: 80,
      currency: 'USD',
      paidBy: user.displayName,
      splitType: 'equal'
    }, memberCount);
    
    // Verify Balances section shows settled up for single-user groups
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Wait for the "All settled up!" message to appear
    await groupDetailPage.waitForSettledUpMessage();
    
    // Verify expenses are tracked in the expense section
    await expect(groupDetailPage.getCurrencyAmount('120.00')).toBeVisible();
    await expect(groupDetailPage.getCurrencyAmount('80.00')).toBeVisible();
  });

  test('should handle zero balance state correctly', async ({ dashboardPage, groupDetailPage, authenticatedPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    // Create test group with unique ID
    const uniqueId = generateShortId();
    const groupName = `Zero Balance Test ${uniqueId}`;
    await groupWorkflow.createGroupAndNavigate(groupName, 'Testing zero balance state');
    
    // Verify Balances section shows settled up initially
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
    
    // Wait for the "All settled up!" message to appear
    await groupDetailPage.waitForSettledUpMessage();
  });

  test('should display currency correctly in single user context', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const memberCount = 1;

    // Create test group with unique ID
    const uniqueId = generateShortId();
    const groupName = `Currency Display Test ${uniqueId}`;
    await groupWorkflow.createGroupAndNavigate(groupName, 'Testing currency display');
    
    // Add expense
    await groupDetailPage.addExpense({
      description: 'International expense',
      amount: 250,
      currency: 'USD',
      paidBy: user.displayName,
      splitType: 'equal'
    }, memberCount);
    
    // Check for currency formatting in expense section
    await expect(groupDetailPage.getCurrencyAmount('250.00')).toBeVisible();
    
    // Balance section should still show settled up for single user
    // Wait for the "All settled up!" message to appear
    await groupDetailPage.waitForSettledUpMessage();
  });
});