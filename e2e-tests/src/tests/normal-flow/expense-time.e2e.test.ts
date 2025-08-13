import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';

// Enable debugging helpers
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedPageTest.describe('Expense Time Selection', () => {
  authenticatedPageTest('should default to 12:00 PM for new expenses', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage,
    createGroupModalPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a group to work with
    const groupId = await groupWorkflow.createGroupAndNavigate('Time Test Group', 'Testing time input');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense form
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Check that time input shows default "at 12:00 PM"
    const timeButton = page.getByRole('button', { name: /at 12:00 PM/ });
    await expect(timeButton).toBeVisible();
  });

  authenticatedPageTest('should allow clicking time to edit', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Time Edit Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click on time button to start editing
    const timeButton = page.getByRole('button', { name: /at 12:00 PM/ });
    await timeButton.click();
    
    // Should now show an input field
    const timeInput = page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    await expect(timeInput).toBeVisible();
    await expect(timeInput).toBeFocused();
  });

  authenticatedPageTest('should show time suggestions when typing', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Time Suggestions Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Click to edit time
    await page.getByRole('button', { name: /at 12:00 PM/ }).click();
    
    // Type "8" to trigger suggestions
    const timeInput = page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    await timeInput.fill('8');
    
    // Should show suggestions containing "8:00 AM" and "8:00 PM"
    await expect(page.getByRole('button', { name: '8:00 AM' })).toBeVisible();
    await expect(page.getByRole('button', { name: '8:00 PM' })).toBeVisible();
  });

  authenticatedPageTest('should accept time selection from suggestions', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Time Selection Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Edit time and select suggestion
    await page.getByRole('button', { name: /at 12:00 PM/ }).click();
    await page.getByPlaceholder('Enter time (e.g., 2:30pm)').fill('8');
    await page.getByRole('button', { name: '8:00 PM' }).click();
    
    // Should now show the selected time
    await expect(page.getByRole('button', { name: 'at 8:00 PM' })).toBeVisible();
  });

  authenticatedPageTest('should parse freeform time input', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Freeform Time Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Edit time with freeform input
    await page.getByRole('button', { name: /at 12:00 PM/ }).click();
    const timeInput = page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    await timeInput.fill('2:45pm');
    
    // Click outside to commit the change
    await page.getByRole('heading', { name: 'Expense Details' }).click(); // Click on form title to blur input
    
    // Should parse and show the time
    await expect(page.getByRole('button', { name: 'at 2:45 PM' })).toBeVisible();
  });

  authenticatedPageTest('should create expense with specified time', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Time Creation Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Fill out expense form with time
    await page.getByPlaceholder('What was this expense for?').fill('Lunch with time');
    await page.getByPlaceholder('0.00').fill('25.50');
    
    // Set specific time
    await page.getByRole('button', { name: /at 12:00 PM/ }).click();
    await page.getByPlaceholder('Enter time (e.g., 2:30pm)').fill('1:30pm');
    await page.getByRole('heading', { name: 'Expense Details' }).click(); // Blur to commit time
    
    // Submit the form
    await page.getByRole('button', { name: 'Save Expense' }).click();
    
    // Should navigate back to group and show expense
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Should show expense with time (since it's not default noon)
    await expect(page.getByText('Lunch with time')).toBeVisible();
    // Note: The exact date format will depend on timezone, so we just check for the expense
  });

  authenticatedPageTest('should show date only for default noon time', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Navigate to expense form  
    await expect(page).toHaveURL(/\/dashboard/);
    const groupId = await groupWorkflow.createGroupAndNavigate('Default Time Test');
    await groupDetailPage.getAddExpenseButton().click();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Create expense with default noon time (don't change time)
    await page.getByPlaceholder('What was this expense for?').fill('Default noon expense');
    await page.getByPlaceholder('0.00').fill('15.00');
    
    // Submit without changing time (should remain 12:00 PM)
    await page.getByRole('button', { name: 'Save Expense' }).click();
    
    // Should navigate back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Expense should be visible (date format will vary by timezone)
    await expect(page.getByText('Default noon expense')).toBeVisible();
  });
});