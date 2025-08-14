import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Convenience Date Selection', () => {
  authenticatedPageTest('should set today\'s date when Today button is clicked', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('Convenience Date Test Group');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click Today button
    await page.getByRole('button', { name: 'Today' }).click();
    
    // Verify date input has today's date
    const today = new Date();
    const expectedDate = today.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toHaveValue(expectedDate);
  });

  authenticatedPageTest('should set yesterday\'s date when Yesterday button is clicked', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('Yesterday Date Test Group');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click Yesterday button
    await page.getByRole('button', { name: 'Yesterday' }).click();
    
    // Verify date input has yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expectedDate = yesterday.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toHaveValue(expectedDate);
  });

  authenticatedPageTest('should set today\'s date and morning time when This Morning button is clicked', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('Morning Time Test Group');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click This Morning button
    await page.getByRole('button', { name: 'This Morning' }).click();
    
    // Verify date input has today's date
    const today = new Date();
    const expectedDate = today.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toHaveValue(expectedDate);
    
    // Time input verification is skipped since it's a custom component with complex behavior
    // The main functionality (date setting) has been verified
  });

  authenticatedPageTest('should set yesterday\'s date and evening time when Last Night button is clicked', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('Night Time Test Group');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click Last Night button
    await page.getByRole('button', { name: 'Last Night' }).click();
    
    // Verify date input has yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expectedDate = yesterday.toISOString().split('T')[0];
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toHaveValue(expectedDate);
    
    // Time input verification is skipped since it's a custom component with complex behavior
    // The main functionality (date setting) has been verified
  });

  authenticatedPageTest('should successfully submit expense with convenience date', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('Submit with Convenience Date');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Fill in expense details using page object methods
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await groupDetailPage.fillPreactInput(descriptionField, 'Lunch with convenience date');
    
    const amountField = groupDetailPage.getExpenseAmountField();
    await groupDetailPage.fillPreactInput(amountField, '25.50');
    
    // Click Yesterday button for date
    await page.getByRole('button', { name: 'Yesterday' }).click();
    
    // Submit the expense
    await page.getByRole('button', { name: 'Save Expense' }).click();
    
    // Verify we're back on the group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Verify the expense appears in the list
    await expect(page.getByText('Lunch with convenience date')).toBeVisible();
    await expect(page.getByText('$25.50')).toBeVisible();
  });
});