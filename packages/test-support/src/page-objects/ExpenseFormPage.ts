import { expect, Locator, Page } from '@playwright/test';
import type { ExpenseFormData } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';

/**
 * Expense Form Page Object Model for Playwright tests
 * Handles interactions with the Add/Edit Expense form
 *
 * Architecture:
 * - All selectors are scoped to semantic containers (identified by test IDs)
 * - Each form section (Expense Details, Who Paid, Split Between, How to Split) is a Card with a semantic test ID
 * - Form fields are accessed via their parent container for precise targeting
 * - This prevents false matches and makes tests resilient to layout changes
 *
 * Used for testing expense form behavior including split recalculation
 */
export class ExpenseFormPage extends BasePage {
    readonly url = '/groups/[id]/add-expense';

    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // PAGE STATE HELPERS
    // ============================================================================

    /**
     * Wait for the key expense form sections to be visible.
     */
    async waitForExpenseFormSections(): Promise<void> {
        await expect(this.getExpenseDetailsSection()).toBeVisible({ timeout: 3000 });
        await expect(this.getWhoPaidSection()).toBeVisible({ timeout: 3000 });
        await expect(this.getSplitBetweenSection()).toBeVisible({ timeout: 3000 });
        await expect(this.getHowToSplitSection()).toBeVisible({ timeout: 3000 });
    }

    // ============================================================================
    // HEADING SELECTORS
    // ============================================================================

    /**
     * Page heading (Add Expense / Edit Expense / Copy Expense)
     */
    protected getPageHeading(): Locator {
        return this.page.getByRole('heading', { name: /add expense|edit expense|copy expense/i });
    }

    // ============================================================================
    // CONTAINER SELECTORS - Find sections by their semantic test IDs
    // ============================================================================

    /**
     * Expense Details section - contains description, amount, currency, date, time, label
     * Uses semantic test ID for reliable targeting
     */
    private getExpenseDetailsSection(): Locator {
        return this.page.getByTestId('expense-details-section');
    }

    /**
     * Who Paid section - contains payer radio buttons
     * Uses semantic test ID for reliable targeting
     */
    private getWhoPaidSection(): Locator {
        return this.page.getByTestId('who-paid-section');
    }

    /**
     * Split Between section - contains participant checkboxes
     * Uses semantic test ID for reliable targeting
     */
    private getSplitBetweenSection(): Locator {
        return this.page.getByTestId('split-between-section');
    }

