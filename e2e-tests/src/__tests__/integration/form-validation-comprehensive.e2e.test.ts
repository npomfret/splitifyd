import { expect, simpleTest } from '../../fixtures/simple-test.fixture';
import { generateTestGroupName } from '@splitifyd/test-support';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { groupDetailUrlPattern } from '../../pages/group-detail.page.ts';
/**
 * Expense Form Validation Test Suite
 * Tests comprehensive expense form validation scenarios:
 * - Required fields and negative values
 * - Category input and suggestions
 * - Split validation (exact/percentage)
 * - Special characters and edge cases
 */
simpleTest.describe('Comprehensive Form Validation E2E', () => {
    // Note: Basic authentication form validation (login/register) is tested in auth-and-registration.e2e.test.ts

    simpleTest.describe('Expense Form Basic Validation', () => {
        simpleTest('comprehensive expense form validation scenarios', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('ComprehensiveValidation'), 'Testing comprehensive form validation');
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // === Test 1: Required fields and negative values ===

            // Empty form - submit disabled
            const submitButton = expenseFormPage.getSaveButtonForValidation();
            await expect(submitButton).toBeDisabled();

            // Negative amount validation
            const amountField = expenseFormPage.getAmountInput();
            const minValue = await amountField.getAttribute('min');
            expect(minValue).toBe('0.01');

            // Fill description to enable the button (required field)
            await expenseFormPage.fillDescription('Test description');

            // Try to enter negative amount
            await amountField.fill('-50');

            // Try to submit with negative value
            await submitButton.click();

            // Form should not submit - still on add expense page
            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

            // Browser validation message should exist
            const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
            expect(validationMessage).toBeTruthy();

            // Valid positive amount enables submission
            await expenseFormPage.fillAmount('50');
            await expenseFormPage.fillDescription('Valid expense');

            // Select participants if needed
            await expenseFormPage.selectAllParticipants();

            // Should now be able to submit
            await expect(submitButton).toBeEnabled();

            // === Test 2: Exact split validation ===

            // Reset form for split testing
            await expenseFormPage.fillDescription('Split Test Expense');
            await expenseFormPage.fillAmount('100');

            // Switch to exact amounts using page object method
            await expenseFormPage.selectExactAmountsSplit();

            // Modify split amount to create invalid total using page object method
            await expenseFormPage.fillSplitAmount(0, '60'); // Make total = 160 instead of 100

            // Submit should be disabled when exact amounts don't add up correctly
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeDisabled();

            // === Test 3: Percentage split validation ===

            // Reset form for percentage testing
            await expenseFormPage.fillDescription('Percentage Test Expense');
            await expenseFormPage.fillAmount('200');

            // Switch to percentage using page object method
            await expenseFormPage.selectPercentageSplit();

            // For a single member, percentage split should be valid by default (100%)
            // Submit should remain enabled since all required fields are filled and percentages are valid
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeEnabled();
        });
    });

    simpleTest.describe('Expense Form Category Validation', () => {
        simpleTest('should allow user to select predefined category from suggestions', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();
            const memberCount = 1;

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('PredefinedCat'), 'Testing predefined category selection');
            const groupId = groupDetailPage.inferGroupId();

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details
            await expenseFormPage.fillDescription('Grocery shopping');
            await expenseFormPage.fillAmount('45.99');

            // Test predefined category selection
            const categoryInput = expenseFormPage.getCategoryInput();
            await expect(categoryInput).toBeVisible();
            await categoryInput.focus();

            // Wait for suggestions dropdown to appear
            await page.waitForSelector('[role="listbox"]', { timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });

            // Select "Food & Dining" from suggestions
            await expenseFormPage.selectCategoryFromSuggestions('Food & Dining');

            // Verify category was selected
            const categoryValue = await categoryInput.inputValue();
            expect(categoryValue).toBe('food');

            // Submit expense (handles button enable check and spinner wait)
            await expenseFormPage.clickSaveExpenseButton();

            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify expense was created
            await expect(groupDetailPage.getExpenseByDescription('Grocery shopping')).toBeVisible();
            await expect(groupDetailPage.getExpenseAmount('$45.99')).toBeVisible();
        });

        simpleTest('should allow user to enter custom category text', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();
            const memberCount = 1;

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('CustomCat'), 'Testing custom category input');
            const groupId = groupDetailPage.inferGroupId();

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details
            await expenseFormPage.fillDescription('Team building activity');
            await expenseFormPage.fillAmount('120');

            // Test custom category input
            const customCategory = 'Corporate Team Building';
            await expenseFormPage.typeCategoryText(customCategory);

            // Verify custom category was entered
            const categoryInput = expenseFormPage.getCategoryInput();
            const categoryValue = await categoryInput.inputValue();
            expect(categoryValue).toBe(customCategory);

            // Submit expense (handles button enable check and spinner wait)
            await expenseFormPage.clickSaveExpenseButton();
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify expense was created with custom category
            await expect(groupDetailPage.getExpenseByDescription('Team building activity')).toBeVisible();
            await expect(groupDetailPage.getExpenseAmount('$120.00')).toBeVisible();
        });

        simpleTest('should filter suggestions as user types', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();
            const memberCount = 1;

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('FilterCat'), 'Testing category filtering');

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test filtering by typing
            const categoryInput = expenseFormPage.getCategoryInput();
            await categoryInput.focus();

            // Wait for suggestions to appear
            await page.waitForSelector('[role="listbox"]', { timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });

            // Type "tra" to filter for "Transportation"
            await expenseFormPage.fillPreactInput(categoryInput, 'tra');

            // Check that Transportation suggestion is visible
            const transportSuggestion = expenseFormPage.getCategorySuggestion('Transportation');
            await expect(transportSuggestion).toBeVisible();

            // Check that other suggestions might be filtered out
            // (this is implementation dependent, but we can verify the filtering works)
            const suggestions = await page.locator('[role="option"]').all();
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.length).toBeLessThanOrEqual(9); // Original total categories

            // Select the filtered suggestion
            await transportSuggestion.click();

            // Verify selection
            const categoryValue = await categoryInput.inputValue();
            expect(categoryValue).toBe('transport');
        });

        simpleTest('should support keyboard navigation in suggestions', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();
            const memberCount = 1;

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('KeyboardCat'), 'Testing keyboard navigation');

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test keyboard navigation
            const categoryInput = expenseFormPage.getCategoryInput();
            await categoryInput.focus();

            // Wait for suggestions to appear
            await page.waitForSelector('[role="listbox"]', { timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });

            // Use arrow down to navigate suggestions
            await categoryInput.press('ArrowDown');
            await categoryInput.press('ArrowDown'); // Move to second option

            // Press Enter to select
            await categoryInput.press('Enter');

            // Verify a category was selected (just check it's not empty and has a reasonable value)
            const categoryValue = await categoryInput.inputValue();
            expect(categoryValue).toBeTruthy(); // Has a value
            expect(categoryValue.length).toBeGreaterThan(0); // Not empty
            expect(categoryValue).not.toBe(''); // Explicitly not empty string

            // The exact category doesn't matter - the system may add new categories over time
            // We just care that keyboard navigation worked and selected something
        });

        simpleTest('should handle category with special characters', async ({ newLoggedInBrowser }, testInfo) => {
            // @skip-error-checking - May have API validation issues with special characters
            testInfo.annotations.push({ type: 'skip-error-checking', description: 'May have API validation issues with special characters' });
            const { page, dashboardPage } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('SpecialCat'), 'Testing special characters');
            const groupId = groupDetailPage.inferGroupId();
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
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

            // Verify expense was created with special character category
            await expect(groupDetailPage.getExpenseByDescription('Special characters test')).toBeVisible();
            await expect(groupDetailPage.getExpenseAmount('$33.33')).toBeVisible();
        });
    });
});
