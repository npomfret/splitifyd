import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { FORM_LABELS } from '../constants/selectors';
import { PooledTestUser } from '@splitifyd/shared';
import { groupDetailUrlPattern } from './group-detail.page.ts';

// Match the ExpenseData interface from GroupDetailPage
export interface ExpenseFormData {
    description: string;
    amount: number;
    currency: string; // Required: must be explicitly provided
    paidByDisplayName: string; // the display name (not the uid)
    splitType: 'equal' | 'exact' | 'percentage';
    participants: string[]; // Required: must explicitly provide participant names (not the uids)
}

// Builder for ExpenseData used in UI tests
export class ExpenseFormDataBuilder {
    private expense: ExpenseFormData;

    constructor() {
        this.expense = {
            description: `${this.randomChoice(['Dinner', 'Lunch', 'Coffee', 'Gas', 'Movie', 'Grocery'])} ${this.randomString(4)}`,
            amount: this.randomDecimal(5, 500),
            currency: this.randomCurrency(),
            paidByDisplayName: '', // No default - must be explicitly set
            splitType: this.randomChoice(['equal', 'exact', 'percentage']),
            participants: []
        };
    }

    // Helper methods (duplicated here to avoid import complexity in e2e tests)
    private randomString(length: number = 8): string {
        return Math.random()
            .toString(36)
            .substring(2, 2 + length);
    }

    private randomDecimal(min: number = 1, max: number = 1000, decimals: number = 2): number {
        const value = Math.random() * (max - min) + min;
        return Number(value.toFixed(decimals));
    }

    private randomChoice<T>(choices: T[]): T {
        return choices[Math.floor(Math.random() * choices.length)];
    }

