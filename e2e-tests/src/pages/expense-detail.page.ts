import { expect, Page } from '@playwright/test';
import { ExpenseDetailPage as BaseExpenseDetailPage } from '@splitifyd/test-support';
import { ExpenseFormPage } from './expense-form.page';

/**
 * E2E-specific ExpenseDetailPage extending shared base class.
 * Adds comprehensive page loading verification and cross-POM navigation.
 */
export class ExpenseDetailPage extends BaseExpenseDetailPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * Wait for the expense detail page to be fully loaded
     * E2E-specific: Comprehensive loading checks for multi-user scenarios
     */
    async waitForPageReady(): Promise<void> {
        // Wait for URL pattern to match expense detail
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+$/);
        await this.waitForDomContentLoaded();

        // Wait for expense heading to be visible
        const expenseHeading = this.page.getByRole('heading', { level: 1 }).first();
        await expect(expenseHeading).toBeVisible();
    }

    /**
     * Click the edit expense button and return the expense form page for editing
     * E2E-specific: Returns ExpenseFormPage for cross-POM navigation
     */
    async clickEditExpenseButton(expectedUsers: string[]): Promise<ExpenseFormPage> {
        const editButton = this.getEditButton();
        await this.clickButton(editButton, { buttonName: 'Edit Expense' });

        // Wait for navigation to edit expense page
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense\?.*edit=true/);
        await this.waitForDomContentLoaded();

        // Create and validate the expense form page in edit mode
        const expenseFormPage = new ExpenseFormPage(this.page);
        await expenseFormPage.waitForFormReady(expectedUsers);

        return expenseFormPage;
    }

    /**
     * Click the copy expense button and return the expense form page for copying
     * E2E-specific: Returns ExpenseFormPage for cross-POM navigation
     */
    async clickCopyExpenseButton(expectedUsers: string[]): Promise<ExpenseFormPage> {
        const copyButton = this.getCopyButton();
        await this.clickButton(copyButton, { buttonName: 'Copy Expense' });

        // Wait for navigation to copy expense page
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense\?.*copy=true.*sourceId=/);
        await this.waitForDomContentLoaded();

        // Create and validate the expense form page in copy mode
        const expenseFormPage = new ExpenseFormPage(this.page);
        await expenseFormPage.waitForFormReady(expectedUsers);

        return expenseFormPage;
    }

    // All other methods (getters, addComment, deleteExpense, verifyCommentsSection,
    // waitForCommentToAppear, waitForCommentCount, waitForExpenseDescription,
    // waitForCurrencyAmount, verifyLockWarningBanner, verifyEditButtonDisabled,
    // verifyEditButtonTooltip) are inherited from base class
}
