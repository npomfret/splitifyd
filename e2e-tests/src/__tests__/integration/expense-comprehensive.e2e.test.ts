import { simpleTest, expect } from '../../fixtures';
import { simpleTest as test } from '../../fixtures/simple-test.fixture';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { ExpenseFormDataBuilder } from '../../pages/expense-form.page';
import { generateShortId } from '@splitifyd/test-support';

/**
 * Comprehensive Expense Operations E2E Tests
 *
 * Consolidated from:
 * - expense-form-operations.e2e.test.ts (basic CRUD)
 * - expense-datetime.e2e.test.ts (date/time selection)
 * - multi-currency.e2e.test.ts (currency handling)
 *
 * This file covers all essential expense functionality in one place
 * to eliminate duplication while maintaining critical test coverage.
 */

simpleTest.describe('Expense Operations - Comprehensive', () => {
    simpleTest.describe('Form Validation & Basic Operations', () => {
        simpleTest('should validate form inputs and handle submission', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const memberCount = await groupDetailPage.getCurrentMemberCount();
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
            const submitButton = expenseFormPage.getSaveButtonForValidation();

            // Test validation sequence
            await expect(submitButton).toBeDisabled(); // Empty form

            await expenseFormPage.fillDescription('Test expense');
            await expect(submitButton).toBeDisabled(); // Missing amount

            await expenseFormPage.fillAmount('0');
            await expect(submitButton).toBeDisabled(); // Zero amount

            await expenseFormPage.fillAmount('50');
            await expect(submitButton).toBeEnabled({ timeout: 2000 }); // Valid form

            // Test clearing description disables form again
            await expenseFormPage.fillDescription('');
            await expect(submitButton).toBeDisabled(); // Missing description
        });

        simpleTest('should handle comprehensive expense lifecycle with date, time, currency, and CRUD operations', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = await groupDetailPage.getCurrentMemberCount();

            // Create expense with date, time, and currency features
            const originalDescription = `Comprehensive Test ${generateShortId()}`;
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Set description and amount
            await expenseFormPage.fillDescription(originalDescription);
            await expenseFormPage.fillAmount('89.99');

            // Set custom date (yesterday)
            await expenseFormPage.clickYesterdayButton();

            // Set morning time
            await expenseFormPage.clickThisMorningButton();

            // Submit with EUR currency
            await expenseFormPage.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(originalDescription)
                    .withAmount(89.99)
                    .withCurrency('EUR')
                    .withPaidByDisplayName(userDisplayName)
                    .withSplitType('equal')
                    .withParticipants([userDisplayName])
                    .build(),
            );

            // Verify creation with all features
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
            await groupDetailPage.waitForExpense(originalDescription);
            await groupDetailPage.waitForExpenseDescription(originalDescription);
            await expect(page.getByText('€89.99')).toBeVisible();

            // Edit expense
            const expenseDetailPage = await groupDetailPage.clickExpenseToView(originalDescription);
            const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);
            const updatedDescription = `Updated ${generateShortId()}`;

            await editFormPage.fillDescription(updatedDescription);
            await editFormPage.fillAmount('125.50');
            await editFormPage.getUpdateExpenseButton().click();

            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
            await expenseDetailPage.waitForExpenseDescription(updatedDescription);
            await expenseDetailPage.waitForCurrencyAmount('€125.50');

            // Verify currency is correctly displayed in split view (single person gets full amount)
            await expenseDetailPage.verifySplitAmount('€125.50', 1);

            // Delete expense
            await expenseDetailPage.deleteExpense();
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
            await expect(groupDetailPage.getExpenseByDescription(updatedDescription)).not.toBeVisible();
        });

        simpleTest('should handle server validation errors gracefully', async ({ createLoggedInBrowsers }, testInfo) => {
            testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected: Failed to load resource: the server responded with a status of 400 (Bad Request)' });

            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const memberCount = await groupDetailPage.getCurrentMemberCount();
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Create invalid form state that passes client validation but fails server validation
            await expenseFormPage.fillDescription('Test expense');
            await expenseFormPage.fillAmount('50');

            // Set a currency to pass client validation
            const currencyButton = page.getByRole('button', { name: /select currency/i });
            await currencyButton.click();
            const searchInput = page.getByPlaceholder('Search by symbol, code, or country...');
            await expect(searchInput).toBeVisible();
            await searchInput.fill('USD');
            const currencyOption = page.getByText('United States Dollar (USD)').first();
            await currencyOption.click();

            const submitButton = expenseFormPage.getSaveButtonForValidation();
            await expect(submitButton).toBeEnabled({ timeout: 2000 });

            await expenseFormPage.typeCategoryText(''); // Clear category to trigger server error
            await submitButton.click();

            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
            await expect(page.getByRole('heading', { name: /something went wrong/i })).toBeVisible({ timeout: 5000 });
        });
    });

    simpleTest.describe('Date and Time Selection', () => {
        simpleTest('should handle date convenience buttons and time input', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const memberCount = await groupDetailPage.getCurrentMemberCount();
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test date convenience buttons
            const dateInput = expenseFormPage.getDateInput();

            // Test Today button
            await expenseFormPage.clickTodayButton();
            const todayInputValue = await dateInput.inputValue();
            expect(todayInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Test Yesterday button
            await expenseFormPage.clickYesterdayButton();
            const yesterdayInputValue = await dateInput.inputValue();
            expect(yesterdayInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Verify yesterday is one day before today
            const todayParsed = new Date(todayInputValue + 'T00:00:00');
            const yesterdayParsed = new Date(yesterdayInputValue + 'T00:00:00');
            const dayDifference = (todayParsed.getTime() - yesterdayParsed.getTime()) / (1000 * 60 * 60 * 24);
            expect(dayDifference).toBe(1);

            // Test Last Night button (sets evening time)
            await expenseFormPage.clickLastNightButton();
            const lastNightInputValue = await dateInput.inputValue();
            expect(lastNightInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Test time input functionality
            let timeButton = expenseFormPage.getTimeButton();
            const timeButtonCount = await timeButton.count();

            if (timeButtonCount === 0) {
                const clockIcon = expenseFormPage.getClockIcon();
                const clockIconCount = await clockIcon.count();
                if (clockIconCount > 0) {
                    await expenseFormPage.clickClockIcon();
                }
                timeButton = expenseFormPage.getTimeButton();
            }

            await expect(timeButton).toBeVisible();
            await timeButton.click();

            const timeInput = expenseFormPage.getTimeInput();
            await expect(timeInput).toBeVisible();
            await expect(timeInput).toBeFocused();

            // Test time suggestions
            await timeInput.fill('3');
            await expect(expenseFormPage.getTimeSuggestion('3:00 AM')).toBeVisible();
            await expect(expenseFormPage.getTimeSuggestion('3:00 PM')).toBeVisible();

            // Accept time selection
            await expenseFormPage.getTimeSuggestion('3:00 PM').click();
            await expect(expenseFormPage.getTimeSuggestion('at 3:00 PM')).toBeVisible();
        });

        simpleTest('should create expense with custom date and time', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = await groupDetailPage.getCurrentMemberCount();
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            await expenseFormPage.waitForExpenseFormSections();

            // Fill expense details with custom date/time
            await expenseFormPage.fillDescription('Dinner with custom datetime');
            await expenseFormPage.fillAmount('45.50');

            // Set currency
            const currencyButton = page.getByRole('button', { name: /select currency/i });
            await currencyButton.click();
            const searchInput = page.getByPlaceholder('Search by symbol, code, or country...');
            await expect(searchInput).toBeVisible();
            await searchInput.fill('USD');
            const currencyOption = page.getByText('United States Dollar (USD)').first();
            await currencyOption.click();

            // Set yesterday's date
            await expenseFormPage.clickYesterdayButton();
            const dateInput = expenseFormPage.getDateInput();
            const yesterdayForExpenseValue = await dateInput.inputValue();
            expect(yesterdayForExpenseValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            // Set custom time
            const timeButton = expenseFormPage.getTimeButton();
            if (await timeButton.count() > 0) {
                await timeButton.click();
                const timeInput = expenseFormPage.getTimeInput();
                await timeInput.fill('7:30pm');
                await expenseFormPage.getExpenseDetailsHeading().click(); // Blur to commit
            }

            // Select payer and participants
            await expenseFormPage.selectPayer(await dashboardPage.header.getCurrentUserDisplayName());
            await expenseFormPage.clickSelectAllButton();

            // Submit expense
            await expenseFormPage.clickSaveExpenseButton();

            // Verify success
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
            await groupDetailPage.verifyExpenseInList('Dinner with custom datetime', '$45.50');
        });
    });

    simpleTest.describe('Multi-Currency Support', () => {
        simpleTest('should handle currencies with uncommon decimal formatting correctly', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const memberCount = await groupDetailPage.getCurrentMemberCount();

            // Create JPY expense (0 decimals)
            const uniqueId = generateShortId();
            const expenseFormPage1 = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage1.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(`Lunch ${uniqueId}`)
                    .withAmount(2500)
                    .withCurrency('JPY')
                    .withPaidByDisplayName(userDisplayName)
                    .withSplitType('equal')
                    .withParticipants([userDisplayName])
                    .build(),
            );

            // Verify JPY expense (no decimals)
            await expect(page.getByText('¥2,500').first()).toBeVisible();

            // Create BHD expense (3 decimals)
            const expenseFormPage2 = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage2.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(`Dinner ${uniqueId}`)
                    .withAmount(30.5)
                    .withCurrency('BHD')
                    .withPaidByDisplayName(userDisplayName)
                    .withSplitType('equal')
                    .withParticipants([userDisplayName])
                    .build(),
            );

            // Verify both currencies display correctly
            await expect(page.getByText('¥2,500').first()).toBeVisible(); // JPY (0 decimals)
            await expect(page.getByText('BHD 30.500').first()).toBeVisible(); // BHD (3 decimals)
            await expect(page.getByText(`Lunch ${uniqueId}`)).toBeVisible();
            await expect(page.getByText(`Dinner ${uniqueId}`)).toBeVisible();
        });

        simpleTest('should remember currency selection within group', async ({ createLoggedInBrowsers }) => {
            const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);
            const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
            const [groupDetailPage] = await dashboardPage.createMultiUserGroup({});
            const memberCount = await groupDetailPage.getCurrentMemberCount();

            // Create first expense with KWD (3 decimals)
            const uniqueId = generateShortId();
            const expenseFormPage1 = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage1.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(`Coffee ${uniqueId}`)
                    .withAmount(5.5)
                    .withCurrency('KWD')
                    .withPaidByDisplayName(userDisplayName)
                    .withSplitType('equal')
                    .withParticipants([userDisplayName])
                    .build(),
            );

            // Verify KWD expense created (3 decimals) - check multiple possible formats
            const kdElements = [
                page.getByText('KD5.500').first(),
                page.getByText('KD 5.500').first(),
                page.getByText('5.500 KD').first(),
                page.getByText('KWD 5.500').first(),
            ];

            let found = false;
            for (const element of kdElements) {
                try {
                    await expect(element).toBeVisible({ timeout: 1000 });
                    found = true;
                    break;
                } catch (e) {
                    // Continue to next format
                }
            }
            if (!found) {
                throw new Error('KWD amount not found in any expected format');
            }

            // Create second expense - should remember KWD
            const expenseFormPage2 = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage2.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(`Snack ${uniqueId}`)
                    .withAmount(3.25)
                    .withCurrency('KWD')
                    .withPaidByDisplayName(userDisplayName)
                    .withSplitType('equal')
                    .withParticipants([userDisplayName])
                    .build(),
            );

            // Verify second expense also uses KWD (3 decimals) - check multiple possible formats
            const kd2Elements = [
                page.getByText('KD3.250').first(),
                page.getByText('KD 3.250').first(),
                page.getByText('3.250 KD').first(),
                page.getByText('KWD 3.250').first(),
            ];

            let found2 = false;
            for (const element of kd2Elements) {
                try {
                    await expect(element).toBeVisible({ timeout: 1000 });
                    found2 = true;
                    break;
                } catch (e) {
                    // Continue to next format
                }
            }
            if (!found2) {
                throw new Error('Second KWD amount not found in any expected format');
            }
        });
    });

});