    private randomCurrency(): string {
        return this.randomChoice(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']);
    }

    withDescription(description: string): this {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: number): this {
        this.expense.amount = amount;
        return this;
    }

    withCurrency(currency: string): this {
        this.expense.currency = currency;
        return this;
    }

    withPaidByDisplayName(displayName: string): this {
        this.expense.paidByDisplayName = displayName;
        return this;
    }

    withSplitType(splitType: 'equal' | 'exact' | 'percentage'): this {
        this.expense.splitType = splitType;
        return this;
    }

    withParticipants(participants: string[]): this {
        this.expense.participants = [...participants];
        return this;
    }

    build(): ExpenseFormData {
        if (!this.expense.paidByDisplayName || this.expense.paidByDisplayName.trim() === '') {
            throw new Error('ExpenseFormDataBuilder.build(): paidByDisplayName is required but was not set. Use .withPaidByDisplayName(displayName) to specify who paid for this expense.');
        }

        if (!this.expense.participants || this.expense.participants.length === 0) {
            throw new Error('ExpenseFormDataBuilder.build(): participants is required but was not set. Use .withParticipants(participantNames) to specify who should split this expense.');
        }

        return {
            description: this.expense.description,
            amount: this.expense.amount,
            currency: this.expense.currency,
            paidByDisplayName: this.expense.paidByDisplayName,
            splitType: this.expense.splitType,
            participants: [...this.expense.participants],
        };
    }
}

export class ExpenseFormPage extends BasePage {
    readonly url = '/groups/[id]/add-expense';

    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    /**
     * Waits for the expense form to be fully ready with all members loaded.
     * This is called automatically by clickAddExpenseButton() so forms are always ready.
     * Note: Loading spinner check is handled in clickAddExpenseButton() before this method is called.
     * @param expectedMemberCount - The expected number of members in the group
     */
    async waitForFormReady(expectedMemberCount: number): Promise<void> {
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
        }).toPass({ timeout: 5000, intervals: [100, 250, 500] });

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
        await this.waitForMembersInExpenseForm(expectedMemberCount);
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
    private async waitForMembersInExpenseForm(expectedMemberCount: number, timeout = 5000): Promise<void> {
        // Wait for ALL members to appear in the "Who paid?" section
        await expect(async () => {
            const payerRadios = await this.page.locator('input[type="radio"][name="paidBy"]').count();
            if (payerRadios < expectedMemberCount) {
                throw new Error(`Only ${payerRadios} members loaded in "Who paid?" section, expected ${expectedMemberCount} - waiting for all members data`);
            }
        }).toPass({
            timeout,
            intervals: [100, 250, 500, 2000],
        });

        // Wait for ALL members to appear in "Split between" section
        await expect(async () => {
            // Check for checkboxes (one per member) or the Select all button
            const checkboxes = await this.page.locator('input[type="checkbox"]').count();
            const selectAllButton = await this.page.getByRole('button', { name: 'Select all' }).count();

            if (checkboxes === 0 && selectAllButton === 0) {
                throw new Error('No members loaded in "Split between" section - waiting for members data');
            }

            if (checkboxes > 0 && checkboxes < expectedMemberCount) {
                throw new Error(`Only ${checkboxes} member checkboxes found in "Split between", expected ${expectedMemberCount} - waiting for all members data`);
            }
        }).toPass({
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

    async clickUpdateExpenseButton() {
        await this.getUpdateExpenseButton().click()
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

            const shouldBeChecked = participants.some(p => text?.includes(p));
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
        const unfoundParticipants = participants.filter(p =>
            !availableParticipants.some(available => available.includes(p))
        );

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
        const labelByText = this.page
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
        await expect(this.page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/, { timeout: 10000 });
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
            }).toPass({ timeout: 1000, intervals: [100, 250] });
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
     * Calculate exact debt amount for equal split
     * @param totalAmount - Total expense amount
     * @param numberOfPeople - Number of people splitting
     * @returns The amount each person owes, rounded to 2 decimal places
     */
    calculateEqualSplitDebt(totalAmount: number, numberOfPeople: number): string {
        const debtPerPerson = totalAmount / numberOfPeople;
        return debtPerPerson.toFixed(2);
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

    getThisMorningButton() {
        return this.page.getByRole('button', { name: 'This Morning' });
    }

    getLastNightButton() {
        return this.page.getByRole('button', { name: 'Last Night' });
    }

    getDateInput() {
        return this.page.locator('input[type="date"]');
    }

    getClockIcon() {
        // Clock icon button that opens the time selector - try multiple selectors
        return this.page
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
                ].join(', '),
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

    async clickThisMorningButton() {
        await this.clickButton(this.getThisMorningButton(), { buttonName: 'This Morning' });
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

    getCategorySuggestion(text: string) {
        return this.page.getByRole('option', { name: new RegExp(text, 'i') });
    }

    async selectCategoryFromSuggestions(categoryText: string) {
        const categoryInput = this.getCategoryInput();
        await categoryInput.focus();
        await this.page.waitForSelector('[role="listbox"]');
        const suggestion = this.getCategorySuggestion(categoryText);
        // Note: Not a button, but a dropdown option
        await suggestion.click();
    }

    async typeCategoryText(text: string) {
        const categoryInput = this.getCategoryInput();
        await this.fillPreactInput(categoryInput, text);
    }

    getPercentageText() {
        return this.page.getByText('Percentage', { exact: true });
    }

    /**
     * Get split amount inputs (for exact amounts validation)
     */
    getSplitAmountInputs(): Locator {
        return this.page.locator('input[type="number"][step]').filter({ hasText: '' });
    }

    /**
     * Select exact amounts split type using page object method
     */
    async selectExactAmountsSplit(): Promise<void> {
        await this.page.getByText('Exact amounts').click();
    }

    /**
     * Select percentage split type using page object method
     */
    async selectPercentageSplit(): Promise<void> {
        await this.getPercentageText().click();
    }

    /**
     * Fill split amount for exact amounts
     */
    async fillSplitAmount(index: number, amount: string): Promise<void> {
        const splitInputs = this.getSplitAmountInputs();
        const targetInput = splitInputs.nth(index);
        await this.fillNumberInput(targetInput, amount);
    }
}
