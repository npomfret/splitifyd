import { expect, simpleTest } from '../../fixtures/simple-test.fixture';
import { generateTestGroupName } from '@splitifyd/test-support';
/**
 * Expense Form Validation Test Suite
 * Tests unique expense form validation scenarios:
 * - Required fields and negative values
 * - Exact split amount validation
 * - Percentage split validation
 */
simpleTest.describe('Comprehensive Form Validation E2E', () => {
    // Note: Basic authentication form validation (login/register) is tested in auth-and-registration.e2e.test.ts

    simpleTest.describe('Expense Form Validation', () => {
        simpleTest('Expense form required fields and negative values', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('Validation'), 'Testing form validation');
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test 1: Empty form - submit disabled
            const submitButton = expenseFormPage.getSaveButtonForValidation();
            await expect(submitButton).toBeDisabled();

            // Test 2: Negative amount validation
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

            // Test 3: Valid positive amount enables submission
            await expenseFormPage.fillAmount('50');
            await expenseFormPage.fillDescription('Valid expense');

            // Select participants if needed
            await expenseFormPage.selectAllParticipants();

            // Should now be able to submit
            await expect(submitButton).toBeEnabled();
        });

        simpleTest('Exact split validation', async ({ newLoggedInBrowser }) => {
            const { dashboardPage } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('ExactSplit'), 'Testing exact split validation');
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Split Test Expense');
            await expenseFormPage.fillAmount('100');

            // Switch to exact amounts using page object method
            await expenseFormPage.selectExactAmountsSplit();

            // Modify split amount to create invalid total using page object method
            await expenseFormPage.fillSplitAmount(0, '60'); // Make total = 160 instead of 100

            // Submit should be disabled when exact amounts don't add up correctly
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeDisabled();
        });

        simpleTest('Percentage split validation', async ({ newLoggedInBrowser }) => {
            const { dashboardPage } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('PercentSplit'), 'Testing percentage split validation');
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Percentage Test Expense');
            await expenseFormPage.fillAmount('200');

            // Switch to percentage using page object method
            await expenseFormPage.selectPercentageSplit();

            // For a single member, percentage split should be valid by default (100%)
            // Submit should remain enabled since all required fields are filled and percentages are valid
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeEnabled();
        });
    });
});
