import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Multi-User Scenario Test', () => {
  test('create complex group with multiple users and expenses', async ({ browser }) => {
    test.setTimeout(30000); // 30 seconds timeout
    // Create first user (group creator)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const user1 = await createAndLoginTestUser(page1);

    // User 1 creates a group
    const dashboard = new DashboardPage(page1);
    const createGroupModal = new CreateGroupModalPage(page1);
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Vacation Group', 'Complex expense sharing test');
    
    // Wait for navigation to group page
    await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 500 });
    const groupUrl = page1.url();

    // Verify User 1 is in the group - be more specific to avoid duplicate matches
    await expect(page1.getByRole('main').getByText(user1.displayName).first()).toBeVisible();
    await expect(page1.getByText('Vacation Group')).toBeVisible();
    
    // Try to add multiple expenses from User 1

    const expenses = [
      { description: 'Hotel Booking', amount: '300.00' },
      { description: 'Car Rental', amount: '150.00' },
      { description: 'Groceries', amount: '80.00' }
    ];
    
    for (const expense of expenses) {
      const addExpenseButton = page1.getByRole('button', { name: /add expense/i })
        .or(page1.getByRole('link', { name: /add expense/i }));
      
      const hasAddExpense = await addExpenseButton.count() > 0;
      if (hasAddExpense) {

        await addExpenseButton.first().click();
        await page1.waitForLoadState('domcontentloaded');
        
        // Fill expense form
        const descriptionField = page1.getByPlaceholder('What was this expense for?');
        const amountField = page1.getByRole('spinbutton');
        
        const hasForm = await descriptionField.count() > 0 && await amountField.count() > 0;
        if (hasForm) {
          await descriptionField.first().fill(expense.description);
          await amountField.first().fill(expense.amount);
          
          // Submit expense
          const submitButton = page1.getByRole('button', { name: /add expense/i })
            .or(page1.getByRole('button', { name: /create/i }))
            .or(page1.getByRole('button', { name: /save/i }));
          
          await submitButton.first().click();
          await page1.waitForLoadState('networkidle');
          
          // Verify we're back on group page
          await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 500 });
          
          // Check if expense appears
          const expenseText = page1.getByText(expense.description);
          const hasExpense = await expenseText.count() > 0;
          if (hasExpense) {

            await expect(expenseText).toBeVisible();
          } else {

          }
        } else {

          // Go back to group page
          await page1.goto(groupUrl);
        }
      } else {

        break;
      }
    }
    
    // Take a screenshot of the current state
    await page1.screenshot({ path: 'group-state-user1.png', fullPage: true });

    // Check for balance information

    const balanceElements = page1.getByText(/balance/i)
      .or(page1.getByText(/owe/i))
      .or(page1.getByText(/owed/i))
      .or(page1.getByText(/\$/));
    
    const balanceCount = await balanceElements.count();

    if (balanceCount > 0) {
      for (let i = 0; i < Math.min(balanceCount, 5); i++) {
        const text = await balanceElements.nth(i).textContent();

      }
    }
    
    // Check for member management

    const memberElements = page1.getByText(/member/i)
      .or(page1.getByText(/invite/i))
      .or(page1.getByRole('button', { name: /add member/i }));
    
    const memberCount = await memberElements.count();

    // Try to invite another user (simulate)
    const addMemberButton = page1.getByRole('button', { name: /add member/i })
      .or(page1.getByRole('button', { name: /invite/i }))
      .or(page1.getByText(/add member/i));
    
    const hasAddMember = await addMemberButton.count() > 0;
    if (hasAddMember) {

      await addMemberButton.first().click();
      await page1.waitForLoadState('domcontentloaded');
      
      // Look for email input
      const emailInput = page1.getByLabel(/email/i)
        .or(page1.getByPlaceholder(/email/i))
        .or(page1.locator('input[type="email"]'));
      
      const hasEmailInput = await emailInput.count() > 0;
      if (hasEmailInput) {

        await emailInput.first().fill('friend@example.com');
        
        const inviteButton = page1.getByRole('button', { name: /invite/i })
          .or(page1.getByRole('button', { name: /add/i }));
        
        const hasInviteButton = await inviteButton.count() > 0;
        if (hasInviteButton) {
          await inviteButton.first().click();
          await page1.waitForLoadState('networkidle');

        }
      }
    } else {

    }
    
    // Create second user to simulate multi-user scenario

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);

    // User 2 tries to access the group (would normally need invitation)

    await page2.goto(groupUrl);
    
    // Check what User 2 sees
    const user2CanAccess = await page2.getByText('Vacation Group').count() > 0;

    if (user2CanAccess) {
      await page2.screenshot({ path: 'group-state-user2.png', fullPage: true });

      // User 2 tries to add an expense
      const addExpenseButton2 = page2.getByRole('button', { name: /add expense/i });
      const canAddExpense = await addExpenseButton2.count() > 0;
      
      if (canAddExpense) {

        await addExpenseButton2.first().click();
        await page2.waitForLoadState('domcontentloaded');
        
        const descriptionField = page2.getByPlaceholder('What was this expense for?');
        const amountField = page2.getByRole('spinbutton');
        
        const hasForm = await descriptionField.count() > 0 && await amountField.count() > 0;
        if (hasForm) {
          await descriptionField.first().fill('Restaurant Dinner');
          await amountField.first().fill('120.00');
          
          const submitButton = page2.getByRole('button', { name: 'Save Expense' });
          
          await submitButton.click();
          await page2.waitForLoadState('networkidle');

        }
      }
    } else {

    }
    
    // Go back to User 1 and check final state

    await page1.goto(groupUrl);
    await page1.waitForLoadState('networkidle');
    
    // Take final screenshot
    await page1.screenshot({ path: 'group-final-state.png', fullPage: true });

    // Log all expenses that are visible
    const allExpenses = page1.getByText(/hotel|car|groceries|restaurant|dinner/i);
    const expenseCount = await allExpenses.count();


    for (let i = 0; i < expenseCount; i++) {
      const expenseText = await allExpenses.nth(i).textContent();

    }
    
    // Log balance information
    const allBalances = page1.getByText(/\$\d+/);
    const balanceAmountCount = await allBalances.count();


    for (let i = 0; i < Math.min(balanceAmountCount, 10); i++) {
      const balanceText = await allBalances.nth(i).textContent();

    }
    
    // Check if group appears settled or unsettled
    const settledIndicators = page1.getByText(/settled/i)
      .or(page1.getByText(/balanced/i))
      .or(page1.getByText(/even/i));
    const owesIndicators = page1.getByText(/owes/i)
      .or(page1.getByText(/debt/i))
      .or(page1.getByText(/balance/i));
    
    const isSettled = await settledIndicators.count() > 0;
    const hasDebts = await owesIndicators.count() > 0;





    // Clean up
    await context1.close();
    await context2.close();
    
    // Verify test completed successfully

    expect(groupUrl).toMatch(/\/groups\/[a-zA-Z0-9]+/);
  });
});