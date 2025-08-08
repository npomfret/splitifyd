import { authenticatedPageTest as authenticatedTest, expect } from '../../fixtures/authenticated-page-test';
import { multiUserTest } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

authenticatedTest.describe('Negative Value Validation', () => {
  authenticatedTest('should prevent negative expense amounts in UI', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create a test group
    await groupWorkflow.createGroup(generateTestGroupName('NegativeValidation'), 'Testing negative value validation');

    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Try to enter negative amount
    const amountField = page.getByPlaceholder('0.00');
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('-50');
    
    // Verify HTML5 validation prevents negative values
    const minValue = await amountField.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Try to submit form with negative value
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('-100');
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Form should not submit - we should still be on the add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Browser should show validation message
    const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
    
    // Now enter a valid positive amount
    await groupDetailPage.fillPreactInput(amountField, '50');
    await groupDetailPage.fillPreactInput(page.getByPlaceholder('What was this expense for?'), 'Valid expense');
    
    // Select all participants
    await page.getByRole('button', { name: 'Select all' }).click();
    
    // Submit should work now
    await page.getByRole('button', { name: /save expense/i }).click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created
    await expect(page.getByText('Valid expense')).toBeVisible();
    await expect(page.getByText('$50.00')).toBeVisible();
  });

  authenticatedTest('should prevent zero expense amounts in UI', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create a test group
    await groupWorkflow.createGroup(generateTestGroupName('ZeroValidation'), 'Testing zero value validation');

    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Try to enter zero amount
    const amountField = page.getByPlaceholder('0.00');
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('0');
    await groupDetailPage.fillPreactInput(page.getByPlaceholder('What was this expense for?'), 'Zero expense');
    
    // Select all participants
    await page.getByRole('button', { name: 'Select all' }).click();
    
    // Try to submit
    await page.getByRole('button', { name: /save expense/i }).click();
    
    // Form should not submit due to min validation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Verify validation prevents submission
    const isInvalid = await amountField.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  multiUserTest('should prevent negative settlement amounts in UI', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('SettleNegative'), 'Testing negative settlements');

    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await secondUser.groupDetailPage.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Refresh to see both members
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForMemberCount(2);
    
    // Create an expense first
    await groupDetailPage.addExpense({
      description: 'Test expense for settlement',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify expense was created
    await expect(page.getByText('Test expense for settlement')).toBeVisible();
    
    // Open settlement form
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Try to enter negative amount
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountInput.fill('-50');
    
    // Verify HTML5 validation
    const minValue = await amountInput.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Verify submit button is disabled with negative value
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await expect(submitButton).toBeDisabled();
    
    // Modal should still be open (form can't be submitted)
    await expect(modal).toBeVisible();
    
    // Enter valid amount
    await groupDetailPage.fillPreactInput(amountInput, '50');
    
    // Select payer and payee
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1
    
    // Verify submit button is now enabled with valid data
    await expect(submitButton).toBeEnabled();
    
    // Now submit should work
    await submitButton.click();
    await expect(modal).not.toBeVisible();
    
    // Verify settlement was recorded
    const showHistoryButton = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton.click();
    await expect(page.getByText(/\$50\.00/)).toBeVisible();
  });

  multiUserTest('should prevent negative split amounts', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('NegativeSplit'), 'Testing negative split amounts');

    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    await page2.goto(shareLink);
    await secondUser.groupDetailPage.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Refresh to see both members
    await page.reload();
    await page.waitForLoadState('networkidle');
    await groupDetailPage.waitForMemberCount(2);
    
    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Fill expense details
    await groupDetailPage.fillPreactInput(page.getByPlaceholder('0.00'), '100');
    await groupDetailPage.fillPreactInput(page.getByPlaceholder('What was this expense for?'), 'Split test expense');
    
    // Select all participants first
    await page.getByRole('button', { name: 'Select all' }).click();
    
    // Select exact amounts split type
    await page.getByText('Exact amounts').click();
    
    // Try to enter negative split amount
    const splitInputs = page.locator('input[type="number"][step="0.01"][min="0.01"]');
    const firstSplitInput = splitInputs.first();
    // Use direct fill for invalid value - UI should validate but not format/clear
    await firstSplitInput.fill('-50');
    
    // Verify min validation
    const minValue = await firstSplitInput.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Try to submit with negative split - HTML5 validation should prevent it
    const saveButton = page.getByRole('button', { name: /save expense/i });
    await saveButton.click();
    
    // Should still be on add expense page due to validation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Browser should show validation message
    const validationMessage = await firstSplitInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
    
    
    // The main goal is achieved: negative split amounts are prevented by validation
    // We don't need to test the full expense creation flow here
  });

  authenticatedTest('should validate input using browser HTML5 validation', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create a test group
    await groupWorkflow.createGroup(generateTestGroupName('HTML5Validation'), 'Testing HTML5 validation');

    // Navigate to add expense
    await groupDetailPage.getAddExpenseButton().click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    const amountField = page.getByPlaceholder('0.00');
    
    // Test various invalid inputs
    const testCases = [
      { value: '-100', shouldBeInvalid: true, description: 'negative number' },
      { value: '0', shouldBeInvalid: true, description: 'zero' },
      { value: '-0.01', shouldBeInvalid: true, description: 'small negative' },
      { value: '0.001', shouldBeInvalid: true, description: 'very small positive below min' }, // Below min 0.01
      { value: '1', shouldBeInvalid: false, description: 'valid positive' },
      { value: '999999', shouldBeInvalid: false, description: 'large positive' }
    ];
    
    for (const testCase of testCases) {
      // Use direct fill for test values - UI should validate but not format/clear
      await amountField.fill(testCase.value);
      
      // Use browser's built-in HTML5 validation
      const isValid = await amountField.evaluate((el: HTMLInputElement) => el.checkValidity());
      const expectedValid = !testCase.shouldBeInvalid;
      
      expect(isValid).toBe(expectedValid);
      
      if (testCase.shouldBeInvalid) {
        // Verify validation message exists for invalid values
        const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
        expect(validationMessage).toBeTruthy();
      }
    }
  });
});