import { ExpenseDetailPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';

test.describe('Expense Detail Page Object', () => {
    test('should have all required element getters', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Verify all getter methods exist and return Locators
        expect(expenseDetailPage.getEditButton()).toBeTruthy();
        expect(expenseDetailPage.getCopyButton()).toBeTruthy();
        expect(expenseDetailPage.getDeleteButton()).toBeTruthy();
        expect(expenseDetailPage.getDiscussionSection()).toBeTruthy();
        expect(expenseDetailPage.getCommentInput()).toBeTruthy();
        expect(expenseDetailPage.getSendCommentButton()).toBeTruthy();
        expect(expenseDetailPage.getCommentItems()).toBeTruthy();
        expect(expenseDetailPage.getLockWarningBanner()).toBeTruthy();
        expect(expenseDetailPage.getConfirmationDialog()).toBeTruthy();
        expect(expenseDetailPage.getExpenseAmountElement()).toBeTruthy();
    });

    test('should have getCommentByText method', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Verify method exists and returns a Locator
        const commentLocator = expenseDetailPage.getCommentByText('test comment');
        expect(commentLocator).toBeTruthy();
    });

    test('should have navigate method', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Just verify the method exists (don't actually navigate without mocks)
        expect(typeof expenseDetailPage.navigate).toBe('function');
    });

    test('should have comment-related action methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Verify action methods exist
        expect(typeof expenseDetailPage.addComment).toBe('function');
        expect(typeof expenseDetailPage.waitForCommentToAppear).toBe('function');
        expect(typeof expenseDetailPage.waitForCommentCount).toBe('function');
        expect(typeof expenseDetailPage.verifyCommentsSection).toBe('function');
    });

    test('should have expense data methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Verify expense data methods exist
        expect(typeof expenseDetailPage.getCurrentExpenseDescription).toBe('function');
        expect(typeof expenseDetailPage.getCurrentCurrencyAmount).toBe('function');
        expect(typeof expenseDetailPage.waitForExpenseDescription).toBe('function');
        expect(typeof expenseDetailPage.waitForCurrencyAmount).toBe('function');
    });

    test('should have delete and lock-related methods', async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;
        const expenseDetailPage = new ExpenseDetailPage(page);

        // Verify delete and lock methods exist
        expect(typeof expenseDetailPage.deleteExpense).toBe('function');
        expect(typeof expenseDetailPage.verifyLockWarningBanner).toBe('function');
        expect(typeof expenseDetailPage.verifyEditButtonDisabled).toBe('function');
        expect(typeof expenseDetailPage.verifyEditButtonTooltip).toBe('function');
    });
});
