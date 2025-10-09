import { expect, Locator, Page } from '@playwright/test';
import { ExpenseFormData } from '@splitifyd/test-support';
import { FORM_LABELS } from '../constants/selectors';
import { BasePage } from './base.page';
import { groupDetailUrlPattern } from './group-detail.page.ts';

export class ExpenseFormPage extends BasePage {
    readonly url = '/groups/[id]/add-expense';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Waits for the expense form to be fully ready with all members loaded.
     * This is called automatically by clickAddExpenseButton() so forms are always ready.
     * Note: Loading spinner check is handled in clickAddExpenseButton() before this method is called.
     * @param expectedMemberNames - The expected display names of members in the group
     */
    async waitForFormReady(expectedMemberNames: string[]): Promise<void> {
        const currentUrl = this.page.url();
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;

        // Enhanced URL check with better error reporting
        if (!currentUrl.match(expectedUrlPattern)) {
            throw new Error(`Expense form URL validation failed - navigation to expense form likely failed. Expected pattern: /groups/[id]/add-expense, got: ${currentUrl}`);
        }

        // Step 0: Ensure page is fully loaded and not in loading state
        await this.waitForDomContentLoaded();

        // Wait for title to change from "Loading..." to actual page title
        await expect(async () => {
            const title = await this.page.title();
            if (title.includes('Loading...')) {
                throw new Error(`Page still loading: ${title}`);
            }
        })
            .toPass({ timeout: 5000, intervals: [100, 250, 500] });

        // Step 1: Wait for basic page layout elements to be visible
        // Check for the expense form header
        const headerTitle = this.page.getByRole('heading', {
            name: /Add Expense|Edit Expense|Copy Expense/i,
        });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });

        // Check for Cancel button in header (confirms header is fully rendered)
        // Use .first() since there might be multiple Cancel buttons (header and form)
        const cancelButton = this.page.getByRole('button', { name: 'Cancel' }).first();
        await expect(cancelButton).toBeVisible();

        // Step 2: Wait for main form container to be present
        const formElement = this.page.locator('form');
        await expect(formElement).toBeVisible();

        // Step 3: Wait for form section headings to be visible
        await this.waitForExpenseFormSections();

        // Step 4: Wait for specific form inputs to be ready
        await expect(this.getExpenseDescriptionField()).toBeVisible();

        // Step 5: Wait for ALL members to load in form sections
        await this.waitForMembersInExpenseForm(expectedMemberNames);
    }

    /**
     * Wait for all main form sections to be visible
     */
    async waitForExpenseFormSections(): Promise<void> {
        await expect(this.page.getByText(FORM_LABELS.DESCRIPTION)).toBeVisible();
        // Use specific role-based selector for amount input to avoid conflict with "Exact amounts" radio
        await expect(this.page.getByRole('spinbutton', { name: /Amount\*/i })).toBeVisible();
        await expect(this.page.getByText(FORM_LABELS.WHO_PAID)).toBeVisible();
        await expect(this.page.getByText(FORM_LABELS.SPLIT_BETWEEN)).toBeVisible();
    }

    /**
     * Wait for ALL members to load in the expense form
     * This prevents the intermittent issue where members don't appear and ensures ALL group members are represented
     */
    private async waitForMembersInExpenseForm(expectedMemberNames: string[], timeout = 5000): Promise<void> {
        // Wait for ALL members to appear in the "Who paid?" section
        await expect(async () => {
            const missingMembers = [];
            for (const memberName of expectedMemberNames) {
                const memberRadio = this.page.getByRole('radio', { name: memberName });
                const isVisible = await memberRadio.isVisible();
                if (!isVisible) {
                    missingMembers.push(memberName);
                }
            }
            if (missingMembers.length > 0) {
                throw new Error(`Members not loaded in "Who paid?" section: ${missingMembers.join(', ')} - waiting for all members data`);
            }
        })
            .toPass({
                timeout,
                intervals: [100, 250, 500, 2000],
            });

        // Wait for ALL members to appear in "Split between" section
        await expect(async () => {
            const missingMembers = [];
            for (const memberName of expectedMemberNames) {
                const memberCheckbox = this.page.getByRole('checkbox', { name: memberName });
                const isVisible = await memberCheckbox.isVisible();
                if (!isVisible) {
                    missingMembers.push(memberName);
                }
            }
            if (missingMembers.length > 0) {
                throw new Error(`Members not loaded in "Split between" section: ${missingMembers.join(', ')} - waiting for all members data`);
            }
        })
            .toPass({
                timeout,
                intervals: [100, 250, 500, 2000],
            });
    }

    // Form field locators
    getExpenseDescriptionField(): Locator {
        return this.page.getByPlaceholder('What was this expense for?');
    }

    getAmountInput(): Locator {
        return this.page.locator('input[type="number"]').first();
    }

    getDescriptionInput(): Locator {
        return this.page.getByPlaceholder('What was this expense for?');
    }

    private getSaveExpenseButton(): Locator {
        return this.page.getByRole('button', { name: /save expense/i });
    }

    getUpdateExpenseButton(): Locator {
        return this.page.getByRole('button', { name: /update expense/i });
    }

    // Split type controls
    getExactAmountsText(): Locator {
        return this.page.getByText('Exact amounts');
    }

    getSelectAllButton(): Locator {
        return this.page.getByRole('button', { name: 'Select all' });
    }

    // Form actions
    async fillDescription(description: string): Promise<void> {
        await this.fillPreactInput(this.getDescriptionInput(), description);
    }

    async fillAmount(amount: string): Promise<void> {
        await this.fillNumberInput(this.getAmountInput(), amount);
    }

    async selectAllParticipants(): Promise<void> {
        await this.getSelectAllButton().click();
    }

    async selectSpecificParticipants(participants: string[]): Promise<void> {
        // Wait for participant selector and get all labels
        const allLabels = this.page.locator('[data-testid="participant-selector-grid"]').locator('label');
        await allLabels.first().waitFor();

        // Collect all available participant labels for better error messages
        const count = await allLabels.count();
        const availableParticipants: string[] = [];
        const foundParticipants: string[] = [];

        for (let i = 0; i < count; i++) {
            const label = allLabels.nth(i);
            const checkbox = label.locator('input[type="checkbox"]');
            const text = await label.textContent();

            if (text) {
                availableParticipants.push(text.trim());
            }

            const shouldBeChecked = participants.some((p) => text?.includes(p));
            if (shouldBeChecked && text) {
                foundParticipants.push(text.trim());
            }

            const isChecked = await checkbox.isChecked();

            if (shouldBeChecked !== isChecked) {
                await label.click();
                await expect(checkbox).toBeChecked({ checked: shouldBeChecked });
            }
        }

        // Verify all requested participants were found
        const unfoundParticipants = participants.filter((p) => !availableParticipants.some((available) => available.includes(p)));

        if (unfoundParticipants.length > 0) {
            throw new Error(`Could not find participants: ${unfoundParticipants.join(', ')}. Available participants: ${availableParticipants.join(', ')}`);
        }
    }

    /**
     * Select a payer by either UID or display name.
     * This method handles cases where display names may have changed due to other tests.
     * @param payerIdentifier - Either the user's UID or display name
     */
    async selectPayer(payerIdentifier: string): Promise<void> {
        // First, try to find by UID (radio button value)
        const radioByUid = this.page.locator(`input[type="radio"][name="paidBy"][value="${payerIdentifier}"]`);

        if (await radioByUid.isVisible().catch(() => false)) {
            // Found by UID - click the associated label
            const labelForUid = this.page.locator(`label:has(input[type="radio"][name="paidBy"][value="${payerIdentifier}"])`);
            await expect(labelForUid).toBeVisible();
            await labelForUid.click();
            return;
        }

        // Fallback: try to find by display name in label text
        const labelByText = this
            .page
            .locator('label')
            .filter({
                has: this.page.locator('input[type="radio"][name="paidBy"]'),
            })
            .filter({
                hasText: payerIdentifier,
            })
            .first();

        if (await labelByText.isVisible().catch(() => false)) {
            await labelByText.click();
            return;
        }

        // If we get here, we couldn't find the payer
        const availableOptions = await this.page.locator('label:has(input[type="radio"][name="paidBy"])').allTextContents();

        throw new Error(`Could not find payer "${payerIdentifier}". Available options: ${availableOptions.join(', ')}`);
    }

    async switchToExactAmounts(): Promise<void> {
        await this.getExactAmountsText().click();
    }

    /**
     * Clicks the save expense button and waits for navigation back to the group page.
     * This properly handles the async save operation.
     */
    async clickSaveExpenseButton(): Promise<void> {
        const saveButton = this.getSaveExpenseButton();

        // Wait for button to be enabled
        await expect(saveButton).toBeEnabled({ timeout: 500 });

        // Click the button
        await this.clickButton(saveButton, { buttonName: 'Save Expense' });

        // Wait for navigation away from the add-expense page (indicates save completed)
        await expect(this.page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/, { timeout: 3000 });
    }

    /**
     * Gets a locator for the save expense button for validation testing.
     * Use this only when you need to assert button state (disabled/enabled).
     * For clicking the button, use clickSaveExpenseButton() instead.
     */
    getSaveButtonForValidation(): Locator {
        return this.getSaveExpenseButton();
    }

    /**
     * Submit a complete expense with all required fields.
     * This method handles the full expense creation flow.
     */
    async submitExpense(expense: ExpenseFormData): Promise<void> {
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        // Fill expense description
        await this.fillDescription(expense.description);

        // Fill amount
        await this.fillAmount(expense.amount.toString());

        // Set currency - always set it explicitly
        const currencyButton = this.page.getByRole('button', { name: /select currency/i });
        await currencyButton.click();
        const searchInput = this.page.getByPlaceholder('Search by symbol, code, or country...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill(expense.currency);
        const currencyOption = this.page.getByText(expense.currency).first();
        await expect(currencyOption).toBeVisible({ timeout: 3000 });
        await currencyOption.click();
        await expect(searchInput).not.toBeVisible();

        // Select who paid - handle both UID and display name
        await this.selectPayer(expense.paidByDisplayName);

        // Handle split type and participants
        if (expense.splitType === 'equal') {
            if (expense.participants && expense.participants.length > 0) {
                // If specific participants are provided, select only those
                await this.selectSpecificParticipants(expense.participants);
            } else {
                // For equal split, click "Select all" to ensure all members are selected
                await this.selectAllParticipants();
            }
        } else if (expense.splitType === 'exact') {
            // Switch to exact amounts
            await this.switchToExactAmounts();
            // Additional logic for exact amounts would go here if needed
        }
        // Note: percentage split would need additional implementation

        // Save the expense
        await this.clickSaveExpenseButton();

        // Check for permission error messages first
        const permissionErrorMessages = ['You do not have permission to create expenses in this group', 'Something went wrong', 'Permission denied', 'Not authorized'];

        // Use polling to wait for any error messages to appear
        try {
            await expect(async () => {
                for (const errorMessage of permissionErrorMessages) {
                    const errorElement = this.page.getByText(errorMessage, { exact: false });
                    if (await errorElement.isVisible().catch(() => false)) {
                        throw new Error(`Permission error detected: "${errorMessage}"`);
                    }
                }
                // If no errors found, continue - this will exit the polling
            })
                .toPass({ timeout: 1000, intervals: [100, 250] });
        } catch (error) {
            // Re-throw permission errors
            if (error instanceof Error && error.message.includes('Permission error detected')) {
                throw error;
            }
            // If polling timed out without finding errors, that's expected behavior
        }

        // If no error messages, proceed with normal flow
        try {
            // Wait for navigation back to group page with a reasonable timeout
            await expect(this.page).toHaveURL(groupDetailUrlPattern());

            // Verify expense was created by checking it appears in the list
            await expect(this.page.getByText(expense.description)).toBeVisible({ timeout: 3000 });

            // Wait for page to stabilize after expense creation
            await this.waitForDomContentLoaded();
        } catch (navigationError) {
            // Check again for error messages that might have appeared during the wait
            for (const errorMessage of permissionErrorMessages) {
                const errorElement = this.page.getByText(errorMessage, { exact: false });
                if (await errorElement.isVisible().catch(() => false)) {
                    throw new Error(`Permission error detected after navigation timeout: "${errorMessage}"`);
                }
            }

            // If still no error message found, re-throw the navigation error
            throw navigationError;
        }
    }

    /**
     * Get the split options card (contains checkboxes for split selection)
     */
    getSplitOptionsCard() {
        const splitHeading = this.getSplitBetweenHeading();
        // Navigate up to the containing card
        return splitHeading.locator('..').locator('..');
    }

    /**
     * Get the first checkbox in split options
     */
    getSplitOptionsFirstCheckbox() {
        const splitCard = this.getSplitOptionsCard();
        return splitCard.locator('input[type="checkbox"]').first();
    }

    /**
     * Check if a user name is visible in split options
     */
    async isUserInSplitOptions(userName: string): Promise<boolean> {
        const splitCard = this.getSplitOptionsCard();
        return await splitCard.getByText(userName).isVisible();
    }

    getSplitBetweenHeading() {
        return this.page.getByRole('heading', { name: /Split between/ });
    }

    // Convenience date buttons
    getTodayButton() {
        return this.page.getByRole('button', { name: 'Today' });
    }

    getYesterdayButton() {
        return this.page.getByRole('button', { name: 'Yesterday' });
    }

    getLastNightButton() {
        return this.page.getByRole('button', { name: 'Last Night' });
    }

    getDateInput() {
        return this.page.locator('input[type="date"]');
    }

    getClockIcon() {
        // Clock icon button that opens the time selector - try multiple selectors
        return this
            .page
            .locator(
                [
                    'button[aria-label*="time" i]',
                    'button[aria-label*="clock" i]',
                    'button:has(svg[data-icon="clock"])',
                    'button:has(svg.clock-icon)',
                    'button:has([data-testid*="clock" i])',
                    '[role="button"]:has(svg)',
                    'button.time-selector-trigger',
                    '[data-testid="time-selector"]',
                ]
                    .join(', '),
            )
            .first();
    }

    async clickClockIcon(): Promise<void> {
        const clockIcon = this.getClockIcon();
        await this.clickButton(clockIcon, { buttonName: 'Clock icon' });
    }

    async clickTodayButton() {
        await this.clickButton(this.getTodayButton(), { buttonName: 'Today' });
    }

    async clickYesterdayButton() {
        await this.clickButton(this.getYesterdayButton(), { buttonName: 'Yesterday' });
    }

    async clickLastNightButton() {
        await this.clickButton(this.getLastNightButton(), { buttonName: 'Last Night' });
    }

    // Time-related methods
    getTimeButton() {
        return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
    }

    getTimeInput() {
        return this.page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    }

    getTimeSuggestion(time: string) {
        return this.page.getByRole('button', { name: time });
    }

    getExpenseDetailsHeading() {
        return this.page.getByRole('heading', { name: 'Expense Details' });
    }

    async clickSelectAllButton() {
        const selectAllButton = this.page.getByRole('button', { name: 'Select all' });
        await this.clickButton(selectAllButton, { buttonName: 'Select all' });
    }

    getCategoryInput() {
        // Category input is an actual input element with aria-haspopup
        // (not the currency selector which is a div with role=combobox)
        return this.page.locator('input[aria-haspopup="listbox"]').first();
    }

    async typeCategoryText(text: string) {
        const categoryInput = this.getCategoryInput();
        await this.fillPreactInput(categoryInput, text);
    }

    /**
     * Verify the page is in copy mode by checking the header
     */
    async verifyCopyMode(): Promise<void> {
        const headerTitle = this.page.getByRole('heading', {
            name: /Copy Expense/i,
        });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });
    }

    /**
     * Verify that form fields are pre-filled with expected values from copied expense
     */
    async verifyPreFilledValues(expectedValues: { description?: string; amount?: string; category?: string; }): Promise<void> {
        if (expectedValues.description) {
            const descriptionInput = this.getExpenseDescriptionField();
            await expect(descriptionInput).toHaveValue(expectedValues.description);
        }

        if (expectedValues.amount) {
            const amountInput = this.getAmountInput();
            await expect(amountInput).toHaveValue(expectedValues.amount);
        }

        if (expectedValues.category) {
            const categoryInput = this.getCategoryInput();
            await expect(categoryInput).toHaveValue(expectedValues.category);
        }
    }

    /**
     * Verify that the date is set to today (not the original expense date)
     */
    async verifyDateIsToday(): Promise<void> {
        const dateInput = this.getDateInput();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        await expect(dateInput).toHaveValue(today);
    }
}
