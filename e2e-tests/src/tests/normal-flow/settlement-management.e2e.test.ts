import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Settlement Management', () => {
  // Note: Basic settlement creation and balance update tests have been removed
  // as they are better covered by the comprehensive three-user-settlement test
  
  test('should validate settlement form', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('Validation'), 'Testing form validation');

    // Share and join
    const page2 = secondUser.page;
    await groupDetailPage.shareGroupAndWaitForJoin(page2);
    
    // Open settlement form
    const settleButton = groupDetailPage.getSettleUpButton();
    await settleButton.click();
    
    const modal = groupDetailPage.getSettlementModal();
    await expect(modal).toBeVisible();
    
    // Test negative amount
    const amountInput = groupDetailPage.getSettlementAmountInput();
    await groupDetailPage.fillPreactInput(amountInput, '-10');
    
    // Try to submit - should be disabled due to validation
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await expect(submitButton).toBeDisabled();
    
    // Fix amount
    await groupDetailPage.fillPreactInput(amountInput, '10');
    
    // Test same payer and payee by directly setting form state
    const payerSelect = groupDetailPage.getPayerSelect();

    // Get the first user value from payer select
    await payerSelect.selectOption({ index: 1 });
    const selectedPayerValue = await payerSelect.inputValue();
    
    // Manually set the payee to the same value using JavaScript to bypass filtering
    await page.evaluate((payerValue: string) => {
      const payeeSelect = document.querySelector('select[id="payee"]') as HTMLSelectElement;
      if (payeeSelect) {
        payeeSelect.value = payerValue;
        payeeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, selectedPayerValue);
    
    // Should be disabled due to same person validation
    await expect(submitButton).toBeDisabled();
    
    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  // Note: Settlement history test removed - covered by three-user-settlement test
  
  test('should handle multiple currencies', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup('Multi-Currency Test', 'Testing multiple currencies');

    // Share and join
    const page2 = secondUser.page;
    await groupDetailPage.shareGroupAndWaitForJoin(page2);
    
    // Open settlement form
    const settleButton = groupDetailPage.getSettleUpButton();
    await settleButton.click();
    
    const modal = groupDetailPage.getSettlementModal();
    await expect(modal).toBeVisible();
    
    // Fill form with Euro
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    const currencySelect = page.getByRole('combobox', { name: /currency/i });
    const noteInput = page.getByRole('textbox', { name: /note/i });
    
    // Select by index
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1
    await groupDetailPage.fillPreactInput(amountInput, '100');
    await currencySelect.selectOption('EUR');
    await groupDetailPage.fillPreactInput(noteInput, 'Euro payment');
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    await expect(modal).not.toBeVisible();
    
    // Refresh to ensure UI is updated with new settlement
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // View history
    const showHistoryButton = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton.click();
    
    // Verify Euro settlement appears - look for EUR currency indication
    const euroSettlement = page.getByText(/EUR/i);
    await expect(euroSettlement).toBeVisible();
    
    // Verify the settlement amount appears using the page object method
    const settlementAmount = groupDetailPage.getSettlementAmountInHistory('100.00', 'EUR');
    await expect(settlementAmount).toBeVisible();
    
  });
});
