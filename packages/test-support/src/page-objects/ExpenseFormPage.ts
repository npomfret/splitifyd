import { expect, Locator, Page } from '@playwright/test';
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
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // HEADING SELECTORS
    // ============================================================================

    /**
     * Page heading (Add Expense / Edit Expense)
     */
    getPageHeading(): Locator {
        return this.page.getByRole('heading', { name: /add expense|edit expense/i });
    }

    // ============================================================================
    // CONTAINER SELECTORS - Find sections by their semantic test IDs
    // ============================================================================

    /**
     * Expense Details section - contains description, amount, currency, date, time, category
     * Uses semantic test ID for reliable targeting
     */
    getExpenseDetailsSection(): Locator {
        return this.page.getByTestId('expense-details-section');
    }

    /**
     * Who Paid section - contains payer radio buttons
     * Uses semantic test ID for reliable targeting
     */
    getWhoPaidSection(): Locator {
        return this.page.getByTestId('who-paid-section');
    }

    /**
     * Split Between section - contains participant checkboxes
     * Uses semantic test ID for reliable targeting
     */
    getSplitBetweenSection(): Locator {
        return this.page.getByTestId('split-between-section');
    }

    /**
     * How to Split section - contains split type radios
     * Uses semantic test ID for reliable targeting
     */
    getHowToSplitSection(): Locator {
        return this.page.getByTestId('how-to-split-section');
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to their containers
    // ============================================================================

    /**
     * Description input field (scoped to Expense Details section)
     */
    getDescriptionInput(): Locator {
        return this.getExpenseDetailsSection().getByPlaceholder(/what was this expense for/i);
    }

    /**
     * Amount input field (scoped to Expense Details section)
     */
    getAmountInput(): Locator {
        return this.getExpenseDetailsSection().getByRole('spinbutton', { name: /amount/i });
    }

    /**
     * Currency select field (scoped to Expense Details section)
     */
    getCurrencySelect(): Locator {
        return this.getExpenseDetailsSection().getByLabel(/currency/i);
    }

    /**
     * Get payer radio button by display name (scoped to Who Paid section)
     */
    getPayerRadio(displayName: string): Locator {
        return this.getWhoPaidSection().getByRole('radio', { name: displayName });
    }

    /**
     * Get participant checkbox by display name (scoped to Split Between section)
     */
    getParticipantCheckbox(displayName: string): Locator {
        return this.getSplitBetweenSection().getByRole('checkbox', { name: new RegExp(displayName, 'i') });
    }

    /**
     * Get split type radio by visible label (scoped to How to Split section)
     */
    getSplitTypeRadio(splitTypeLabel: string): Locator {
        return this.getHowToSplitSection().getByRole('radio', { name: new RegExp(splitTypeLabel, 'i') });
    }

    // ============================================================================
    // SPLIT DISPLAY SELECTORS - Based on visible text users see
    // ============================================================================

    /**
     * Equal split container - find by the visible instruction text, then get parent
     */
    getEqualSplitContainer(): Locator {
        return this.page.getByText(/each person pays/i).locator('..');
    }

    /**
     * "Each person pays" instruction text for equal splits
     */
    getEqualSplitInstructionText(): Locator {
        return this.page.getByText(/each person pays/i);
    }

    /**
     * Exact split container - find by the visible instruction text, then get parent
     */
    getExactSplitContainer(): Locator {
        return this.page.getByText(/enter exact amounts for each person/i).locator('..');
    }

    /**
     * "Enter exact amounts for each person:" instruction text for exact splits
     */
    getExactSplitInstructionText(): Locator {
        return this.page.getByText(/enter exact amounts for each person/i);
    }

    /**
     * All split amount inputs for EXACT split type (scoped to exact split container)
     */
    getExactSplitInputs(): Locator {
        return this.getExactSplitContainer().locator('input[type="text"][inputmode="decimal"]');
    }

    /**
     * Total text within exact split container (scoped to avoid false matches)
     */
    getExactSplitTotalText(): Locator {
        return this.getExactSplitContainer().getByText(/total/i);
    }

    // ============================================================================
    // BUTTON SELECTORS
    // ============================================================================

    /**
     * Submit button (Save/Create Expense)
     */
    getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: /save expense|create expense/i });
    }

    /**
     * Cancel button
     */
    getCancelButton(): Locator {
        return this.page.getByRole('button', { name: /cancel/i });
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Navigate to the add expense page for a group
     */
    async navigateToAddExpense(groupId: string): Promise<void> {
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

    /**
     * Select a currency
     * Note: Currency is a custom dropdown (button + listbox), not a native select
     */
    async selectCurrency(currencyCode: string): Promise<void> {
        // Click the currency button to open dropdown
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toBeVisible();
        await currencyButton.click();

        // Wait for dropdown to open and click the currency option
        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
        await expect(currencyOption).toBeVisible();
        await currencyOption.click();
    }

    /**
     * Select who paid by display name (what user sees on screen)
     */
    async selectPayer(displayName: string): Promise<void> {
        const radio = this.getPayerRadio(displayName);
        await expect(radio).toBeVisible();
        await radio.check();
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
        for (const displayName of displayNames) {
            const checkbox = this.getParticipantCheckbox(displayName);
            await expect(checkbox).toBeVisible();
            await checkbox.check();
        }
    }

    /**
     * Submit the expense form
     */
    async submitForm(): Promise<void> {
        const button = this.getSubmitButton();
        await this.clickButton(button, { buttonName: 'Submit Expense' });
    }

    /**
     * Click cancel button
     */
    async clickCancel(): Promise<void> {
        const button = this.getCancelButton();
        await this.clickButton(button, { buttonName: 'Cancel' });
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
        await expect(container.getByText(`${splitTotal} / ${expenseTotal}`, { exact: true })).toBeVisible();
    }
}
