import { multiUserTest as test, expect } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';
import { generateTestGroupName } from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Settlement Management', () => {
  test('should create a new settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group with first user
    await groupWorkflow.createGroup(generateTestGroupName('Settlement'), 'Testing settlements');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Get share link and have second user join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    // Second user joins the group
    const page2 = secondUser.page;
    const groupDetailPage2 = secondUser.groupDetailPage;

    await page2.goto(shareLink);
    await expect(groupDetailPage2.getJoinGroupHeading()).toBeVisible();
    await groupDetailPage2.getJoinGroupButton().click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // First user adds an expense to create debt
    await page.reload(); // Refresh to see new member
    await page.waitForLoadState('networkidle'); // Wait for member list to update
    await groupDetailPage.addExpense({
      description: 'Test expense for settlement',
      amount: 100,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Click Settle Up button
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Fill settlement form with correct labels
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    const noteInput = page.getByRole('textbox', { name: /note/i });
    
    // Select options by index since UIDs might not match
    // First option is placeholder, second is user1, third is user2
    await payerSelect.selectOption({ index: 2 }); // user2
    await payeeSelect.selectOption({ index: 1 }); // user1
    await amountInput.fill('50');
    await noteInput.fill('Test settlement payment');
    
    // Submit the form
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    // Verify modal closes
    await expect(modal).not.toBeVisible();
    
    // Verify settlement shows in history
    const showHistoryButton = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton.click();
    
    const settlementEntry = page.getByText(/test settlement payment/i);
    await expect(settlementEntry).toBeVisible();
  });

  test('should update balances after settlement', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('BalanceUpd'), 'Testing balance updates');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    // Add expense
    await page.reload();
    await groupDetailPage.addExpense({
      description: 'Dinner',
      amount: 200,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify debt exists before settlement
    const balanceSection = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Balances' }) });
    await expect(balanceSection.getByText('Loading balances...')).not.toBeVisible();
    await expect(balanceSection.getByText(/owes/i).first()).toBeVisible();
    
    // Record settlement for the exact debt amount shown
    const debtAmount = balanceSection.locator('.text-red-600');
    await expect(debtAmount).toBeVisible();
    const amountToSettle = await debtAmount.textContent();
    const settlementAmount = amountToSettle?.replace('$', '') || '100';
    
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Fill settlement form
    await page.getByRole('combobox', { name: /who paid/i }).selectOption({ index: 2 });
    await page.getByRole('combobox', { name: /who received the payment/i }).selectOption({ index: 1 });
    await page.getByRole('spinbutton', { name: /amount/i }).fill(settlementAmount);
    await page.getByRole("textbox", { name: /note/i }).fill("Full settlement payment");
    
    await modal.getByRole('button', { name: /record payment/i }).click();
    await expect(modal).not.toBeVisible();
    
    // Verify settlement processed - the balance should show settled up
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('All settled up!')).toBeVisible();
  });

  test('should validate settlement form', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup(generateTestGroupName('Validation'), 'Testing form validation');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    
    // Open settlement form
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Test negative amount
    const amountInput = page.getByRole('spinbutton', { name: /amount/i });
    await amountInput.fill('-10');
    
    // Try to submit - should be disabled due to validation
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await expect(submitButton).toBeDisabled();
    
    // Fix amount
    await amountInput.fill('10');
    
    // Test same payer and payee by directly setting form state
    const payerSelect = page.getByRole('combobox', { name: /who paid/i });
    const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
    
    // Get the first user value from payer select
    await payerSelect.selectOption({ index: 1 });
    const selectedPayerValue = await payerSelect.inputValue();
    
    // Manually set the payee to the same value using JavaScript to bypass filtering
    await page.evaluate((payerValue) => {
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

  test('should display settlement history', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup('History Test Group', 'Testing settlement history');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    
    // Add an expense to create debt that can be settled
    await groupDetailPage.addExpense({
      description: "Initial expense for settlement",
      amount: 200,
      paidBy: user1.displayName,
      splitType: "equal"
    });
    
    await page.reload();
    await page.waitForLoadState("networkidle");    
    // Add multiple settlements
    for (let i = 1; i <= 2; i++) {
      const settleButton = page.getByRole('button', { name: /settle up/i });
      await settleButton.click();
      
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      
      const payerSelect = page.getByRole('combobox', { name: /who paid/i });
      const payeeSelect = page.getByRole('combobox', { name: /who received the payment/i });
      const amountInput = page.getByRole('spinbutton', { name: /amount/i });
      const noteInput = page.getByRole('textbox', { name: /note/i });
      
      // Select by index
      await payerSelect.selectOption({ index: 2 }); // user2
      await payeeSelect.selectOption({ index: 1 }); // user1
      await amountInput.fill(`${i * 10}`);
      await noteInput.fill(`Settlement #${i}`);
      
      const submitButton = modal.getByRole('button', { name: /record payment/i });
      await submitButton.click();
      
      await expect(modal).not.toBeVisible();
      await page.waitForLoadState('networkidle'); // Wait for settlement processing
    }
    
    // View history
    const showHistoryButton = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton.click();
    
    // Verify both settlements appear
    const settlement1 = page.getByText(/Settlement #1/i);
    const settlement2 = page.getByText(/Settlement #2/i);
    
    await expect(settlement1).toBeVisible();
    await expect(settlement2).toBeVisible();
  });

  test('should handle multiple currencies', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
    const { page, user: user1 } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    
    // Create group and add second user
    await groupWorkflow.createGroup('Multi-Currency Test', 'Testing multiple currencies');
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share and join
    await groupDetailPage.getShareButton().click();
    const shareLink = await groupDetailPage.getShareLinkInput().inputValue();
    await page.keyboard.press('Escape');
    
    const page2 = secondUser.page;
    await page2.goto(shareLink);
    await page2.getByRole('button', { name: /join group/i }).click();
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await page.reload();
    
    // Open settlement form
    const settleButton = page.getByRole('button', { name: /settle up/i });
    await settleButton.click();
    
    const modal = page.getByRole('dialog');
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
    await amountInput.fill('100');
    await currencySelect.selectOption('EUR');
    await noteInput.fill('Euro payment');
    
    // Submit
    const submitButton = modal.getByRole('button', { name: /record payment/i });
    await submitButton.click();
    
    await expect(modal).not.toBeVisible();
    
    // View history
    const showHistoryButton = page.getByRole('button', { name: 'Show History' });
    await showHistoryButton.click();
    
    // Verify Euro settlement appears - look for EUR currency indication
    const euroSettlement = page.getByText(/EUR/i);
    await expect(euroSettlement).toBeVisible();
    
  });
});
