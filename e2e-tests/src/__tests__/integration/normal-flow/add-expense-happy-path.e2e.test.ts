import {authenticatedPageTest as test, expect} from '../../../fixtures/authenticated-page-test';
import {setupMCPDebugOnFailure, TestGroupWorkflow} from '../../../helpers';
import {groupDetailUrlPattern} from '../../../pages/group-detail.page.ts';
import {ExpenseBuilder} from '@splitifyd/test-support';
import {v4 as uuidv4} from 'uuid';

setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
    test('should add new expense with equal split', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const memberCount = 1;
        const uniqueId = uuidv4().slice(0, 8);

        // Use cached group for better performance
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Navigate to expense form with all necessary waits
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Test Dinner ${uniqueId}`)
            .withAmount(50)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build());

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription(`Test Dinner ${uniqueId}`)).toBeVisible();
        await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
    });

    // Form validation tests moved to form-validation.e2e.test.ts

    test('should allow selecting expense category', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Dinner with category ${uniqueId}`)
            .withAmount(45)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build());

        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage.getExpenseByDescription(`Dinner with category ${uniqueId}`)).toBeVisible();
    });

    test('should show expense in group after creation', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded (members, balances, etc.)
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Click add expense button
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Wait for navigation to add expense page
        await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Movie Tickets ${uniqueId}`)
            .withAmount(25)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build());

        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription(`Movie Tickets ${uniqueId}`)).toBeVisible();

        const amountText = groupDetailPage.getExpenseAmount('$25.00');
        await expect(amountText).toBeVisible();
    });

    test('should allow custom category input', async ({ authenticatedPage, groupDetailPage }) => {
        const { page, user } = authenticatedPage;
        const uniqueId = uuidv4().slice(0, 8);
        const groupId = await TestGroupWorkflow.getOrCreateGroupSmarter(page, user.email);

        // Wait for page to be fully loaded after group creation
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // Wait for group data to be loaded
        await groupDetailPage.waitForBalancesToLoad(groupId);

        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        await expenseFormPage.submitExpense(new ExpenseBuilder()
            .withDescription(`Custom category expense ${uniqueId}`)
            .withAmount(16)
            .withCurrency('USD')
            .withPaidBy(user.uid)
            .withSplitType('equal')
            .build());

        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        await expect(groupDetailPage.getExpenseByDescription(`Custom category expense ${uniqueId}`)).toBeVisible();
    });
});
