import {expect, simpleTest as test} from '../../fixtures/simple-test.fixture';
import {generateShortId, generateTestGroupName} from '@splitifyd/test-support';
import {groupDetailUrlPattern} from '../../pages/group-detail.page';
import {ExpenseFormDataBuilder} from '../../pages/expense-form.page';
import {DashboardPage} from "../../pages";

test.describe('Expense Form Operations E2E', () => {

    let groupId: string | undefined;
    const groupName = `Expense form test ${generateShortId()}`;
    const memberCount = 1;

    async function navigateToGroupDetailPage(dashboardPage: DashboardPage) {
        // only create 1 group for all test cases
        // this assumes the test uses the same user in each test case
        if(groupId) {
            await dashboardPage.navigate();
            await dashboardPage.waitForGroupToAppear(groupId);// this will fail if we some how use a different user
            return await dashboardPage.clickGroupCard(groupName, groupId);
        }

        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Testing expense form');
        groupId = groupDetailPage.inferGroupId();
        return groupDetailPage;
    }

    test('should validate negative amounts', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test negative amount validation
        await expenseFormPage.fillAmount('-50');
        const submitButton = expenseFormPage.getSaveButtonForValidation();

        // Wait for button to become disabled due to negative amount validation
        await expect(submitButton).toBeDisabled({ timeout: 2000 });

        // Should stay on form due to validation
        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);
    });

    test('should select category from suggestions', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test category selection functionality
        await expenseFormPage.fillDescription('Test with category');
        await expenseFormPage.fillAmount('25');

        const categoryInput = expenseFormPage.getCategoryInput();
        await categoryInput.focus();

        // Select predefined category
        await expenseFormPage.selectCategoryFromSuggestions('Food & Dining');
        const categoryValue = await categoryInput.inputValue();
        expect(categoryValue).toBe('food');
    });

    test('should create expense successfully', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const expenseDescription = `Create Test ${generateShortId()}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .withParticipants([userDisplayName])
                .build(),
        );

        await groupDetailPage.waitForExpense(expenseDescription);
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
    });

    test('should edit expense with multiple fields', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const originalDescription = `Edit Test ${generateShortId()}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(originalDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await groupDetailPage.waitForExpense(originalDescription);

        // Navigate to expense detail and edit
        const expenseDetailPage = await groupDetailPage.clickExpenseToView(originalDescription);
        const editFormPage = await expenseDetailPage.clickEditExpenseButton(memberCount);

        // Edit multiple fields
        const updatedDescription = `Updated Edit Test ${generateShortId()}`;
        await editFormPage.fillDescription(updatedDescription);
        await editFormPage.fillAmount('75');

        // Test category change
        const categoryInput = editFormPage.getCategoryInput();
        await categoryInput.focus();
        await editFormPage.selectCategoryFromSuggestions('Food & Dining');

        // Test date change to yesterday
        await editFormPage.clickYesterdayButton();

        await editFormPage.getUpdateExpenseButton().click();

        await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
        await expenseDetailPage.waitForPageReady();

        // Verify all changes
        await expect(expenseDetailPage.getExpenseByDescription(updatedDescription)).toBeVisible();
        await expect(expenseDetailPage.getCurrencyAmount('75.00')).toBeVisible();
    });

    test('should delete expense', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage } = await newLoggedInBrowser();

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        const expenseDescription = `Delete Test ${generateShortId()}`;

        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(50)
                .withCurrency('USD')
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await groupDetailPage.waitForExpense(expenseDescription);

        // Navigate to expense detail and delete
        await groupDetailPage.clickExpenseToView(expenseDescription);
        await groupDetailPage.deleteExpense();

        // Should redirect back to group
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        // Expense should no longer be visible
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).not.toBeVisible();
    });

    test('should switch split types (equal, exact, percentage)', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test each split type selection
        await expenseFormPage.selectExactAmountsSplit();
        await expect(expenseFormPage.getExactAmountsText()).toBeVisible();

        await expenseFormPage.selectPercentageSplit();
        await expect(expenseFormPage.getPercentageText()).toBeVisible();

        // Switch back to equal (default)
        const equalRadio = expenseFormPage.page.getByText('Equal', { exact: true });
        await equalRadio.click();
    });

    test('should use date convenience buttons', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test "Today" button
        await expenseFormPage.clickTodayButton();
        const todayDate = new Date().toISOString().split('T')[0];
        await expect(expenseFormPage.getDateInput()).toHaveValue(todayDate);

        // Test "Yesterday" button
        await expenseFormPage.clickYesterdayButton();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate = yesterday.toISOString().split('T')[0];
        await expect(expenseFormPage.getDateInput()).toHaveValue(yesterdayDate);

        // Test "This Morning" button - sets time to 09:00, should show time button
        await expenseFormPage.clickThisMorningButton();
        // Wait a moment for the component to update after time is set
        await expect(expenseFormPage.getTimeButton()).toBeVisible({ timeout: 3000 });

        // Test "Last Night" button - sets time to 20:00, should show time button
        await expenseFormPage.clickLastNightButton();
        await expect(expenseFormPage.getTimeButton()).toBeVisible();
    });

    test('should toggle time field with clock icon', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Initially time field should be hidden (default noon)
        await expect(expenseFormPage.getTimeInput()).not.toBeVisible();
        await expect(expenseFormPage.getTimeButton()).not.toBeVisible();

        // Click clock icon to show time field - this sets current time and shows time button
        await expenseFormPage.clickClockIcon();

        // After clicking clock icon, time button should be visible (showing "at HH:MM AM/PM")
        await expect(expenseFormPage.getTimeButton()).toBeVisible();
    });

    test('should validate required fields', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Try to submit empty form
        const submitButton = expenseFormPage.getSaveButtonForValidation();

        // Should be disabled initially with empty required fields
        await expect(submitButton).toBeDisabled();

        // Fill description but leave amount empty
        await expenseFormPage.fillDescription('Test expense');
        await expect(submitButton).toBeDisabled();

        // Add amount - should enable submit
        await expenseFormPage.fillAmount('50');
        await expect(submitButton).toBeEnabled({ timeout: 2000 });
    });

    test('should select and deselect participants', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test "Select all" button
        await expenseFormPage.clickSelectAllButton();
        const checkboxes = expenseFormPage.page.locator('input[type="checkbox"]');
        await expect(checkboxes.first()).toBeChecked();

        // Test "Select none" button - but note that payer checkbox will remain checked and disabled
        const selectNoneButton = expenseFormPage.page.getByRole('button', { name: 'Select none' });
        await selectNoneButton.click();

        // The first checkbox (payer) should remain checked because it's disabled (payer must be included)
        await expect(checkboxes.first()).toBeChecked();
        await expect(checkboxes.first()).toBeDisabled();
    });

    test('should validate zero amount', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test zero amount validation
        await expenseFormPage.fillAmount('0');
        const submitButton = expenseFormPage.getSaveButtonForValidation();
        await expect(submitButton).toBeDisabled({ timeout: 2000 });
    });

    test('should change currency selection', async ({ newLoggedInBrowser }) => {
        const { dashboardPage } = await newLoggedInBrowser();

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();

        const groupDetailPage = await navigateToGroupDetailPage(dashboardPage);
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

        // Test currency selection in form submission
        await expenseFormPage.fillDescription('Currency test');
        await expenseFormPage.fillAmount('25');

        const expenseDescription = `Currency Test ${generateShortId()}`;
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(25)
                .withCurrency('EUR') // Different currency
                .withPaidByDisplayName(userDisplayName)
                .withSplitType('equal')
                .build(),
        );

        await groupDetailPage.waitForExpense(expenseDescription);
        await expect(groupDetailPage.getExpenseByDescription(expenseDescription)).toBeVisible();
    });
});
