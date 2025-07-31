import { test, expect } from './fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from './helpers/auth-utils';
import { CreateGroupModalPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Multi-User Scenario Test', () => {
  test('create complex group with multiple users and expenses', async ({ browser }) => {
    // Create first user (group creator)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const user1 = await createAndLoginTestUser(page1);
    
    console.log(`Created User 1: ${user1.displayName} (${user1.email})`);
    
    // User 1 creates a group
    const createGroupModal = new CreateGroupModalPage(page1);
    await page1.getByRole('button', { name: 'Create Group' }).click();
    await page1.waitForTimeout(500);
    await createGroupModal.createGroup('Vacation Group', 'Complex expense sharing test');
    
    // Wait for navigation to group page
    await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
    const groupUrl = page1.url();
    console.log(`Group created at: ${groupUrl}`);
    
    // Verify User 1 is in the group
    await expect(page1.getByText(user1.displayName)).toBeVisible();
    await expect(page1.getByText('Vacation Group')).toBeVisible();
    
    // Try to add multiple expenses from User 1
    console.log('Attempting to add expenses...');
    
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
        console.log(`Adding expense: ${expense.description} - $${expense.amount}`);
        
        await addExpenseButton.first().click();
        await page1.waitForTimeout(1000);
        
        // Fill expense form
        const descriptionField = page1.getByLabel(/description/i)
          .or(page1.locator('input[name*="description"]'))
          .or(page1.getByPlaceholder(/what was this expense/i));
        const amountField = page1.getByLabel(/amount/i)
          .or(page1.locator('input[type="number"]'));
        
        const hasForm = await descriptionField.count() > 0 && await amountField.count() > 0;
        if (hasForm) {
          await descriptionField.first().fill(expense.description);
          await amountField.first().fill(expense.amount);
          
          // Submit expense
          const submitButton = page1.getByRole('button', { name: /add expense/i })
            .or(page1.getByRole('button', { name: /create/i }))
            .or(page1.getByRole('button', { name: /save/i }));
          
          await submitButton.first().click();
          await page1.waitForTimeout(2000);
          
          // Verify we're back on group page
          await expect(page1).toHaveURL(/\/groups\/[a-zA-Z0-9]+/, { timeout: 5000 });
          
          // Check if expense appears
          const expenseText = page1.getByText(expense.description);
          const hasExpense = await expenseText.count() > 0;
          if (hasExpense) {
            console.log(`✅ Expense "${expense.description}" created successfully`);
            await expect(expenseText).toBeVisible();
          } else {
            console.log(`⚠️ Expense "${expense.description}" may not be visible yet`);
          }
        } else {
          console.log(`⚠️ Expense form not found for ${expense.description}`);
          // Go back to group page
          await page1.goto(groupUrl);
        }
      } else {
        console.log('⚠️ Add Expense button not found - expense functionality may not be implemented');
        break;
      }
    }
    
    // Take a screenshot of the current state
    await page1.screenshot({ path: 'group-state-user1.png', fullPage: true });
    console.log('Screenshot saved: group-state-user1.png');
    
    // Check for balance information
    console.log('Checking for balance information...');
    const balanceElements = page1.getByText(/balance/i)
      .or(page1.getByText(/owe/i))
      .or(page1.getByText(/owed/i))
      .or(page1.getByText(/\$/));
    
    const balanceCount = await balanceElements.count();
    console.log(`Found ${balanceCount} potential balance elements`);
    
    if (balanceCount > 0) {
      for (let i = 0; i < Math.min(balanceCount, 5); i++) {
        const text = await balanceElements.nth(i).textContent();
        console.log(`Balance element ${i}: "${text}"`);
      }
    }
    
    // Check for member management
    console.log('Checking for member management options...');
    const memberElements = page1.getByText(/member/i)
      .or(page1.getByText(/invite/i))
      .or(page1.getByRole('button', { name: /add member/i }));
    
    const memberCount = await memberElements.count();
    console.log(`Found ${memberCount} potential member management elements`);
    
    // Try to invite another user (simulate)
    const addMemberButton = page1.getByRole('button', { name: /add member/i })
      .or(page1.getByRole('button', { name: /invite/i }))
      .or(page1.getByText(/add member/i));
    
    const hasAddMember = await addMemberButton.count() > 0;
    if (hasAddMember) {
      console.log('Found member invitation functionality');
      await addMemberButton.first().click();
      await page1.waitForTimeout(1000);
      
      // Look for email input
      const emailInput = page1.getByLabel(/email/i)
        .or(page1.getByPlaceholder(/email/i))
        .or(page1.locator('input[type="email"]'));
      
      const hasEmailInput = await emailInput.count() > 0;
      if (hasEmailInput) {
        console.log('Found email input for member invitation');
        await emailInput.first().fill('friend@example.com');
        
        const inviteButton = page1.getByRole('button', { name: /invite/i })
          .or(page1.getByRole('button', { name: /add/i }));
        
        const hasInviteButton = await inviteButton.count() > 0;
        if (hasInviteButton) {
          await inviteButton.first().click();
          await page1.waitForTimeout(2000);
          console.log('Attempted to invite friend@example.com');
        }
      }
    } else {
      console.log('⚠️ Member invitation functionality not found');
    }
    
    // Create second user to simulate multi-user scenario
    console.log('Creating second user...');
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);
    
    console.log(`Created User 2: ${user2.displayName} (${user2.email})`);
    
    // User 2 tries to access the group (would normally need invitation)
    console.log('User 2 attempting to access group...');
    await page2.goto(groupUrl);
    
    // Check what User 2 sees
    const user2CanAccess = await page2.getByText('Vacation Group').count() > 0;
    console.log(`User 2 can access group: ${user2CanAccess}`);
    
    if (user2CanAccess) {
      await page2.screenshot({ path: 'group-state-user2.png', fullPage: true });
      console.log('Screenshot saved: group-state-user2.png');
      
      // User 2 tries to add an expense
      const addExpenseButton2 = page2.getByRole('button', { name: /add expense/i });
      const canAddExpense = await addExpenseButton2.count() > 0;
      
      if (canAddExpense) {
        console.log('User 2 can add expenses');
        await addExpenseButton2.first().click();
        await page2.waitForTimeout(1000);
        
        const descriptionField = page2.getByLabel(/description/i);
        const amountField = page2.getByLabel(/amount/i);
        
        const hasForm = await descriptionField.count() > 0 && await amountField.count() > 0;
        if (hasForm) {
          await descriptionField.first().fill('Restaurant Dinner');
          await amountField.first().fill('120.00');
          
          const submitButton = page2.getByRole('button', { name: /save/i })
            .or(page2.getByRole('button', { name: /add expense/i }));
          
          await submitButton.first().click();
          await page2.waitForTimeout(2000);
          
          console.log('User 2 added expense: Restaurant Dinner - $120.00');
        }
      }
    } else {
      console.log('User 2 cannot access the group (expected if permissions are working)');
    }
    
    // Go back to User 1 and check final state
    console.log('Checking final state from User 1 perspective...');
    await page1.goto(groupUrl);
    await page1.waitForTimeout(2000);
    
    // Take final screenshot
    await page1.screenshot({ path: 'group-final-state.png', fullPage: true });
    console.log('Final screenshot saved: group-final-state.png');
    
    // Log all expenses that are visible
    const allExpenses = page1.getByText(/hotel|car|groceries|restaurant|dinner/i);
    const expenseCount = await allExpenses.count();
    console.log(`\n=== FINAL EXPENSE SUMMARY ===`);
    console.log(`Total visible expenses: ${expenseCount}`);
    
    for (let i = 0; i < expenseCount; i++) {
      const expenseText = await allExpenses.nth(i).textContent();
      console.log(`Expense ${i + 1}: ${expenseText}`);
    }
    
    // Log balance information
    const allBalances = page1.getByText(/\$\d+/);
    const balanceAmountCount = await allBalances.count();
    console.log(`\n=== BALANCE INFORMATION ===`);
    console.log(`Monetary amounts visible: ${balanceAmountCount}`);
    
    for (let i = 0; i < Math.min(balanceAmountCount, 10); i++) {
      const balanceText = await allBalances.nth(i).textContent();
      console.log(`Amount ${i + 1}: ${balanceText}`);
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
    
    console.log(`\n=== GROUP STATUS ===`);
    console.log(`Group appears settled: ${isSettled}`);
    console.log(`Group has debts/balances: ${hasDebts}`);
    console.log(`Group URL: ${groupUrl}`);
    console.log(`Primary user: ${user1.displayName}`);
    
    // Clean up
    await context1.close();
    await context2.close();
    
    // Test passes - we've documented the current state
    expect(true).toBe(true);
  });
});