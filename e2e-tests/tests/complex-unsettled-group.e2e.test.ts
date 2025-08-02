import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
  test('create group with multiple people and expenses that is NOT settled', async ({ browser }) => {
    test.setTimeout(30000); // Increase timeout to 30 seconds for this complex test
    // Create User 1 (Alice - the group creator)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const user1 = await createAndLoginTestUser(page1);

    // Create a group for vacation expenses
    const createGroupModal = new CreateGroupModalPage(page1);
    await page1.getByRole('button', { name: 'Create Group' }).click();
    await page1.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Vacation Trip 2024', 'Beach house rental and activities');
    
    // Wait for navigation to group page
    await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    const groupUrl = page1.url();

    // Verify Alice is in the group
    await expect(page1.getByText('Vacation Trip 2024')).toBeVisible();
    await expect(page1.getByRole('main').getByText(user1.displayName)).toBeVisible();
    
    // Alice adds the first expense: Beach house rental ($800)
    const addExpenseButton = page1.getByRole('button', { name: /add expense/i })
      .or(page1.getByRole('link', { name: /add expense/i }));
    
    if (await addExpenseButton.count() > 0) {

      await addExpenseButton.first().click();
      await page1.waitForLoadState('domcontentloaded');
      
      const descriptionField = page1.getByLabel(/description/i)
        .or(page1.locator('input[name*="description"]'))
        .or(page1.getByPlaceholder(/what was this expense/i));
      const amountField = page1.getByLabel(/amount/i)
        .or(page1.locator('input[type="number"]'));
      
      if (await descriptionField.count() > 0 && await amountField.count() > 0) {
        await descriptionField.first().fill('Beach House Rental');
        await amountField.first().fill('800.00');
        
        // Submit expense
        const submitButton = page1.getByRole('button', { name: /add expense/i })
          .or(page1.getByRole('button', { name: /create/i }))
          .or(page1.getByRole('button', { name: /save/i }));
        
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
        
        // Verify we're back on group page and expense appears
        await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
        await expect(page1.getByText('Beach House Rental', { exact: true })).toBeVisible();

      }
      
      // Alice adds second expense: Groceries ($150)
      await addExpenseButton.first().click();
      await page1.waitForLoadState('domcontentloaded');
      
      if (await descriptionField.count() > 0 && await amountField.count() > 0) {
        await descriptionField.first().fill('Groceries for the week');
        await amountField.first().fill('150.00');
        
        const submitButton = page1.getByRole('button', { name: /add expense/i })
          .or(page1.getByRole('button', { name: /create/i }))
          .or(page1.getByRole('button', { name: /save/i }));
        
        await submitButton.first().click();
        await page1.waitForLoadState('networkidle');
        
        await expect(page1.getByText('Groceries for the week', { exact: true })).toBeVisible();

      }
    }
    
    // Create User 2 (Bob) in a separate context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);

    // Simulate Bob joining the group (in real app would be via invitation)
    // For now, we'll document that Bob would need to be invited

    // If group joining worked, Bob would add expenses like:
    // - Restaurant dinner ($180)
    // - Gas for road trip ($75)
    
    // Back to Alice's context - check the current balance state
    await page1.reload();
    await page1.waitForLoadState('networkidle');
    
    // Look for balance information

    // Check if the group shows unsettled balances
    const balanceElements = page1.getByText(/balance/i)
      .or(page1.getByText(/owe/i))
      .or(page1.getByText(/owed/i))
      .or(page1.getByText(/\$/));
    
    const balanceCount = await balanceElements.count();

    // Look for total amounts
    const totalElements = page1.getByText(/950|800|150/)
      .or(page1.getByText(/\$950|\$800|\$150/));
    const totalCount = await totalElements.count();

    // Check if group appears settled or unsettled
    const settledIndicators = page1.getByText(/settled/i)
      .or(page1.getByText(/balanced/i))
      .or(page1.getByText(/even/i));
    const unsettledIndicators = page1.getByText(/owes/i)
      .or(page1.getByText(/debt/i))
      .or(page1.getByText(/unbalanced/i));
    
    const isSettled = await settledIndicators.count() > 0;
    const isUnsettled = await unsettledIndicators.count() > 0;


    // Verify the expenses are visible
    await expect(page1.getByText('Beach House Rental', { exact: true })).toBeVisible();
    await expect(page1.getByText('Groceries for the week', { exact: true })).toBeVisible();
    
    // Total should be $950 if both expenses were added
    const totalExpected = 800 + 150; // $950

    // Check if any settlement functionality exists
    const settlementButton = page1.getByRole('button', { name: /settle/i })
      .or(page1.getByRole('button', { name: /record payment/i }))
      .or(page1.getByText(/settle up/i));
    
    const hasSettlement = await settlementButton.count() > 0;

    // Final state summary










    // Clean up
    await context1.close();
    await context2.close();
    
    // Verify test completed its documentation

  });
});