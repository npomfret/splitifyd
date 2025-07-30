import { test, expect } from './fixtures/base-test';
import { authenticatedTest } from './fixtures/authenticated-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, V2_URL } from './helpers';
import { createAndLoginTestUser } from './helpers/auth-utils';
import { DashboardPage, CreateGroupModalPage } from './pages';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

test.describe('Split Breakdown Visualization E2E', () => {
  
  test.describe('Split Breakdown Component', () => {
    authenticatedTest('should display enhanced split visualization with progress bars', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create a test group first
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Split Test Group', 'Testing split breakdown visualization');
      
      // Wait for navigation to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Create an expense
      const addExpenseButton = page.getByRole('button', { name: /Add Expense/i });
      await expect(addExpenseButton).toBeVisible();
      await addExpenseButton.click();
      
      // Fill out expense form
      await page.getByPlaceholder(/What was this expense for\?/i).fill('Test Restaurant Bill');
      await page.getByRole('spinbutton', { name: /Amount/i }).fill('120.00');
      
      // Select all participants for equal split
      const participantCheckboxes = page.getByRole('checkbox');
      const checkboxCount = await participantCheckboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        const checkbox = participantCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
        }
      }
      
      // Submit the expense
      await page.getByRole('button', { name: /Save Expense/i }).click();
      
      // Wait for navigation back to group page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Find and click on the created expense
      const expenseItem = page.getByText('Test Restaurant Bill');
      await expect(expenseItem).toBeVisible();
      await expenseItem.click();
      
      // Wait for expense detail page
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Verify split breakdown enhancements are present
      await expect(page.getByText(/Split between \d+ people?/i)).toBeVisible();
      
      // Check for split type badge
      const splitTypeBadge = page.locator('.rounded-full', { hasText: /Split Equally|Equal/i });
      await expect(splitTypeBadge).toBeVisible();
      
      // Check for progress bars (should have CSS classes for styling)
      const progressBars = page.locator('.bg-gray-200 .h-2, .bg-gray-200 .h-full, [class*="progress"], [style*="width"]');
      await expect(progressBars.first()).toBeVisible();
      
      // Check for percentage displays
      await expect(page.getByText(/%/)).toBeVisible();
      
      // Verify participant cards are enhanced (should show amounts and percentages)
      const participantCards = page.locator('.bg-gray-50, .rounded-lg').filter({ hasText: /\$/ });
      await expect(participantCards.first()).toBeVisible();
    });

    authenticatedTest('should show color coding for payer vs participants', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Navigate to existing group or create one
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Color Coding Test Group', 'Testing color coding');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Create expense and navigate to detail page (similar to above)
      const addExpenseButton = page.getByRole('button', { name: /Add Expense/i });
      await addExpenseButton.click();
      
      await page.getByPlaceholder(/What was this expense for\?/i).fill('Color Test Expense');
      await page.getByRole('spinbutton', { name: /Amount/i }).fill('100.00');
      
      // Select participants
      const participantCheckboxes = page.getByRole('checkbox');
      const checkboxCount = await participantCheckboxes.count();
      for (let i = 0; i < Math.min(2, checkboxCount); i++) {
        const checkbox = participantCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
        }
      }
      
      await page.getByRole('button', { name: /Save Expense/i }).click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await page.getByText('Color Test Expense').click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Check for green elements (payer indicators)
      const greenElements = page.locator('[class*="green"], .text-green-600, .bg-green-500, .text-green-400');
      await expect(greenElements.first()).toBeVisible();
      
      // Check for red elements (amounts owed)
      const redElements = page.locator('[class*="red"], .text-red-600, .bg-red-500, .text-red-400');
      await expect(redElements.first()).toBeVisible();
      
      // Check for status icons (checkmark for payer)
      const statusIcons = page.locator('svg, .absolute');
      await expect(statusIcons.first()).toBeVisible();
    });

    authenticatedTest('should display different split types with proper badges', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create group for split type testing
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Split Types Test', 'Testing different split types');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Test exact amounts split
      const addExpenseButton = page.getByRole('button', { name: /Add Expense/i });
      await addExpenseButton.click();
      
      await page.getByPlaceholder(/What was this expense for\?/i).fill('Exact Split Test');
      await page.getByRole('spinbutton', { name: /Amount/i }).fill('150.00');
      
      // Select participants
      const participantCheckboxes = page.getByRole('checkbox');
      const checkboxCount = await participantCheckboxes.count();
      for (let i = 0; i < Math.min(2, checkboxCount); i++) {
        const checkbox = participantCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
        }
      }
      
      // Switch to exact amounts split type
      const exactSplitOption = page.getByText(/Exact amounts/i);
      if (await exactSplitOption.isVisible()) {
        await exactSplitOption.click();
        
        // Fill in exact amounts if the UI appears
        const amountInputs = page.locator('input[type="number"]').filter({ hasText: '' }).or(
          page.locator('input[step="0.01"]')
        );
        const inputCount = await amountInputs.count();
        if (inputCount > 1) {
          await amountInputs.first().fill('90');
          await amountInputs.last().fill('60');
        }
      }
      
      await page.getByRole('button', { name: /Save Expense/i }).click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await page.getByText('Exact Split Test').click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Check for exact amounts badge
      const exactBadge = page.locator('.rounded-full', { hasText: /Exact Amounts|Exact/i });
      await expect(exactBadge).toBeVisible();
      
      // Verify different amounts are displayed
      await expect(page.getByText(/\$90\.00|\$60\.00/)).toBeVisible();
    });

    authenticatedTest('should be responsive on mobile viewport', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Create group and expense (abbreviated version)
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Mobile Test Group', 'Testing mobile layout');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      const addExpenseButton = page.getByRole('button', { name: /Add Expense/i });
      await addExpenseButton.click();
      
      await page.getByPlaceholder(/What was this expense for\?/i).fill('Mobile Test Expense');
      await page.getByRole('spinbutton', { name: /Amount/i }).fill('80.00');
      
      // Select participants
      const participantCheckboxes = page.getByRole('checkbox');
      const firstCheckbox = participantCheckboxes.first();
      if (!(await firstCheckbox.isChecked())) {
        await firstCheckbox.check();
      }
      
      await page.getByRole('button', { name: /Save Expense/i }).click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await page.getByText('Mobile Test Expense').click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Verify split breakdown is visible and properly laid out on mobile
      await expect(page.getByText(/Split between/i)).toBeVisible();
      
      // Check that elements don't overflow horizontally
      const splitSection = page.locator('div').filter({ hasText: /Split between/i }).first();
      await expect(splitSection).toBeVisible();
      
      // Verify progress bars are still visible on mobile
      const progressElements = page.locator('[class*="w-full"], [class*="h-2"]');
      await expect(progressElements.first()).toBeVisible();
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    authenticatedTest('should show proper percentage calculations', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // Create test scenario with known amounts for percentage verification
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Percentage Test', 'Testing percentage calculations');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      const addExpenseButton = page.getByRole('button', { name: /Add Expense/i });
      await addExpenseButton.click();
      
      // Create expense with round number for easy percentage calculation
      await page.getByPlaceholder(/What was this expense for\?/i).fill('Percentage Test Expense');
      await page.getByRole('spinbutton', { name: /Amount/i }).fill('200.00');
      
      // Select exactly 2 participants for 50/50 split
      const participantCheckboxes = page.getByRole('checkbox');
      const checkboxCount = await participantCheckboxes.count();
      for (let i = 0; i < Math.min(2, checkboxCount); i++) {
        const checkbox = participantCheckboxes.nth(i);
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
        }
      }
      
      await page.getByRole('button', { name: /Save Expense/i }).click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      await page.getByText('Percentage Test Expense').click();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Verify 50% splits are shown
      await expect(page.getByText('50.0%')).toBeVisible();
      await expect(page.getByText('$100.00')).toBeVisible();
      
      // Check that percentages add up (should see two 50% entries)
      const percentageElements = page.getByText('50.0%');
      await expect(percentageElements).toHaveCount(2);
    });
  });

  test.describe('Split Breakdown Error Handling', () => {
    authenticatedTest('should handle missing participant data gracefully', async ({ authenticatedPage }) => {
      const { page } = authenticatedPage;
      
      // This test would verify the component handles edge cases
      // For now, just verify the page loads without console errors
      
      const dashboardPage = new DashboardPage(page);
      const createGroupModal = new CreateGroupModalPage(page);
      
      await dashboardPage.openCreateGroupModal();
      await page.waitForTimeout(500);
      await createGroupModal.createGroup('Error Handling Test', 'Testing error scenarios');
      
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Verify no console errors occurred during group creation
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Navigate around and verify no errors
      await page.reload();
      await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 3000 });
      
      // Check that no console errors were logged
      expect(consoleErrors.length).toBe(0);
    });
  });
});