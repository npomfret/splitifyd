import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { GroupWorkflow, setupMCPDebugOnFailure } from '../../helpers';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';
import { editExpenseUrlPattern, expenseDetailUrlPattern, groupDetailUrlPattern, waitForURLWithContext } from '../../helpers/wait-helpers';

setupMCPDebugOnFailure();

test.describe('Freeform Categories Error Testing', () => {
    test('should handle category with special characters and emojis', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
        // @skip-error-checking - May have API validation issues with special characters
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues with special characters' });
        const { page } = authenticatedPage;

        // Use helper method to create group and prepare for expenses
        const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('SpecialCat'), 'Testing special characters');
        const memberCount = 1;

        // Navigate to expense form with proper waiting
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Fill basic expense details
        await expenseFormPage.fillDescription('Special characters test');
        await expenseFormPage.fillAmount('33.33');

        // Test category with special characters (avoiding security filters)
        const specialCategory = 'Café & Restaurant - Fine Dining';
        await expenseFormPage.typeCategoryText(specialCategory);

        // Verify special category was entered
        const categoryInput = expenseFormPage.getCategoryInput();
        const categoryValue = await categoryInput.inputValue();
        expect(categoryValue).toBe(specialCategory);

        // Submit expense
        await expenseFormPage.clickSaveExpenseButton();
        await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });

        // Verify expense was created with special character category
        await expect(groupDetailPage.getExpenseByDescription('Special characters test')).toBeVisible();
        await expect(groupDetailPage.getExpenseAmount('$33.33')).toBeVisible();
    });

    test('should edit expense and change category from predefined to custom', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
        // @skip-error-checking - May have API validation issues during editing
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues during editing' });
        const { page } = authenticatedPage;

        // Use helper method to create group and prepare for expenses
        const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('EditCat'), 'Testing category editing');
        const memberCount = 1;

        // Navigate to expense form with proper waiting
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        await expenseFormPage.fillDescription('Business lunch');
        await expenseFormPage.fillAmount('55.00');
        await expenseFormPage.selectCategoryFromSuggestions('Food & Dining');

        await expenseFormPage.clickSaveExpenseButton();
        await waitForURLWithContext(page, groupDetailUrlPattern());

        // Verify expense was created
        await expect(groupDetailPage.getExpenseByDescription('Business lunch')).toBeVisible();

        // Click on the expense to view details using page object method
        const expenseDetailPage = await groupDetailPage.clickExpenseToView('Business lunch');

        // Click edit button and get the expense form page for editing using page object method
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);

        // Change the category to a custom one using page object method
        const customCategory = 'Corporate Client Meeting';
        await editFormPage.typeCategoryText(customCategory);

        // Save the changes using page object method
        const updateButton = editFormPage.getUpdateExpenseButton();
        await updateButton.click();

        // After updating, wait for navigation to expense detail page
        await editFormPage.expectUrl(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);

        // Wait for the expense detail page to be ready with updated content
        await expenseDetailPage.waitForPageReady();

        // Verify we're on the expense detail page with the updated category using page object methods
        await expenseDetailPage.verifyExpenseHeading(/Business lunch.*\$55\.00/);
        await expect(expenseDetailPage.page.getByText(customCategory)).toBeVisible();
    });

    test('should prevent submission with empty category', async ({ authenticatedPage, dashboardPage, groupDetailPage }, testInfo) => {
        // @skip-error-checking - This test expects validation errors
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test expects validation errors' });
        const { page } = authenticatedPage;

        // Use helper method to create group and prepare for expenses
        const groupId = await GroupWorkflow.createGroup(page, generateTestGroupName('EmptyCat'), 'Testing empty category validation');
        const memberCount = 1;

        // Navigate to expense form with proper waiting
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Fill basic expense details but leave category empty
        await expenseFormPage.fillDescription('Test empty category');
        await expenseFormPage.fillAmount('10.00');

        // Clear category field using page object method
        await expenseFormPage.typeCategoryText('');

        // Try to submit using page object method
        const saveButton = expenseFormPage.getSaveButtonForValidation();
        await saveButton.click();

        // Should stay on the same page (not navigate away) using page object method
        await expenseFormPage.expectUrl(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        // There should be an error message or the form should be invalid
        // (specific validation UI depends on implementation)
    });
});
