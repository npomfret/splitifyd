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
    const { page, user: user1 } = authenticatedPage;
    const { page: page2, user: user2 } = secondUser;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('Validation'), 'Testing form validation');

    // Get share link using the direct approach that works in other tests
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins
    await page2.goto(shareLink);
    await page2.waitForLoadState('domcontentloaded');
    const joinButton = page2.getByRole('button', { name: /join group/i });
    await expect(joinButton).toBeVisible();
    await joinButton.click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Wait for both users to be in the group
    await groupDetailPage.waitForMemberCount(2);
    
    // Verify both users are visible
    await expect(groupDetailPage.getTextElement(user1.displayName).first()).toBeVisible();
    await expect(groupDetailPage.getTextElement(user2.displayName).first()).toBeVisible();
    
    // Add an expense first so there's something to settle
    await groupDetailPage.addExpense({
      description: 'Test expense for settlement',
      amount: 100,
      paidBy: user1.displayName,
      currency: 'USD',
      splitType: 'equal'
    });
    
    // Wait for balance calculation
    await groupDetailPage.waitForBalanceCalculation();
    
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
