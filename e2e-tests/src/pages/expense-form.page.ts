import { expect, Locator, Page } from '@playwright/test';
import { ExpenseFormData, ExpenseFormPage as BaseExpenseFormPage } from '@splitifyd/test-support';
import { FORM_LABELS } from '../constants/selectors';
import { groupDetailUrlPattern } from './group-detail.page.ts';

/**
 * E2E-specific ExpenseFormPage that extends the shared base class
 * Adds comprehensive member loading verification and enhanced error handling
 */
export class ExpenseFormPage extends BaseExpenseFormPage {
    readonly url = '/groups/[id]/add-expense';

    constructor(page: Page) {
        super(page);
    }

    /**
     * E2E-specific: Waits for the expense form to be fully ready with all members loaded.
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
        const headerTitle = this.page.getByRole('heading', {
            name: /Add Expense|Edit Expense|Copy Expense/i,
        });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });

        // Check for Cancel button (use .first() since there might be multiple)
        const cancelButton = this.page.getByRole('button', { name: 'Cancel' }).first();
        await expect(cancelButton).toBeVisible();

        // Step 2: Wait for main form container
        const formElement = this.page.locator('form');
        await expect(formElement).toBeVisible();

        // Step 3: Wait for form section headings
        await this.waitForExpenseFormSections();

        // Step 4: Wait for specific form inputs
        await expect(this.getDescriptionInput()).toBeVisible();

        // Step 5: Wait for ALL members to load
        await this.waitForMembersInExpenseForm(expectedMemberNames);
    }

    /**
     * E2E-specific: Wait for all main form sections to be visible
     */
    async waitForExpenseFormSections(): Promise<void> {
        await expect(this.page.getByText(FORM_LABELS.DESCRIPTION)).toBeVisible();
        await expect(this.page.getByRole('spinbutton', { name: /Amount\*/i })).toBeVisible();
        await expect(this.page.getByText(FORM_LABELS.WHO_PAID)).toBeVisible();
        await expect(this.page.getByText(FORM_LABELS.SPLIT_BETWEEN)).toBeVisible();
    }

