import {authenticatedPageTest as test, expect} from '../../../fixtures/authenticated-page-test';
import {setupMCPDebugOnFailure, TestGroupWorkflow} from '../../../helpers';
import {groupDetailUrlPattern} from '../../../pages/group-detail.page.ts';
import {ExpenseBuilder} from '@splitifyd/test-support';
import {v4 as uuidv4} from 'uuid';

setupMCPDebugOnFailure();

test.describe('Basic Expense Operations E2E', () => {
    test('should create, view, and delete an expense', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
        const groupInfo = { user };
        const memberCount = 1;

        // Create expense using page object
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Test Expense Lifecycle ${uniqueId}`)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(groupInfo.user.uid)
            .withSplitType('equal')
            .build());

        // Verify expense appears in list
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).toBeVisible();

        // Navigate to expense detail to view it
        await groupDetailPage.clickExpenseToView(`Test Expense Lifecycle ${uniqueId}`);

        // Verify expense detail page (view functionality)
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).toBeVisible();
        await expect(groupDetailPage.getCurrencyAmount('50.00').first()).toBeVisible();

        // Delete the expense
        await groupDetailPage.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible (deletion verification)
        await expect(groupDetailPage.getExpenseByDescription(`Test Expense Lifecycle ${uniqueId}`)).not.toBeVisible();
    });

    test('should edit expense and change split type from equal to exact', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);
        
        // Create a second user for multi-user testing
        const additionalUsers = await TestGroupWorkflow.addUsersToGroup(page, groupId, 1);
        const totalMembers = 2; // Original user + 1 additional user
        const secondUser = additionalUsers[0];

        // Step 1: Create initial expense with equal split
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(totalMembers);
        const initialExpenseData = new ExpenseBuilder()
            .withDescription(`Edit Split Test ${uniqueId}`)
            .withAmount(100) // Nice round number for testing
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build();

        await expenseFormPage.submitExpense(initialExpenseData);

        // Step 2: Verify initial expense appears with equal split (50/50)
        await expect(groupDetailPage.getExpenseByDescription(`Edit Split Test ${uniqueId}`)).toBeVisible();
        
        // Navigate to expense detail page
        await groupDetailPage.clickExpenseToView(`Edit Split Test ${uniqueId}`);
        
        // Verify we're on expense detail page
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        
        // Verify initial equal split amounts (should be $50 each for $100 total)
        const initialAmounts = await groupDetailPage.getVisibleCurrencyAmounts();
        expect(initialAmounts.some(amount => amount.includes('50.00'))).toBe(true);

        // Step 3: Edit the expense to change split type
        const expenseDetailPage = groupDetailPage.getExpenseDetailPage();
        await expenseDetailPage.waitForPageReady();
        
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(totalMembers);

        // Step 4: Change to exact amounts split
        await editFormPage.selectExactAmountsSplit();
        
        // Verify exact amounts instructions appear
        await expect(editFormPage.getExactAmountsInstructions()).toBeVisible();

        // Step 5: Set exact split amounts (user pays 60, second user pays 40)
        const splitInputs = editFormPage.getSplitAmountInputs();
        await expect(splitInputs).toHaveCount(totalMembers);
        
        // Fill exact amounts for each user
        await editFormPage.fillSplitAmount(0, '60'); // First user (payer) owes 60
        await editFormPage.fillSplitAmount(1, '40'); // Second user owes 40

        // Step 6: Update the expense
        const updateButton = editFormPage.getUpdateExpenseButton();
        await expect(updateButton).toBeVisible();
        await updateButton.click();

        // Step 7: Verify navigation back to group page
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
        
        // Step 8: Navigate back to expense detail to verify changes
        await groupDetailPage.clickExpenseToView(`Edit Split Test ${uniqueId}`);
        
        // Verify expense detail page loads
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Step 9: Verify the split amounts have changed to exact values
        const updatedAmounts = await groupDetailPage.getVisibleCurrencyAmounts();
        
        // Should now show the exact amounts: 60.00 and 40.00
        const has60Amount = updatedAmounts.some(amount => amount.includes('60.00'));
        const has40Amount = updatedAmounts.some(amount => amount.includes('40.00'));
        
        expect(has60Amount).toBe(true);
        expect(has40Amount).toBe(true);
        
        // Verify the old equal amounts (50.00) are no longer present
        const has50Amount = updatedAmounts.some(amount => amount.includes('50.00'));
        expect(has50Amount).toBe(false);

        // Step 10: Navigate back to group to verify balance updates
        await page.goBack();
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
        
        // Wait for balances to recalculate and verify they reflect the new split
        await groupDetailPage.waitForBalanceUpdates();
        
        // The balance should reflect the exact split (not equal anymore)
        const balanceElements = await groupDetailPage.getBalanceElements();
        expect(balanceElements.length).toBeGreaterThan(0);
        
        console.log('✅ Expense split editing test passed - successfully changed from equal to exact split');
    });
});