    /**
     * How to Split section - contains split type radios
     * Uses semantic test ID for reliable targeting
     */
    private getHowToSplitSection(): Locator {
        return this.page.getByTestId('how-to-split-section');
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to their containers
    // ============================================================================

    /**
     * Description input field (scoped to Expense Details section)
     */
    private getDescriptionInput(): Locator {
        return this.getExpenseDetailsSection().getByPlaceholder(/what was this expense for/i);
    }

    /**
     * Amount input field (scoped to Expense Details section)
     */
    private getAmountInput(): Locator {
        return this.getExpenseDetailsSection().getByRole('spinbutton', { name: /amount/i });
    }

    /**
     * Currency select field (scoped to Expense Details section)
     */
    private getCurrencySelect(): Locator {
        return this.getExpenseDetailsSection().getByLabel(/currency/i);
    }

    /**
     * Get payer radio button by display name (scoped to Who Paid section)
     */
    private getPayerRadio(displayName: DisplayName): Locator {
        return this.getWhoPaidSection().getByRole('radio', { name: displayName });
    }

    /**
     * Get split type radio by visible label (scoped to How to Split section)
     */
    private getSplitTypeRadio(splitTypeLabel: string): Locator {
        return this.getHowToSplitSection().getByRole('radio', { name: new RegExp(splitTypeLabel, 'i') });
    }

    // ============================================================================
    // SPLIT DISPLAY SELECTORS - Based on visible text users see
    // ============================================================================

    /**
     * Equal split container - find by the visible instruction text, then get parent
     */
    protected getEqualSplitContainer(): Locator {
        return this.page.getByText(/each person pays/i).locator('..');
    }

    /**
     * "Each person pays" instruction text for equal splits
     */
    protected getEqualSplitInstructionText(): Locator {
        return this.page.getByText(/each person pays/i);
    }

    /**
     * Exact split container - find by the visible instruction text, then get parent
     */
    protected getExactSplitContainer(): Locator {
        return this.page.getByText(/enter exact amounts for each person/i).locator('..');
    }

    /**
     * "Enter exact amounts for each person:" instruction text for exact splits
     */
    protected getExactSplitInstructionText(): Locator {
        return this.page.getByText(/enter exact amounts for each person/i);
    }

    /**
     * All split amount inputs for EXACT split type (scoped to exact split container)
     */
    protected getExactSplitInputs(): Locator {
        return this.getExactSplitContainer().locator('input[type="text"][inputmode="decimal"]');
    }

    /**
     * Total text within exact split container (scoped to avoid false matches)
     */
    protected getExactSplitTotalText(): Locator {
        return this.getExactSplitContainer().getByText(/total/i);
    }

    // ============================================================================
    // BUTTON SELECTORS
    // ============================================================================

    /**
     * Submit button (Save/Create Expense)
     */
    protected getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: /save expense|create expense/i });
    }

    /**
     * Cancel button - uses data-testid as it's outside the form element
     */
    protected getCancelButton(): Locator {
        return this.page.getByTestId('expense-form-cancel');
    }

    /**
     * Click cancel and wait for navigation; preferred in tests that assert no unsaved prompt.
     */
    async clickCancel(): Promise<void> {
        await this.getCancelButton().click();
    }

    /**
     * Update Expense button (edit mode)
     */
    protected getUpdateExpenseButton(): Locator {
        return this.page.getByRole('button', { name: /update expense/i });
    }

    /**
     * Select all participants button.
     */
    protected getSelectAllButton(): Locator {
        return this.page.getByRole('button', { name: /select all/i });
    }

    /**
     * Convenience date buttons.
     */
    protected getTodayButton(): Locator {
        return this.page.getByRole('button', { name: 'Today' });
    }

    protected getYesterdayButton(): Locator {
        return this.page.getByRole('button', { name: 'Yesterday' });
    }

    protected getLastNightButton(): Locator {
        return this.page.getByRole('button', { name: 'Last Night' });
    }

    /**
     * Date input field.
     */
    protected getDateInput(): Locator {
        return this.getExpenseDetailsSection().locator('input[type="date"]').first();
    }

    /**
     * Clock icon button to open time picker.
     */
    protected getClockIcon(): Locator {
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
     * Time-related selectors.
     */
    protected getTimeButton(): Locator {
        return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} (AM|PM)/i });
    }

    protected getTimeInput(): Locator {
        return this.page.getByPlaceholder(/Enter time/i);
    }

    protected getTimeSuggestion(time: string): Locator {
        // Find the time input first, then locate the suggestion button near it
        // This ensures we're clicking suggestions from the correct dropdown
        const timeInput = this.getTimeInput();
        // The suggestions are siblings of the input within the same parent container
        // Use page-level search but this helps us ensure we're in the right context
        return this.page.getByRole('button', { name: time, exact: true });
    }

    /**
     * Label input field (combobox).
     */
    protected getLabelInput(): Locator {
        return this.getExpenseDetailsSection().locator('input[aria-haspopup="listbox"]').first();
    }

    /**
     * Expense Details heading (used for blur actions).
     */
    private getExpenseDetailsHeading(): Locator {
        return this.page.getByRole('heading', { name: /expense details/i });
    }

    /**
     * Split Between heading.
     */
    protected getSplitBetweenHeading(): Locator {
        return this.page.getByRole('heading', { name: /split between/i });
    }

    /**
     * Split options container/card.
     */
    protected getSplitOptionsCard(): Locator {
        const splitHeading = this.getSplitBetweenHeading();
        return splitHeading.locator('..').locator('..');
    }

    protected getSplitOptionsFirstCheckbox(): Locator {
        return this.getSplitOptionsCard().locator('input[type="checkbox"]').first();
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Navigate to the add expense page for a group
     */
    async navigateToAddExpense(groupId: GroupId | string): Promise<void> {
        await this.page.goto(`/groups/${groupId}/add-expense`, { waitUntil: 'domcontentloaded' });
        await this.waitForPageToLoad();
    }

    /**
     * Wait for the expense form page to load
     */
    async waitForPageToLoad(): Promise<void> {
        await expect(this.getPageHeading()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    /**
     * Fill the description field
     */
    async fillDescription(description: string): Promise<void> {
        await this.fillPreactInput(this.getDescriptionInput(), description);
    }

    /**
     * Fill the amount field
     * Note: Amount is a number input, so we use fill() directly instead of fillPreactInput
     * because number inputs can't be truly "cleared" to empty string - they default to 0
     */
    async fillAmount(amount: string): Promise<void> {
        const input = this.getAmountInput();
        await input.fill(amount);
        await input.blur();
    }

    async expectAmountValue(value: string): Promise<void> {
        const input = this.getAmountInput();
        await expect(input).toHaveValue(value);
    }

    async expectCurrencySelectionDisplays(symbol: string, currencyCode: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toContainText(symbol);
        await expect(currencyButton).toContainText(currencyCode);
    }

    async expectFormOpen(): Promise<void> {
        await expect(this.page.getByRole('form')).toBeVisible();
    }

    /**
     * Select a currency
     * Note: Currency is a custom dropdown (button + listbox), not a native select
     */
    async selectCurrency(currencyCode: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toBeVisible();
        await this.clickButton(currencyButton, { buttonName: 'Select currency' });

        const searchInput = this.page.getByPlaceholder(/Search by symbol, code, or country/i);
        const searchVisible = await searchInput.isVisible().catch(() => false);

        if (searchVisible) {
            await this.fillPreactInput(searchInput, currencyCode);

            // Wait for the dropdown to filter and show the matching option, then click it
            const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
            await expect(currencyOption).toBeVisible({ timeout: 2000 });
            await currencyOption.click();

            await expect(searchInput).not.toBeVisible({ timeout: 2000 });
            return;
        }

        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
        await expect(currencyOption).toBeVisible({ timeout: 2000 });
        await currencyOption.click();
    }

    /**
     * Select who paid by display name (what user sees on screen)
     */
    async selectPayer(displayName: DisplayName): Promise<void> {
        const radioByUid = this.page.locator(`input[type="radio"][name="paidBy"][value="${displayName}"]`);

        if (await radioByUid.isVisible().catch(() => false)) {
            const labelForUid = this.page.locator(`label:has(input[type="radio"][name="paidBy"][value="${displayName}"])`).first();
            await expect(labelForUid).toBeVisible();
            await labelForUid.click();
            return;
        }

        const labelByText = this
            .page
            .locator('label')
            .filter({ has: this.page.locator('input[type="radio"][name="paidBy"]') })
            .filter({ hasText: displayName })
            .first();

        if (await labelByText.isVisible().catch(() => false)) {
            await labelByText.click();
            return;
        }

        const radio = this.getPayerRadio(displayName);
        if (await radio.isVisible().catch(() => false)) {
            await radio.check();
            return;
        }

        const availableOptions = await this
            .page
            .locator('label:has(input[type="radio"][name="paidBy"])')
            .allTextContents();

        throw new Error(
            `Could not find payer "${displayName}". Available options: ${
                availableOptions
                    .map((text) => text.trim())
                    .filter(Boolean)
                    .join(', ')
            }`,
        );
    }

    /**
     * Wait for split type section to be rendered (after selecting participants)
     */
    async waitForSplitTypeSection(): Promise<void> {
        // Wait for "How to split" section to be visible by checking its heading
        await expect(this.getHowToSplitSection()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    /**
     * Select split type by visible label
     * @param splitTypeLabel - "Equal", "Exact amounts", or "Percentage" (what user sees)
     */
    async selectSplitType(splitTypeLabel: string): Promise<void> {
        // Wait for split type section to be rendered first
        await this.waitForSplitTypeSection();

        const radio = this.getSplitTypeRadio(splitTypeLabel);
        // Use force:true because radios are visually hidden with sr-only class
        await radio.check({ force: true });
    }

    /**
     * Select participants to split between by their display names
     * This checks the checkboxes in the "Split between" section
     */
    async selectSplitParticipants(displayNames: string[]): Promise<void> {
        await this.selectSpecificParticipants(displayNames);
    }

    /**
     * Select all participants in the split section.
     */
    async selectAllParticipants(): Promise<void> {
        const button = this.getSelectAllButton();
        await expect(button).toBeVisible({ timeout: 2000 });
        await this.clickButton(button, { buttonName: 'Select all participants' });
    }

    /**
     * Select a specific set of participants, toggling checkboxes as needed.
     */
    async selectSpecificParticipants(participants: string[]): Promise<void> {
        const allLabels = this.page.locator('[data-testid="participant-selector-grid"]').locator('label');
        await allLabels.first().waitFor({ state: 'visible' });

        const count = await allLabels.count();
        const availableParticipants: string[] = [];

        for (let i = 0; i < count; i++) {
            const label = allLabels.nth(i);
            const checkbox = label.locator('input[type="checkbox"]');
            const text = (await label.textContent())?.trim() ?? '';

            if (text) {
                availableParticipants.push(text);
            }

            const shouldBeChecked = participants.some((participant) => text.includes(participant));
            const isChecked = await checkbox.isChecked();

            if (shouldBeChecked !== isChecked) {
                // Check if checkbox is enabled before trying to click
                const isEnabled = await checkbox.isEnabled();
                if (!isEnabled) {
                    // Skip disabled checkboxes - they're locked in their current state by the form logic
                    continue;
                }
                await label.click();
                await expect(checkbox).toBeChecked({ checked: shouldBeChecked });
            }
        }

        const unfoundParticipants = participants.filter(
            (participant) => !availableParticipants.some((available) => available.includes(participant)),
        );

        if (unfoundParticipants.length > 0) {
            throw new Error(
                `Could not find participants: ${unfoundParticipants.join(', ')}. `
                    + `Available participants: ${availableParticipants.join(', ')}`,
            );
        }
    }

    /**
     * Switch to the Exact Amounts split type.
     */
    async switchToExactAmounts(): Promise<void> {
        await this.selectSplitType('Exact amounts');
    }

    /**
     * Click the Save/Submit button and wait for navigation.
     */
    async clickSaveExpenseButton(): Promise<void> {
        const saveButton = this.getSubmitButton();
        await expect(saveButton).toBeEnabled({ timeout: 500 });
        await this.clickButton(saveButton, { buttonName: 'Save Expense' });
        await expect(this.page).not.toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/, { timeout: 3000 });
    }

    /**
     * Access the submit button for validation assertions.
     */
    protected getSaveButtonForValidation(): Locator {
        return this.getSubmitButton();
    }

    /**
     * Submit the expense form
     */
    async submitForm(): Promise<void> {
        const button = this.getSubmitButton();
        await this.clickButton(button, { buttonName: 'Submit Expense' });
    }

    async expectSaveButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    /**
     * Complete the expense submission workflow using a data object.
     */
    async submitExpense(expense: ExpenseFormData): Promise<void> {
        await expect(this.page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

        await this.fillDescription(expense.description);
        await this.selectCurrency(expense.currency);
        await this.fillAmount(expense.amount.toString());
        await this.selectPayer(expense.paidByDisplayName);

        if (expense.splitType === 'equal') {
            if (expense.participants && expense.participants.length > 0) {
                await this.selectSpecificParticipants(expense.participants);
            } else {
                await this.selectAllParticipants();
            }
        } else if (expense.splitType === 'exact') {
            await this.switchToExactAmounts();
        }

        await this.clickSaveExpenseButton();

        const permissionErrorMessages = [
            'You do not have permission to create expenses in this group',
            'Something went wrong',
            'Permission denied',
            'Not authorized',
        ];

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

        const groupDetailPattern = /\/groups\/[a-zA-Z0-9]+$/;

        try {
            await expect(this.page).toHaveURL(groupDetailPattern);
            await expect(this.page.getByText(expense.description)).toBeVisible({ timeout: 3000 });
            await this.waitForDomContentLoaded();
        } catch (navigationError) {
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
     * Click the clock icon to open the time picker.
     */
    async clickClockIcon(): Promise<void> {
        const clockIcon = this.getClockIcon();
        await this.clickButton(clockIcon, { buttonName: 'Clock icon' });
    }

    async clickTodayButton(): Promise<void> {
        await this.clickButton(this.getTodayButton(), { buttonName: 'Today' });
    }

    async clickYesterdayButton(): Promise<void> {
        await this.clickButton(this.getYesterdayButton(), { buttonName: 'Yesterday' });
    }

    async clickLastNightButton(): Promise<void> {
        await this.clickButton(this.getLastNightButton(), { buttonName: 'Last Night' });
    }

    async clickSelectAllButton(): Promise<void> {
        await this.selectAllParticipants();
    }

    async typeLabelText(text: string): Promise<void> {
        const labelInput = this.getLabelInput();
        await this.fillPreactInput(labelInput, text);
    }

    async isUserInSplitOptions(userName: string): Promise<boolean> {
        const splitCard = this.getSplitOptionsCard();
        return splitCard.getByText(userName).isVisible().catch(() => false);
    }

    async getDateInputValue(): Promise<string> {
        return this.getDateInput().inputValue();
    }

    async getTimeButtonCount(): Promise<number> {
        return this.getTimeButton().count();
    }

    async clickTimeButton(): Promise<void> {
        const timeButton = this.getTimeButton();
        await timeButton.click();
    }

    async fillTimeInput(value: string): Promise<void> {
        const timeInput = this.getTimeInput();
        await timeInput.fill(value);
    }

    async getClockIconCount(): Promise<number> {
        return this.getClockIcon().count();
    }

    async verifySplitOptionsFirstCheckboxVisible(): Promise<void> {
        await expect(this.getSplitOptionsFirstCheckbox()).toBeVisible();
    }

    async verifySplitOptionsFirstCheckboxChecked(): Promise<void> {
        await expect(this.getSplitOptionsFirstCheckbox()).toBeChecked();
    }

    async verifySaveButtonDisabled(): Promise<void> {
        await expect(this.getSaveButtonForValidation()).toBeDisabled();
    }

    async verifySaveButtonEnabled(): Promise<void> {
        await expect(this.getSaveButtonForValidation()).toBeEnabled();
    }

    async clickUpdateExpenseButton(): Promise<void> {
        const updateButton = this.getUpdateExpenseButton();
        await expect(updateButton).toBeVisible({ timeout: 2000 });
        await updateButton.click();
    }

    async clickExpenseDetailsHeading(): Promise<void> {
        const heading = this.getExpenseDetailsHeading();
        await heading.click();
    }

    async clickTimeSuggestion(time: string): Promise<void> {
        // Verify the suggestion exists in the dropdown
        const suggestion = this.getTimeSuggestion(time);
        await expect(suggestion).toBeVisible({ timeout: 3000 });

        // Use keyboard navigation instead of clicking to avoid pointer interception issues
        // The TimeInput component supports ArrowDown/ArrowUp for navigation and Enter to select

        // Determine how many times to press ArrowDown to reach the target suggestion
        // We need to find the index of the target time in the visible suggestions
        const allSuggestions = await this.page.getByRole('button').filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i }).allTextContents();
        const targetIndex = allSuggestions.findIndex(text => text === time);

        if (targetIndex === -1) {
            throw new Error(`Could not find suggestion "${time}" in the list: ${allSuggestions.join(', ')}`);
        }

        // Get the time input to send keyboard events
        const timeInput = this.getTimeInput();

        // Navigate to the target suggestion using ArrowDown
        for (let i = 0; i <= targetIndex; i++) {
            await timeInput.press('ArrowDown');
        }

        // Select the highlighted suggestion with Enter
        await timeInput.press('Enter');
    }

    // ============================================================================
    // VERIFICATION METHODS - All assertions go here
    // ============================================================================

    /**
     * Verify page is loaded and ready
     */
    async verifyPageLoaded(): Promise<void> {
        await expect(this.getPageHeading()).toBeVisible();
        await expect(this.getDescriptionInput()).toBeVisible();
        await expect(this.getAmountInput()).toBeVisible();
        await expect(this.getCurrencySelect()).toBeVisible();
    }

    /**
     * Verify equal split section is visible
     */
    async verifyEqualSplitDisplayed(): Promise<void> {
        await expect(this.getEqualSplitInstructionText()).toBeVisible();
    }

    /**
     * Verify exact split section is visible
     */
    async verifyExactSplitDisplayed(): Promise<void> {
        await expect(this.getExactSplitInstructionText()).toBeVisible();
    }

    /**
     * Verify equal splits show a specific amount
     * Scoped to the equal split container to avoid false matches
     * //todo" make this MUCH better
     */
    async verifyEqualSplitsContainAmount(amount: string): Promise<void> {
        const container = this.getEqualSplitContainer();
        await expect(container).toBeVisible();
        // Find the amount within the equal split container - use first() since amount may appear multiple times
        await expect(container.getByText(amount, { exact: true }).first()).toBeVisible();
    }

    /**
     * Verify equal splits do NOT show a specific amount
     * Scoped to the equal split container
     */
    async verifyEqualSplitsDoNotContainAmount(amount: string): Promise<void> {
        const container = this.getEqualSplitContainer();
        await expect(container).toBeVisible();
        // Verify the amount does NOT exist within the equal split container
        const elements = container.getByText(amount, { exact: true });
        const count = await elements.count();
        expect(count).toBe(0);
    }

    /**
     * Verify all exact split inputs have a specific value
     */
    async verifyExactSplitInputsHaveValue(value: string): Promise<void> {
        const inputs = this.getExactSplitInputs();
        const count = await inputs.count();

        for (let i = 0; i < count; i++) {
            await expect(inputs.nth(i)).toHaveValue(value);
        }
    }

    async setExactSplitAmount(index: number, value: string): Promise<void> {
        const inputs = this.getExactSplitInputs();
        await expect(inputs.nth(index)).toBeVisible();
        await inputs.nth(index).fill(value);
        await inputs.nth(index).blur();
    }

    /**
     * Verify exact split inputs exist and count matches expected
     */
    async verifyExactSplitInputCount(expectedCount: number): Promise<void> {
        const inputs = this.getExactSplitInputs();
        const count = await inputs.count();
        expect(count).toBe(expectedCount);
    }

    /**
     * Verify exact split total display shows correct values
     * Scoped to the exact split container
     */
    async verifyExactSplitTotal(splitTotal: string, expenseTotal: string): Promise<void> {
        const container = this.getExactSplitContainer();
        await expect(container).toBeVisible();
        // Find the total text within the exact split container specifically
        await expect(this.getExactSplitTotalText()).toBeVisible();
        // The total display is the parent of the "Total:" text
        // Verify both amounts are present (they're now wrapped in CurrencyAmount components with tooltips)
        await expect(container).toContainText(splitTotal);
        await expect(container).toContainText(expenseTotal);
        await expect(container).toContainText('/');
    }

    async verifyCopyMode(): Promise<void> {
        const headerTitle = this.page.getByRole('heading', { name: /Copy Expense/i });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });
    }

    async verifyPreFilledValues(expectedValues: { description?: string; amount?: string; label?: string; }): Promise<void> {
        if (expectedValues.description) {
            await expect(this.getDescriptionInput()).toHaveValue(expectedValues.description);
        }

        if (expectedValues.amount) {
            await expect(this.getAmountInput()).toHaveValue(expectedValues.amount);
        }

        if (expectedValues.label) {
            await expect(this.getLabelInput()).toHaveValue(expectedValues.label);
        }
    }

    async verifyDateIsToday(): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        await expect(this.getDateInput()).toHaveValue(today);
    }

    async verifyMemberNotInParticipantDropdown(memberName: string): Promise<void> {
        await expect(this.getSplitBetweenHeading()).toBeVisible();

        const memberCheckbox = this.page.getByRole('checkbox', { name: memberName });
        await expect(memberCheckbox).not.toBeVisible();

        const memberRadio = this.page.getByRole('radio', { name: memberName });
        await expect(memberRadio).not.toBeVisible();
    }

    async verifyTimeButtonVisible(): Promise<void> {
        await expect(this.getTimeButton()).toBeVisible();
    }

    async verifyTimeInputVisible(): Promise<void> {
        await expect(this.getTimeInput()).toBeVisible();
    }

    async verifyTimeInputFocused(): Promise<void> {
        await expect(this.getTimeInput()).toBeFocused();
    }

    async verifyTimeSuggestionVisible(time: string): Promise<void> {
        await expect(this.getTimeSuggestion(time)).toBeVisible();
    }

    async verifySplitBetweenHeadingVisible(): Promise<void> {
        await expect(this.getSplitBetweenHeading()).toBeVisible();
    }

    async verifyDateInputMatchesPattern(pattern: RegExp): Promise<void> {
        await expect(async () => {
            const value = await this.getDateInput().inputValue();
            expect(value).toMatch(pattern);
        })
            .toPass({ timeout: 5000 });
    }

    async setDate(value: string): Promise<void> {
        const dateInput = this.getDateInput();
        await dateInput.fill(value);
        await dateInput.blur();
    }

    async verifyAmountErrorMessageContains(text: string): Promise<void> {
        const errorMessage = this.page.getByTestId('currency-input-error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(text);
    }

    async verifyDescriptionErrorMessageContains(text: string): Promise<void> {
        const errorMessage = this.page.getByTestId('validation-error-description');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(text);
    }

    async verifyDateErrorMessageContains(text: string): Promise<void> {
        const errorMessage = this.page.getByTestId('validation-error-date');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(text);
    }

    async verifySplitErrorMessageContains(text: string): Promise<void> {
        const errorMessage = this.page.getByTestId('validation-error-splits');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(text);
    }

    async verifyCancelButtonVisible(): Promise<void> {
        await expect(this.getCancelButton()).toBeVisible();
    }
}