    /**
     * E2E-specific: Wait for ALL members to load in the expense form
     * Prevents intermittent issues where members don't appear
     */
    private async waitForMembersInExpenseForm(expectedMemberNames: string[], timeout = 5000): Promise<void> {
        // Wait for ALL members in "Who paid?" section
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

        // Wait for ALL members in "Split between" section
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

    // ============================================================================
    // E2E-SPECIFIC SELECTORS
    // ============================================================================

    /**
     * E2E-specific: Get "Update Expense" button (for edit mode)
     */
    getUpdateExpenseButton(): Locator {
        return this.page.getByRole('button', { name: /update expense/i });
    }

    /**
     * E2E-specific: Get "Select all" button for participants
     */
    getSelectAllButton(): Locator {
        return this.page.getByRole('button', { name: 'Select all' });
    }

    /**
     * E2E-specific: Convenience date buttons
     */
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

    /**
     * E2E-specific: Clock icon for time selector
     */
    getClockIcon() {
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

    /**
     * E2E-specific: Time input and suggestion selectors
     */
    getTimeButton() {
        return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
    }

    getTimeInput() {
        return this.page.getByPlaceholder('Enter time (e.g., 2:30pm)');
    }

    getTimeSuggestion(time: string) {
        return this.page.getByRole('button', { name: time });
    }

    /**
     * E2E-specific: Category input field
     */
    getCategoryInput() {
        return this.page.locator('input[aria-haspopup="listbox"]').first();
    }

    /**
     * E2E-specific: Expense Details section heading
     */
    getExpenseDetailsHeading() {
        return this.page.getByRole('heading', { name: 'Expense Details' });
    }

    /**
     * E2E-specific: Split Between section heading
     */
    getSplitBetweenHeading() {
        return this.page.getByRole('heading', { name: /Split between/ });
    }

    /**
     * E2E-specific: Split options helper selectors
     */
    getSplitOptionsCard() {
        const splitHeading = this.getSplitBetweenHeading();
        return splitHeading.locator('..').locator('..');
    }

    getSplitOptionsFirstCheckbox() {
        const splitCard = this.getSplitOptionsCard();
        return splitCard.locator('input[type="checkbox"]').first();
    }

    // ============================================================================
    // E2E-SPECIFIC ACTION METHODS
    // ============================================================================

    /**
     * E2E-specific: Select all participants
     */
    async selectAllParticipants(): Promise<void> {
        await this.getSelectAllButton().click();
    }

    /**
     * E2E-specific: Select specific participants with enhanced error messages
     */
    async selectSpecificParticipants(participants: string[]): Promise<void> {
        const allLabels = this.page.locator('[data-testid="participant-selector-grid"]').locator('label');
        await allLabels.first().waitFor();

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

        const unfoundParticipants = participants.filter((p) => !availableParticipants.some((available) => available.includes(p)));

        if (unfoundParticipants.length > 0) {
            throw new Error(`Could not find participants: ${unfoundParticipants.join(', ')}. Available participants: ${availableParticipants.join(', ')}`);
        }
    }

    /**
     * E2E-specific: Select payer by UID or display name with enhanced fallback logic
     * Handles cases where display names may have changed
     */
    async selectPayer(payerIdentifier: string): Promise<void> {
        // First, try to find by UID
        const radioByUid = this.page.locator(`input[type="radio"][name="paidBy"][value="${payerIdentifier}"]`);

        if (await radioByUid.isVisible().catch(() => false)) {
            const labelForUid = this.page.locator(`label:has(input[type="radio"][name="paidBy"][value="${payerIdentifier}"])`);
            await expect(labelForUid).toBeVisible();
            await labelForUid.click();
            return;
        }

        // Fallback: try to find by display name
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

        // Enhanced error message with available options
        const availableOptions = await this.page.locator('label:has(input[type="radio"][name="paidBy"])').allTextContents();
        throw new Error(`Could not find payer "${payerIdentifier}". Available options: ${availableOptions.join(', ')}`);
    }

    /**
     * E2E-specific: Switch to exact amounts split type
     */
    async switchToExactAmounts(): Promise<void> {
        await this.selectSplitType('Exact amounts');
    }

    /**
     * E2E-specific: Click save button and wait for navigation
     * Handles async save operation with proper validation
     */
    async clickSaveExpenseButton(): Promise<void> {
        const saveButton = this.getSubmitButton();

        await expect(saveButton).toBeEnabled({ timeout: 500 });
        await this.clickButton(saveButton, { buttonName: 'Save Expense' });

        // Wait for navigation away from add-expense page
        await expect(this.page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/, { timeout: 3000 });
    }

    /**
     * E2E-specific: Get save button for validation testing
     * Use this only for asserting button state
     */
    getSaveButtonForValidation(): Locator {
        return this.getSubmitButton();
    }

    /**
     * E2E-specific: Complete expense submission workflow
     * Handles currency selection, permission errors, and navigation verification
     */
    async submitExpense(expense: ExpenseFormData): Promise<void> {
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        // Fill form fields
        await this.fillDescription(expense.description);
        await this.fillAmount(expense.amount.toString());

        // Set currency with enhanced interaction
        const currencyButton = this.page.getByRole('button', { name: /select currency/i });
        await currencyButton.click();
        const searchInput = this.page.getByPlaceholder('Search by symbol, code, or country...');
        await expect(searchInput).toBeVisible();
        await searchInput.fill(expense.currency);
        const currencyOption = this.page.getByText(expense.currency).first();
        await expect(currencyOption).toBeVisible({ timeout: 3000 });
        await currencyOption.click();
        await expect(searchInput).not.toBeVisible();

        // Select payer using enhanced selector
        await this.selectPayer(expense.paidByDisplayName);

        // Handle split type and participants
        if (expense.splitType === 'equal') {
            if (expense.participants && expense.participants.length > 0) {
                await this.selectSpecificParticipants(expense.participants);
            } else {
                await this.selectAllParticipants();
            }
        } else if (expense.splitType === 'exact') {
            await this.switchToExactAmounts();
        }

        // Save the expense
        await this.clickSaveExpenseButton();

        // Check for permission errors
        const permissionErrorMessages = ['You do not have permission to create expenses in this group', 'Something went wrong', 'Permission denied', 'Not authorized'];

        try {
            await expect(async () => {
                for (const errorMessage of permissionErrorMessages) {
                    const errorElement = this.page.getByText(errorMessage, { exact: false });
                    if (await errorElement.isVisible().catch(() => false)) {
                        throw new Error(`Permission error detected: "${errorMessage}"`);
                    }
                }
            })
                .toPass({ timeout: 1000, intervals: [100, 250] });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Permission error detected')) {
                throw error;
            }
        }

        // Verify successful navigation and expense creation
        try {
            await expect(this.page).toHaveURL(groupDetailUrlPattern());
            await expect(this.page.getByText(expense.description)).toBeVisible({ timeout: 3000 });
            await this.waitForDomContentLoaded();
        } catch (navigationError) {
            // Check for late-appearing error messages
            for (const errorMessage of permissionErrorMessages) {
                const errorElement = this.page.getByText(errorMessage, { exact: false });
                if (await errorElement.isVisible().catch(() => false)) {
                    throw new Error(`Permission error detected after navigation timeout: "${errorMessage}"`);
                }
            }
            throw navigationError;
        }
    }

    /**
     * E2E-specific: Date/time convenience actions
     */
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

    /**
     * E2E-specific: Click Select All button (convenience method)
     */
    async clickSelectAllButton() {
        const selectAllButton = this.getSelectAllButton();
        await this.clickButton(selectAllButton, { buttonName: 'Select all' });
    }

    /**
     * E2E-specific: Type category text
     */
    async typeCategoryText(text: string) {
        const categoryInput = this.getCategoryInput();
        await this.fillPreactInput(categoryInput, text);
    }

    /**
     * E2E-specific: Check if user is visible in split options
     */
    async isUserInSplitOptions(userName: string): Promise<boolean> {
        const splitCard = this.getSplitOptionsCard();
        return await splitCard.getByText(userName).isVisible();
    }

    // ============================================================================
    // E2E-SPECIFIC VERIFICATION METHODS
    // ============================================================================

    /**
     * E2E-specific: Verify copy mode
     */
    async verifyCopyMode(): Promise<void> {
        const headerTitle = this.page.getByRole('heading', {
            name: /Copy Expense/i,
        });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });
    }

    /**
     * E2E-specific: Verify pre-filled values from copied expense
     */
    async verifyPreFilledValues(expectedValues: { description?: string; amount?: string; category?: string; }): Promise<void> {
        if (expectedValues.description) {
            const descriptionInput = this.getDescriptionInput();
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
     * E2E-specific: Verify date is set to today
     */
    async verifyDateIsToday(): Promise<void> {
        const dateInput = this.getDateInput();
        const today = new Date().toISOString().split('T')[0];
        await expect(dateInput).toHaveValue(today);
    }
}
