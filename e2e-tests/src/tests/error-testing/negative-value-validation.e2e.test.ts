import {authenticatedPageTest as authenticatedTest, expect} from '../../fixtures/authenticated-page-test';
import {multiUserTest} from '../../fixtures';
import {setupMCPDebugOnFailure} from '../../helpers';
import {GroupWorkflow} from '../../workflows';
import {generateTestGroupName} from '../../utils/test-helpers';

setupMCPDebugOnFailure();

authenticatedTest.describe('Negative Value Validation', () => {
  authenticatedTest('should prevent negative expense amounts in UI', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Create group and prepare for expenses using helper method
    const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('NegativeValidation'), 'Testing negative value validation');
    const memberCount = 1;

    // Navigate to expense form with proper waiting
    const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
    
    // Try to enter negative amount
    const amountField = expenseFormPage.getAmountInput();
    // Assert field is clear before testing
    const initialValue = await amountField.inputValue();
    expect(initialValue).toBe('');
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('-50');
    
    // Verify HTML5 validation prevents negative values
    const minValue = await amountField.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Fill description to enable form validation
    await expenseFormPage.fillDescription('Test expense');
    
    // Try to submit form with negative value
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('-100');
    
    // Button should be enabled (required fields are filled) but form submission should be prevented by HTML5 validation
    const saveButton = expenseFormPage.getSaveExpenseButton();
    await expect(saveButton).toBeEnabled();
    
    // Try to submit - HTML5 validation should prevent it
    await saveButton.click({ force: true }); // Use force to bypass Playwright's built-in validation
    
    // Form should not submit - we should still be on the add expense page due to HTML5 validation
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Browser should show validation message
    const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
    
    // Now enter a valid positive amount
    await expenseFormPage.fillAmount('50');
    await expenseFormPage.fillDescription('Valid expense');
    
    // Select all participants
    await expenseFormPage.selectAllParticipants();
    
    // Submit should work now
    await expenseFormPage.saveExpense();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Verify expense was created
    await expect(page.getByText('Valid expense')).toBeVisible();
    await expect(page.getByText('$50.00')).toBeVisible();
  });

  authenticatedTest('should prevent zero expense amounts in UI', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    
    // Create group and prepare for expenses using helper method
    const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('ZeroValidation'), 'Testing zero value validation');
    const memberCount = 1;

    // Navigate to expense form with proper waiting
    const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
    
    // Try to enter zero amount
    const amountField = expenseFormPage.getAmountInput();
    // Assert field is clear before testing
    const initialValue = await amountField.inputValue();
    expect(initialValue).toBe('');
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountField.fill('0');
    await expenseFormPage.fillDescription('Zero expense');
    
    // Select all participants
    await expenseFormPage.selectAllParticipants();
    
    // Button should be disabled due to zero amount validation
    const saveButton = expenseFormPage.getSaveExpenseButton();
    await expect(saveButton).toBeDisabled();
    
    // Form should remain on add expense page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    // Verify HTML5 validation would also catch this
    const isInvalid = await amountField.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  multiUserTest('should prevent negative settlement amounts in UI', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const { page: page2} = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    const memberCount = 2;

    // Create group and add second user
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('SettleNegative'), 'Testing negative settlements');

    // Share and join
    await groupDetailPage.shareGroupAndWaitForJoin(page2);
    
    // Wait to see both members
    await page.waitForLoadState('domcontentloaded');
    await groupDetailPage.waitForMemberCount(memberCount);
    
    // Create an expense first
    const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
    await expenseFormPage.submitExpense({
      description: 'Test expense for settlement',
      amount: 100,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Verify expense was created
    await expect(page.getByText('Test expense for settlement')).toBeVisible();
    
    // Open settlement form
    const settlementFormPage = await groupDetailPage.clickSettleUpButton(memberCount);
    const modal = settlementFormPage.getModal();
    await expect(modal).toBeVisible();
    
    // Try to enter negative amount
    const amountInput = settlementFormPage.getAmountInput();
    // Assert field is clear before testing
    const initialValue = await amountInput.inputValue();
    expect(initialValue).toBe('');
    // Use direct fill for invalid value - UI should validate but not format/clear
    await amountInput.fill('-50');
    
    // Verify HTML5 validation
    const minValue = await amountInput.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Verify submit button is disabled with negative value
    const submitButton = settlementFormPage.getRecordPaymentButton();
    await expect(submitButton).toBeDisabled();
    
    // Modal should still be open (form can't be submitted)
    await expect(modal).toBeVisible();
    
    // Enter valid amount
    await settlementFormPage.fillPreactInput(amountInput, '50');
    
    // Select payer and payee
    const payerSelect = settlementFormPage.getPayerSelect();
    const payeeSelect = settlementFormPage.getPayeeSelect();
    
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1
    
    // Verify submit button is now enabled with valid data
    await expect(submitButton).toBeEnabled();
    
    // Now submit should work
    await submitButton.click();
    await expect(modal).not.toBeVisible();
    
    // Verify settlement was recorded
    const showHistoryButton = groupDetailPage.getShowHistoryButton();
    await showHistoryButton.click();
    await expect(page.getByText(/\$50\.00/)).toBeVisible();
  });

  multiUserTest('should prevent negative split amounts', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page } = authenticatedPage;
    const { page: page2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('NegativeSplit'), 'Testing negative split amounts');

    // Share and join
    await groupDetailPage.shareGroupAndWaitForJoin(page2);
    
    // Wait to see both members
    await page.waitForLoadState('domcontentloaded');
    await groupDetailPage.waitForMemberCount(2);
    
    // Navigate to add expense form with proper validation
    const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
    
    // Fill expense details
    await expenseFormPage.fillAmount('100');
    await expenseFormPage.fillDescription('Split test expense');
    
    // Select all participants first
    await expenseFormPage.selectAllParticipants();
    
    // Select exact amounts split type
    await expenseFormPage.switchToExactAmounts();
    
    // Try to enter negative split amount
    const splitInputs = expenseFormPage.getInputWithMinValue('0.01');
    const firstSplitInput = splitInputs.first();
    // When switching to "Exact amounts" mode, the app pre-populates each person's share
    // by dividing the total amount equally among selected participants (e.g., $100 / 4 = $25 each)
    // This is correct UX behavior - we just need to verify the field has a value
    const initialValue = await firstSplitInput.inputValue();
    expect(initialValue).toBeTruthy();
    expect(Number(initialValue)).toBeGreaterThan(0);
    // Use direct fill for invalid value - UI should validate but not format/clear
    await firstSplitInput.fill('-50');
    
    // Verify min validation
    const minValue = await firstSplitInput.getAttribute('min');
    expect(minValue).toBe('0.01');
    
    // Try to submit with negative split - button should be disabled due to validation
    const saveButton = expenseFormPage.getSaveExpenseButton();
    await expect(saveButton).toBeDisabled();
    
    // Should still be on add expense page
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
    await groupWorkflow.createGroupAndNavigate(generateTestGroupName('HTML5Validation'), 'Testing HTML5 validation');

    // Navigate to add expense
    const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    
    const amountField = expenseFormPage.getAmountInput();
    
    // Assert field is initially clear
    const initialValue = await amountField.inputValue();
    expect(initialValue).toBe('');
    
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
      // Clear field before each test
      await expenseFormPage.fillAmount('');
      // Assert field is clear before testing each value
      const clearedValue = await amountField.inputValue();
      expect(clearedValue).toBe('');
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