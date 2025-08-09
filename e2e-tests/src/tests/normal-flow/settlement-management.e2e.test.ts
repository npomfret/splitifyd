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
});
