import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';
import { createErrorContext } from '../utils/error-formatting';

// Match the ExpenseData interface from GroupDetailPage
interface ExpenseData {
    description: string;
    amount: number;
    currency: string; // Required: must be explicitly provided
    paidBy: string;
    splitType: 'equal' | 'exact' | 'percentage';
    participants?: string[]; // Optional: if not provided, selects all members
}

export class ExpenseFormPage extends BasePage {
    readonly url = '/groups/[id]/add-expense';

    constructor(page: Page) {
        super(page);
    }

    /**
     * Waits for the expense form to be fully ready with all members loaded.
     * This is called automatically by clickAddExpenseButton() so forms are always ready.
     * Note: Loading spinner check is handled in clickAddExpenseButton() before this method is called.
     * @param expectedMemberCount - The expected number of members in the group
     * @param userInfo - Optional user info for debugging
     */
    async waitForFormReady(expectedMemberCount: number, userInfo?: { displayName?: string; email?: string }): Promise<void> {
        const currentUrl = this.page.url();
        const expectedUrlPattern = /\/groups\/[a-zA-Z0-9]+\/add-expense/;
        
        // Enhanced URL check with better error reporting
        if (!currentUrl.match(expectedUrlPattern)) {
            const errorContext = createErrorContext(
                'Expense form URL validation failed - navigation to expense form likely failed',
                currentUrl,
                userInfo,
                {
                    expectedUrlPattern: '/groups/[id]/add-expense',
                    expectedMemberCount
                }
            );
            
            throw new Error(`waitForFormReady failed\n${JSON.stringify(errorContext, null, 2)}`);
        }

        // Step 1: Wait for basic page layout elements to be visible
        // Check for the expense form header
        const headerTitle = this.page.getByRole('heading', { 
            name: /Add Expense|Edit Expense|Copy Expense/i 
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
        await expect(this.page.getByText('Description')).toBeVisible();
        await expect(this.page.getByText('Amount*')).toBeVisible();
        await expect(this.page.getByText('Who paid?')).toBeVisible();
        await expect(this.page.getByText('Split between')).toBeVisible();
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

    getExpenseAmountField(): Locator {
        return this.page.locator('input[type="number"]').first();
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
    
    getEditButton(): Locator {
        return this.page.getByRole('button', { name: /edit/i });
    }

    // Split type controls
    getExactAmountsText(): Locator {
        return this.page.getByText('Exact amounts');
    }

    getSelectAllButton(): Locator {
        return this.page.getByRole('button', { name: 'Select all' });
    }

    getInputWithMinValue(minValue: string): Locator {
        return this.page.locator(`input[min="${minValue}"]`);
    }

    // Form actions
    async fillDescription(description: string): Promise<void> {
        await this.fillPreactInput(this.getDescriptionInput(), description);
    }

    async fillAmount(amount: string): Promise<void> {
        await this.fillPreactInput(this.getAmountInput(), amount);
    }

    async selectAllParticipants(): Promise<void> {
        await this.getSelectAllButton().click();
    }

    async switchToExactAmounts(): Promise<void> {
        await this.getExactAmountsText().click();
    }

    /**
     * Clicks the save expense button and waits for any spinner to disappear.
     * This properly handles the async save operation.
     */
    async clickSaveExpenseButton(): Promise<void> {
        const saveButton = this.getSaveExpenseButton();

        // Wait for button to be enabled
        await expect(saveButton).toBeEnabled({ timeout: 500 });

        // Click the button
        await this.clickButton(saveButton, { buttonName: 'Save Expense' });

        // First wait for saving state to begin - button text changes to "Saving..."
        await expect(this.page.getByRole('button', { name: 'Saving...' })).toBeVisible({ timeout: 250 });

        // Then wait for saving state to complete - button text changes back to "Save Expense"
        await expect(this.page.getByRole('button', { name: 'Saving...' })).not.toBeVisible({ timeout: 3000 });
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
    async submitExpense(expense: ExpenseData): Promise<void> {
        // Fill expense description
        await this.fillDescription(expense.description);

        // Fill amount
        await this.fillAmount(expense.amount.toString());

        // Handle currency selection
        // The currency selector is a button that shows the currency symbol
        // Get the currency button
        const currencyButton = this.page.getByRole('button', { name: /select currency/i });

        // Get the current currency from the button text
        const currentButtonText = await currencyButton.textContent();

        // Map common currency codes to their symbols
        const currencySymbols: Record<string, string> = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CAD: 'C$',
            AUD: 'A$',
        };

        const expectedSymbol = currencySymbols[expense.currency] || expense.currency;

        // Only change currency if current selection doesn't match what we need
        // Check both symbol and code since button might show either
        if (!currentButtonText?.includes(expectedSymbol) && !currentButtonText?.includes(expense.currency)) {
            // Click the currency button to open the dropdown
            await currencyButton.click();

            // Wait for the dropdown to open
            const searchInput = this.page.getByPlaceholder('Search by symbol, code, or country...');
            await expect(searchInput).toBeVisible();

            // Type the currency code to filter the list
            await searchInput.fill(expense.currency);

            // Wait a moment for the search to filter results
            // Look for a button that contains the currency code
            // The format is "symbol CODE name" e.g., "€ EUR Euro"
            const currencyOption = this.page
                .locator('button')
                .filter({
                    hasText: expense.currency, // Just look for the currency code anywhere in the text
                })
                .first();

            // Wait for it to be visible and click it
            await expect(currencyOption).toBeVisible({ timeout: 3000 });
            await currencyOption.click();

            // Wait for dropdown to close
            await expect(searchInput).not.toBeVisible();
        }

        // Select who paid - find the payer radio button by display name
        const payerLabel = this.page
            .locator('label')
            .filter({
                has: this.page.locator('input[type="radio"][name="paidBy"]'),
            })
            .filter({
                hasText: expense.paidBy,
            })
            .first();

        await expect(payerLabel).toBeVisible();
        await payerLabel.click();

        // Handle split type
        if (expense.splitType === 'equal') {
            // For equal split, click "Select all" to ensure all members are selected
            await this.selectAllParticipants();
        } else if (expense.splitType === 'exact') {
            // Switch to exact amounts
            await this.switchToExactAmounts();
            // Additional logic for exact amounts would go here if needed
        }
        // Note: percentage split would need additional implementation

        // Save the expense
        await this.clickSaveExpenseButton();

        // Wait for navigation back to group page
        await this.page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);

        // Verify expense was created by checking it appears in the list
        await expect(this.page.getByText(expense.description)).toBeVisible();

        // Wait for page to stabilize after expense creation
        await this.page.waitForLoadState('domcontentloaded');
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

    getExpenseAmount(amount: string) {
        return this.page.getByText(amount);
    }

    getExpensePaidByText() {
        return this.page.getByText(/paid by|Paid:/i);
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
    
    getExpenseHeadingWithAmount(pattern: RegExp) {
        return this.page.getByRole('heading', { name: pattern });
    }

    async clickSelectAllButton() {
        const selectAllButton = this.page.getByRole('button', { name: 'Select all' });
        await this.clickButton(selectAllButton, { buttonName: 'Select all' });
    }

    async verifyExpenseInList(description: string, amount?: string) {
        await expect(this.getExpenseByDescription(description)).toBeVisible();
        if (amount) {
            await expect(this.page.getByText(amount)).toBeVisible();
        }
    }

    getExpenseByDescription(description: string) {
        // Use more specific selector to avoid strict mode violations
        // Look for the description in expense list context, not headings
        return this.page.getByText(description).first();
    }

    getCategorySelect() {
        // Category input is an actual input element with aria-haspopup
        // (not the currency selector which is a div with role=combobox)
        return this.page.locator('input[aria-haspopup="listbox"]').first();
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

    /**
     * Override the base expectSubmitButtonEnabled to provide expense-specific behavior
     * @returns Promise that resolves if button is enabled, throws error if disabled
     */
    async expectSubmitButtonEnabled(submitButton?: Locator): Promise<void> {
        const button = submitButton || this.page.getByRole('button', { name: /save expense/i });
        await this.expectButtonEnabled(button, 'Save Expense');
    }

    // Split type accessors
    getSplitSection() {
        return this.page.getByText('Split between').locator('..');
    }

    getEqualRadio() {
        return this.page.getByRole('radio', { name: 'Equal' });
    }

    getSplitBetweenText() {
        return this.page.getByText('Split between');
    }

    getExactAmountsRadio() {
        return this.page.getByRole('radio', { name: 'Exact amounts' });
    }

    getPercentageRadio() {
        return this.page.getByRole('radio', { name: 'Percentage' });
    }

    getPercentageText() {
        return this.page.getByText('Percentage', { exact: true });
    }

    getEqualText() {
        return this.page.getByText('Equal');
    }

    getExactAmountsInstructions() {
        return this.page.getByText('Enter exact amounts for each person:');
    }

    getPercentageInstructions() {
        return this.page.getByText('Enter percentage for each person:');
    }

    getExactAmountInput() {
        // Match text inputs with class w-24 for exact amounts (appears in split section)
        return this.page.locator('input.w-24[type="text"]').first();
    }

    getPercentageInput() {
        // Match text inputs with class w-20 for percentages (appears in split section)
        return this.page.locator('input.w-20[type="text"]').first();
    }

    /**
     * Get split amount inputs (for exact amounts validation)
     */
    getSplitAmountInputs(): Locator {
        return this.page.locator('input[type="number"][step]').filter({ hasText: '' });
    }

    /**
     * Get first split amount input
     */
    getFirstSplitAmountInput(): Locator {
        return this.getSplitAmountInputs().first();
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
        await targetInput.fill(amount);
    }
}
