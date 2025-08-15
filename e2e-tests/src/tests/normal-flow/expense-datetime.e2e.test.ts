import { authenticatedPageTest, expect } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';

setupMCPDebugOnFailure();

authenticatedPageTest.describe('Expense Date and Time Selection', () => {
  authenticatedPageTest('should handle all date convenience buttons and time input scenarios', async ({ 
    authenticatedPage,
    dashboardPage,
    groupDetailPage
  }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Verify starting state
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Create a test group
    const groupId = await groupWorkflow.createGroupAndNavigate('DateTime Test Group', 'Testing date and time inputs');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    await groupDetailPage.clickButton(groupDetailPage.getAddExpenseButton(), { buttonName: 'Add Expense' });
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // === DATE CONVENIENCE BUTTONS TESTS ===
    const dateInput = groupDetailPage.getDateInput();
    
    // Test Today button
    await groupDetailPage.clickTodayButton();
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(todayDate);
    
    // Test Yesterday button
    await groupDetailPage.clickYesterdayButton();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(yesterdayDate);
    
    // Test This Morning button (sets today's date + morning time)
    await groupDetailPage.clickThisMorningButton();
    await expect(dateInput).toHaveValue(todayDate);
    
    // Test Last Night button (sets yesterday's date + evening time)
    await groupDetailPage.clickLastNightButton();
    await expect(dateInput).toHaveValue(yesterdayDate);
    
    // === TIME INPUT TESTS ===
    
    // Note: Last Night button sets evening time (8:00 PM), not default noon
    // Check if time button is visible (should be after clicking Last Night)
    let timeButton = page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
    const timeButtonCount = await timeButton.count();
    
    if (timeButtonCount === 0) {
      // Time is not visible, try clicking clock icon
      const clockIcon = groupDetailPage.getClockIcon();
      const clockIconCount = await clockIcon.count();
      
      if (clockIconCount > 0) {
        await groupDetailPage.clickClockIcon();
      }
      // Re-get the time button after clicking clock icon
      timeButton = page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
    }
    
    // Time should be visible now (showing 8:00 PM from Last Night button)
    await expect(timeButton).toBeVisible();
    
    // Click time to edit
    await timeButton.click();
    const timeInput = page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    await expect(timeInput).toBeVisible();
    await expect(timeInput).toBeFocused();
    
    // Show time suggestions when typing
    await timeInput.fill('3');
    await expect(page.getByRole('button', { name: '3:00 AM' })).toBeVisible();
    await expect(page.getByRole('button', { name: '3:00 PM' })).toBeVisible();
    
    // Accept time selection from suggestions
    await page.getByRole('button', { name: '3:00 PM' }).click();
    await expect(page.getByRole('button', { name: 'at 3:00 PM' })).toBeVisible();
    
    // Parse freeform time input
    await page.getByRole('button', { name: 'at 3:00 PM' }).click();
    await timeInput.fill('2:45pm');
    await page.getByRole('heading', { name: 'Expense Details' }).click(); // Blur to commit
    await expect(page.getByRole('button', { name: 'at 2:45 PM' })).toBeVisible();
    
    // === SUBMIT EXPENSE WITH CUSTOM DATE/TIME ===
    await groupDetailPage.waitForExpenseFormSections();
    
    // Fill in expense details
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await groupDetailPage.fillPreactInput(descriptionField, 'Dinner with custom datetime');
    
    const amountField = groupDetailPage.getExpenseAmountField();
    await groupDetailPage.fillPreactInput(amountField, '45.50');
    
    // Set a specific date using Yesterday button
    await groupDetailPage.clickYesterdayButton();
    
    // Set a specific time
    await page.getByRole('button', { name: 'at 2:45 PM' }).click();
    await timeInput.fill('7:30pm');
    await page.getByRole('heading', { name: 'Expense Details' }).click(); // Blur to commit
    
    // Select the payer
    await groupDetailPage.selectPayer(user.displayName);
    
    // Select participants for the split
    await groupDetailPage.clickSelectAllButton();
    
    // Validate form before submitting
    const validation = await groupDetailPage.validateExpenseFormReady();
    if (!validation.isValid) {
      throw new Error(
        `Form validation failed before submit:\n` +
        validation.errors.map(e => `  - ${e}`).join('\n')
      );
    }
    
    // Submit the expense
    await groupDetailPage.clickButton(groupDetailPage.getSaveExpenseButton(), { buttonName: 'Save Expense' });
    
    // Verify we're back on the group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Verify the expense appears in the list
    await groupDetailPage.verifyExpenseInList('Dinner with custom datetime', '$45.50');
    
    // === SUBMIT EXPENSE WITH DEFAULT TIME ===
    await groupDetailPage.clickAddExpenseButton();
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Create expense without changing time (keep default 12:00 PM)
    await page.getByPlaceholder('What was this expense for?').fill('Lunch with default time');
    await page.getByPlaceholder('0.00').fill('15.00');
    
    // Submit without changing time
    await page.getByRole('button', { name: 'Save Expense' }).click();
    
    // Should navigate back to group
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Lunch with default time')).toBeVisible();
  });
});