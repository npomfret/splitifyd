import type { CurrencyISOCode, ExpenseFormData } from '@billsplit-wl/shared';
import { GroupId } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

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

    protected getAddExpenseHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.expenseFormHeader.addExpense });
    }

    protected getEditExpenseHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.expenseFormHeader.editExpense });
    }

    protected getCopyExpenseHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.expenseFormHeader.copyExpense });
    }

    // ============================================================================
    // CONTAINER SELECTORS - Find sections by their ARIA labels (semantic regions)
    // ============================================================================

    /**
     * Expense Details section - contains description, amount, currency, date, time, label
     * Uses semantic region with aria-label
     */
    private getExpenseDetailsSection(): Locator {
        return this.page.getByRole('region', { name: translation.expenseBasicFields.title });
    }

    /**
     * Who Paid section - contains payer radio buttons
     * Uses semantic region with aria-label
     */
    private getWhoPaidSection(): Locator {
        return this.page.getByRole('region', { name: translation.expenseComponents.payerSelector.label });
    }

    /**
     * Split Between section - contains participant checkboxes
     * Uses semantic region with aria-label
     */
    private getSplitBetweenSection(): Locator {
        return this.page.getByRole('region', { name: translation.expenseComponents.participantSelector.label });
    }

    /**
     * How to Split section - contains split type radios
     * Uses semantic region with aria-label
     */
    private getHowToSplitSection(): Locator {
        return this.page.getByRole('region', { name: translation.expenseComponents.splitTypeSelector.label });
    }

    // ============================================================================
    // FORM FIELD SELECTORS - Scoped to their containers
    // ============================================================================

    /**
     * Description input field (scoped to Expense Details section)
     */
    private getDescriptionInput(): Locator {
        return this.getExpenseDetailsSection().getByPlaceholder(translation.expenseBasicFields.descriptionPlaceholder);
    }

    /**
     * Amount input field (scoped to Expense Details section)
     */
    private getAmountInput(): Locator {
        return this.getExpenseDetailsSection().getByRole('spinbutton', { name: translation.expenseBasicFields.amountLabel });
    }

    /**
     * Currency select field (scoped to Expense Details section)
     */
    private getCurrencySelect(): Locator {
        return this.getExpenseDetailsSection().getByRole('button', { name: translation.uiComponents.currencyAmountInput.selectCurrency });
    }

    /**
     * Get payer dropdown trigger button (using label association)
     */
    private getPayerTrigger(): Locator {
        // Button gets its accessible name from the associated label via htmlFor/id
        return this.getWhoPaidSection().getByRole('button', { name: translation.expenseComponents.payerSelector.label });
    }

    /**
     * Get payer search input (scoped to Who Paid section, uses placeholder)
     */
    private getPayerSearchInput(): Locator {
        return this.getWhoPaidSection().getByPlaceholder(translation.expenseComponents.payerSelector.searchPlaceholder);
    }

    /**
     * Get payer option by display name (scoped to Who Paid section)
     */
    private getPayerOption(displayName: DisplayName | string): Locator {
        return this.getWhoPaidSection().getByRole('option', { name: displayName });
    }

    /**
     * Get split type radio by visible label (scoped to How to Split section)
     */
    private getSplitTypeRadio(splitTypeLabel: string): Locator {
        return this.getHowToSplitSection().getByRole('radio', { name: new RegExp(splitTypeLabel, 'i') });
    }

    // ============================================================================
    // SPLIT DISPLAY SELECTORS - Scoped by visible instruction text
    // ============================================================================

    /**
     * Equal split container - uses semantic region role
     */
    protected getEqualSplitContainer(): Locator {
        return this.page.getByRole('region', { name: translation.expenseComponents.splitAmountInputs.equalSplitRegion });
    }

    /**
     * "Each person pays:" instruction text
     */
    protected getEqualSplitInstructionText(): Locator {
        return this.page.getByText(translation.expenseComponents.splitAmountInputs.equalInstruction);
    }

    /**
     * Exact split container - scoped by "Enter exact amounts" instruction
     * Uses the instruction text to find its nearest parent Stack component
     */
    protected getExactSplitContainer(): Locator {
        // Find the instruction text and go up to its parent (the Stack component)
        // The instruction is wrapped in a <p> inside the Stack, so go up one level
        return this.page.getByText(translation.expenseComponents.splitAmountInputs.exactAmountsInstruction).locator('..');
    }

    /**
     * "Enter exact amounts for each person:" instruction text
     */
    protected getExactSplitInstructionText(): Locator {
        return this.page.getByText(translation.expenseComponents.splitAmountInputs.exactAmountsInstruction);
    }

    /**
     * All split amount inputs for EXACT split type (scoped to exact split container)
     * Uses inputMode='decimal' to target only the amount inputs, not date or other text inputs
     */
    protected getExactSplitInputs(): Locator {
        return this.getExactSplitContainer().locator('input[inputmode="decimal"]');
    }

    /**
     * Total text within exact split container (scoped to avoid false matches)
     */
    protected getExactSplitTotalText(): Locator {
        return this.getExactSplitContainer().getByText(translation.expenseComponents.splitAmountInputs.total);
    }

    // ============================================================================
    // BUTTON SELECTORS
    // ============================================================================

    /**
     * Submit button (Save/Create Expense)
     */
    protected getSubmitButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseForm.saveExpense });
    }

    /**
     * Cancel button - scoped to the dialog to get the footer cancel button.
     * Uses semantic role selector within the expense form dialog.
     */
    protected getCancelButton(): Locator {
        return this.page.getByRole('dialog').getByRole('button', { name: translation.expenseComponents.expenseFormModal.cancel });
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
        return this.page.getByRole('button', { name: translation.expenseForm.updateExpense });
    }

    /**
     * Create Copy button (copy mode)
     */
    protected getCreateCopyButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseComponents.expenseFormModal.createCopy });
    }

    /**
     * Select all participants button.
     */
    protected getSelectAllButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseComponents.participantSelector.selectAll });
    }

    /**
     * Convenience date buttons.
     */
    protected getTodayButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseBasicFields.today });
    }

    protected getYesterdayButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseBasicFields.yesterday });
    }

    protected getLastNightButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseBasicFields.lastNight });
    }

    /**
     * Date input field - uses label for semantic selection
     */
    protected getDateInput(): Locator {
        return this.getExpenseDetailsSection().getByLabel(translation.expenseBasicFields.dateLabel);
    }

    /**
     * Clock icon button to open time picker - uses aria-label for semantic selection
     */
    protected getClockIcon(): Locator {
        return this.page.getByRole('button', { name: translation.expenseBasicFields.addSpecificTime });
    }

    /**
     * Time-related selectors.
     */
    protected getTimeButton(): Locator {
        // Use character class [AP]M instead of conditional regex (AM|PM)
        return this.page.getByRole('button', { name: /at \d{1,2}:\d{2} [AP]M/i });
    }

    protected getTimeInput(): Locator {
        return this.page.getByPlaceholder(translation.uiComponents.timeInput.placeholder);
    }

    protected getTimeSuggestion(time: string): Locator {
        // The suggestions are siblings of the input within the same parent container
        // Use page-level search but this helps us ensure we're in the right context
        return this.page.getByRole('button', { name: time, exact: true });
    }

    /**
     * Currency search input - the search field inside the currency dropdown.
     */
    protected getCurrencySearchInput(): Locator {
        return this.page.getByPlaceholder(translation.uiComponents.currencyAmountInput.searchPlaceholder);
    }

    /**
     * Labels input field (combobox for MultiLabelInput).
     * Scoped to expense details section. .first() used because currency dropdown
     * also renders a combobox - labels input appears first in DOM order.
     */
    protected getLabelsInput(): Locator {
        return this.getExpenseDetailsSection().getByRole('combobox').first();
    }

    /**
     * Get all selected label chips - identified by their remove buttons
     * Each chip has a "Remove {label}" button, so we can count/find chips by their buttons
     */
    protected getSelectedLabelChips(): Locator {
        // Find all remove buttons (which identify chips) within the expense details section
        return this.getExpenseDetailsSection().getByRole('button', { name: /^Remove /i });
    }

    /**
     * Get a specific label chip by its text
     * The chip contains the label text and has a remove button as a child
     */
    protected getLabelChip(labelText: string): Locator {
        // Find element containing the label text that also has a remove button (distinguishes from dropdown options)
        return this.getExpenseDetailsSection().getByText(labelText, { exact: true }).filter({
            has: this.page.getByRole('button', { name: `Remove ${labelText}` }),
        });
    }

    /**
     * Get the remove button for a specific label chip
     */
    protected getLabelChipRemoveButton(labelText: string): Locator {
        return this.getExpenseDetailsSection().getByRole('button', { name: `Remove ${labelText}` });
    }

    /**
     * Get the labels dropdown suggestions
     */
    protected getLabelsDropdown(): Locator {
        return this.getExpenseDetailsSection().getByRole('listbox');
    }

    /**
     * Get a suggestion option in the labels dropdown
     */
    protected getLabelSuggestion(labelText: string): Locator {
        return this.getLabelsDropdown().getByRole('option', { name: labelText });
    }

    /**
     * Get the "max labels reached" indicator
     * Uses regex to match dynamic number from expenseDetails.labels.maxReached translation
     */
    protected getMaxLabelsIndicator(): Locator {
        return this.getExpenseDetailsSection().getByText(/Max \d+ labels/);
    }

    /**
     * Get the labels hint text (e.g., "0/3 labels")
     * Uses regex to match dynamic numbers from expenseDetails.labels.hint translation
     */
    protected getLabelsHintText(): Locator {
        return this.getExpenseDetailsSection().getByText(/\d+\/\d+ labels/);
    }

    /**
     * Legacy alias for getLabelsInput (for backward compatibility in tests)
     * @deprecated Use getLabelsInput() instead
     */
    protected getLabelInput(): Locator {
        return this.getLabelsInput();
    }

    /**
     * Expense Details heading (used for blur actions).
     */
    private getExpenseDetailsHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.expenseBasicFields.title });
    }

    /**
     * Split Between heading.
     */
    protected getSplitBetweenHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.expenseComponents.participantSelector.label });
    }

    /**
     * Split options container/card - uses test ID for reliability
     */
    protected getSplitOptionsCard(): Locator {
        return this.getSplitBetweenSection();
    }

    protected getSplitOptionsFirstCheckbox(): Locator {
        // Scoped to split options card. .first() gets the "Select All" checkbox.
        return this.getSplitOptionsCard().getByRole('checkbox').first();
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    /**
     * Navigate to the add expense page for a group
     */
    async navigateToAddExpense(groupId: GroupId | string): Promise<void> {
        await this.page.goto(`/groups/${groupId}/add-expense`, { waitUntil: 'domcontentloaded' });
        await this.waitForPageToLoad('add');
    }

    /**
     * Wait for the expense form page to load
     * @param mode - The expected form mode: 'add', 'edit', or 'copy'
     */
    async waitForPageToLoad(mode: 'add' | 'edit' | 'copy'): Promise<void> {
        const heading = mode === 'add'
            ? this.getAddExpenseHeading()
            : mode === 'edit'
            ? this.getEditExpenseHeading()
            : this.getCopyExpenseHeading();
        await expect(heading).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
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

    async expectCurrencySelectionDisplays(symbol: string, currencyCode: CurrencyISOCode): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toContainText(symbol);
        await expect(currencyButton).toContainText(currencyCode);
    }

    /**
     * Verify the currently selected currency code
     */
    async verifyCurrencySelected(currencyCode: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toContainText(currencyCode);
    }

    /**
     * Verify a currency is available in the dropdown (can be selected)
     */
    async verifyCurrencyAvailable(currencyCode: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toBeVisible();

        const searchInput = this.getCurrencySearchInput();

        // Open dropdown
        await expect(async () => {
            await currencyButton.click();
            await expect(searchInput).toBeVisible({ timeout: 500 });
        })
            .toPass({ timeout: 5000, intervals: [100, 250, 500, 1000] });

        // Search for the currency
        await this.fillPreactInput(searchInput, currencyCode);

        // Verify option is visible
        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
        await expect(currencyOption).toBeVisible({ timeout: 2000 });

        // Close dropdown by clicking on description input (outside the dropdown)
        // Don't use Escape as it closes the entire modal
        const descriptionInput = this.getDescriptionInput();
        await descriptionInput.click();
        await expect(searchInput).not.toBeVisible({ timeout: 2000 });
    }

    /**
     * Verify a currency is NOT available in the dropdown (restricted)
     */
    async verifyCurrencyNotAvailable(currencyCode: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toBeVisible();

        const searchInput = this.getCurrencySearchInput();

        // Open dropdown
        await expect(async () => {
            await currencyButton.click();
            await expect(searchInput).toBeVisible({ timeout: 500 });
        })
            .toPass({ timeout: 5000, intervals: [100, 250, 500, 1000] });

        // Search for the currency
        await this.fillPreactInput(searchInput, currencyCode);

        // Verify option is NOT visible (or shows "no results")
        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
        await expect(currencyOption).not.toBeVisible({ timeout: 2000 });

        // Close dropdown by clicking on description input (outside the dropdown)
        // Don't use Escape as it closes the entire modal
        const descriptionInput = this.getDescriptionInput();
        await descriptionInput.click();
        await expect(searchInput).not.toBeVisible({ timeout: 2000 });
    }

    async expectFormOpen(): Promise<void> {
        await expect(this.page.getByRole('form')).toBeVisible();
    }

    async expectFormClosed(): Promise<void> {
        await expect(this.page.getByRole('dialog')).not.toBeVisible();
    }

    /**
     * Select a currency
     * Note: Currency is a custom dropdown (button + listbox), not a native select
     */
    async selectCurrency(currencyCode: CurrencyISOCode | string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toBeVisible();

        const searchInput = this.getCurrencySearchInput();

        // Click button and wait for dropdown to open (retry if needed due to focus timing)
        await expect(async () => {
            // Click to open the currency dropdown
            await currencyButton.click();
            // Verify dropdown opened
            await expect(searchInput).toBeVisible({ timeout: 500 });
        })
            .toPass({ timeout: 5000, intervals: [100, 250, 500, 1000] });

        // Type to filter currencies
        await this.fillPreactInput(searchInput, currencyCode);

        // Wait for the dropdown to filter and show the matching option, then click it
        const currencyOption = this.page.getByRole('option', { name: new RegExp(currencyCode, 'i') });
        await expect(currencyOption).toBeVisible({ timeout: 2000 });
        await currencyOption.click();

        // Wait for dropdown to close
        await expect(searchInput).not.toBeVisible({ timeout: 2000 });
    }

    /**
     * Select who paid by display name (what user sees on screen)
     * Uses the dropdown payer selector UI
     */
    async selectPayer(displayName: DisplayName | string): Promise<void> {
        const trigger = this.getPayerTrigger();
        await expect(trigger).toBeVisible();

        // Open the dropdown
        await this.clickButton(trigger, { buttonName: 'Payer selector' });

        // Wait for search input to be visible (dropdown is open)
        const searchInput = this.getPayerSearchInput();
        await expect(searchInput).toBeVisible({ timeout: 2000 });

        // Type to filter (optional but helps with long member lists)
        await this.fillPreactInput(searchInput, displayName);

        // Click the matching option
        const option = this.getPayerOption(displayName);
        await expect(option).toBeVisible({ timeout: 2000 });
        await option.click();

        // Verify dropdown closed and selection was made
        await expect(searchInput).not.toBeVisible({ timeout: 2000 });
        await expect(trigger).toContainText(displayName);
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
    async selectSpecificParticipants(participantNames: string[]): Promise<void> {
        const allLabels = this.getSplitBetweenSection().locator('label');
        // .first(): Wait for any participant label to be visible before iterating
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

            const shouldBeChecked = participantNames.some((participant) => text.includes(participant));
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

        const unfoundParticipants = participantNames.filter(
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
     * Click the Save/Submit button and wait for form to close (modal dismisses or page navigates).
     */
    async clickSaveExpenseButton(): Promise<void> {
        const saveButton = this.getSubmitButton();
        await expect(saveButton).toBeEnabled({ timeout: 500 });
        await this.clickButton(saveButton, { buttonName: 'Save Expense' });
        // Wait for the expense form modal to close (it's no longer a page navigation)
        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
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
     * Works with both modal-based forms (new) and page-based forms (legacy).
     */
    async submitExpense(expense: ExpenseFormData): Promise<void> {
        // Wait for form to be visible (either modal or page-based)
        await expect(this.getDescriptionInput()).toBeVisible({ timeout: 3000 });

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

        // After modal closes, verify we're on the group detail page and expense is visible
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
        const labelInput = this.getLabelsInput();
        await this.fillPreactInput(labelInput, text);
    }

    /**
     * Add a label by typing it and pressing Enter
     */
    async addLabelByTyping(labelText: string): Promise<void> {
        const input = this.getLabelsInput();
        await input.click();
        await input.fill(labelText);
        await input.press('Enter');
        // Wait for chip to appear
        await expect(this.getLabelChip(labelText)).toBeVisible({ timeout: 2000 });
    }

    /**
     * Add a label by selecting it from the suggestions dropdown
     */
    async addLabelFromSuggestions(labelText: string): Promise<void> {
        const input = this.getLabelsInput();
        await input.click();
        // Wait for dropdown to open
        await expect(this.getLabelsDropdown()).toBeVisible({ timeout: 2000 });
        // Click the suggestion
        await this.getLabelSuggestion(labelText).click();
        // Wait for chip to appear
        await expect(this.getLabelChip(labelText)).toBeVisible({ timeout: 2000 });
    }

    /**
     * Remove a label by clicking its X button
     */
    async removeLabel(labelText: string): Promise<void> {
        await this.getLabelChipRemoveButton(labelText).click();
        // Wait for chip to disappear
        await expect(this.getLabelChip(labelText)).not.toBeVisible({ timeout: 2000 });
    }

    /**
     * Focus the labels input to open the dropdown.
     * Blurs then focuses to ensure onFocus is triggered.
     */
    async focusLabelsInput(): Promise<void> {
        const input = this.getLabelsInput();
        // Blur first to ensure focus event fires when we click
        await input.blur();
        await input.click();
        // Wait for dropdown to open
        await expect(this.getLabelsDropdown()).toBeVisible({ timeout: 2000 });
    }

    /**
     * Get the count of selected labels
     */
    async getSelectedLabelsCount(): Promise<number> {
        return this.getSelectedLabelChips().count();
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
        // Wait for the expense form modal to close after successful update
        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
    }

    async clickCreateCopyButton(): Promise<void> {
        const createCopyButton = this.getCreateCopyButton();
        await expect(createCopyButton).toBeVisible({ timeout: 2000 });
        await createCopyButton.click();
        // Wait for the expense form modal to close after successful copy creation
        await expect(this.page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
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
        // Use character class [AP]M instead of conditional regex (AM|PM)
        const allSuggestions = await this.page.getByRole('button').filter({ hasText: /\d{1,2}:\d{2}\s*[AP]M/i }).allTextContents();
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
     * @param mode - The expected form mode: 'add', 'edit', or 'copy'
     */
    async verifyPageLoaded(mode: 'add' | 'edit' | 'copy'): Promise<void> {
        const heading = mode === 'add'
            ? this.getAddExpenseHeading()
            : mode === 'edit'
            ? this.getEditExpenseHeading()
            : this.getCopyExpenseHeading();
        await expect(heading).toBeVisible();
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
        // .first(): Amount may appear multiple times in split container
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
        const headerTitle = this.page.getByRole('heading', { name: translation.expenseFormHeader.copyExpense });
        await expect(headerTitle).toBeVisible({ timeout: 3000 });
    }

    async verifyPreFilledValues(expectedValues: { description?: string; amount?: string; labels?: string[]; }): Promise<void> {
        if (expectedValues.description) {
            await expect(this.getDescriptionInput()).toHaveValue(expectedValues.description);
        }

        if (expectedValues.amount) {
            await expect(this.getAmountInput()).toHaveValue(expectedValues.amount);
        }

        if (expectedValues.labels && expectedValues.labels.length > 0) {
            for (const label of expectedValues.labels) {
                await expect(this.getLabelChip(label)).toBeVisible();
            }
        }
    }

    // ============================================================================
    // LABEL VERIFICATION METHODS
    // ============================================================================

    /**
     * Verify a specific label is selected (chip is visible)
     */
    async verifyLabelSelected(labelText: string): Promise<void> {
        await expect(this.getLabelChip(labelText)).toBeVisible();
    }

    /**
     * Verify a specific label is NOT selected
     */
    async verifyLabelNotSelected(labelText: string): Promise<void> {
        await expect(this.getLabelChip(labelText)).not.toBeVisible();
    }

    /**
     * Verify the count of selected labels
     */
    async verifySelectedLabelsCount(expectedCount: number): Promise<void> {
        const chips = this.getSelectedLabelChips();
        await expect(chips).toHaveCount(expectedCount);
    }

    /**
     * Verify no labels are selected (empty state)
     */
    async verifyNoLabelsSelected(): Promise<void> {
        await this.verifySelectedLabelsCount(0);
    }

    /**
     * Verify the labels dropdown is visible
     */
    async verifyLabelsDropdownVisible(): Promise<void> {
        await expect(this.getLabelsDropdown()).toBeVisible();
    }

    /**
     * Verify the labels dropdown is not visible
     */
    async verifyLabelsDropdownNotVisible(): Promise<void> {
        await expect(this.getLabelsDropdown()).not.toBeVisible();
    }

    /**
     * Verify a suggestion is visible in the labels dropdown
     */
    async verifyLabelSuggestionVisible(labelText: string): Promise<void> {
        await expect(this.getLabelSuggestion(labelText)).toBeVisible();
    }

    /**
     * Verify a suggestion is NOT visible in the labels dropdown (filtered out or already selected)
     */
    async verifyLabelSuggestionNotVisible(labelText: string): Promise<void> {
        await expect(this.getLabelSuggestion(labelText)).not.toBeVisible();
    }

    /**
     * Verify the "max labels reached" indicator is visible
     */
    async verifyMaxLabelsIndicatorVisible(): Promise<void> {
        await expect(this.getMaxLabelsIndicator()).toBeVisible();
    }

    /**
     * Verify the labels input is visible (can add more labels)
     */
    async verifyLabelsInputVisible(): Promise<void> {
        await expect(this.getLabelsInput()).toBeVisible();
    }

    /**
     * Verify the labels input is NOT visible (max labels reached)
     */
    async verifyLabelsInputNotVisible(): Promise<void> {
        await expect(this.getLabelsInput()).not.toBeVisible();
    }

    /**
     * Verify the hint text shows expected count (e.g., "2/3 labels")
     */
    async verifyLabelsHintText(expectedText: string): Promise<void> {
        await expect(this.getLabelsHintText()).toContainText(expectedText);
    }

    /**
     * Verify labels error message is displayed
     */
    async verifyLabelsErrorMessageContains(text: string): Promise<void> {
        // FieldError renders with role='alert' - filter by expected text
        const errorMessage = this.getExpenseDetailsSection().getByRole('alert').filter({ hasText: text });
        await expect(errorMessage).toBeVisible();
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

    /**
     * Verify the time button (shown when time is set, before editing) is visible
     * TimeInput shows a button with "at {time}" when not editing
     */
    async verifyTimeFieldVisible(): Promise<void> {
        // TimeInput shows either a button (display mode) or input (edit mode)
        // In display mode it shows "at {time}", in edit mode it shows an input
        const timeButton = this.getTimeButton();
        const timeInput = this.getTimeInput();
        // Either should be visible when time field is shown
        const buttonVisible = await timeButton.isVisible().catch(() => false);
        const inputVisible = await timeInput.isVisible().catch(() => false);
        expect(buttonVisible || inputVisible).toBe(true);
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
        // FieldError renders with role='alert' - filter by expected text
        const errorMessage = this.getExpenseDetailsSection().getByRole('alert').filter({ hasText: text });
        await expect(errorMessage).toBeVisible();
    }

    async verifyDescriptionErrorMessageContains(text: string): Promise<void> {
        // Use semantic selector - filter by expected text to handle multiple alerts
        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
        await expect(errorMessage).toBeVisible();
    }

    async verifyDescriptionEmpty(): Promise<void> {
        await expect(this.getDescriptionInput()).toHaveValue('');
    }

    async verifyDateErrorMessageContains(text: string): Promise<void> {
        // Use semantic selector - filter by expected text to handle multiple alerts
        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
        await expect(errorMessage).toBeVisible();
    }

    async verifySplitErrorMessageContains(text: string): Promise<void> {
        // Use semantic selector - filter by expected text to handle multiple alerts
        const errorMessage = this.page.getByRole('alert').filter({ hasText: text });
        await expect(errorMessage).toBeVisible();
    }

    async verifyCancelButtonVisible(): Promise<void> {
        await expect(this.getCancelButton()).toBeVisible();
    }

    /**
     * Verify that the expense form modal is still open.
     * Useful for checking that the form remains open after a submission error.
     */
    async verifyFormModalOpen(): Promise<void> {
        await expect(this.page.getByRole('dialog')).toBeVisible();
    }

    /**
     * Verify that a form submission error is displayed.
     * The ErrorState component shows "Something went wrong" by default with role='alert'.
     */
    async verifySubmissionErrorDisplayed(): Promise<void> {
        await expect(this.page.getByRole('alert')).toBeVisible({ timeout: 5000 });
    }

    /**
     * Verify that the error title contains specific text.
     */
    async verifyErrorTitleContains(text: string): Promise<void> {
        const errorAlert = this.page.getByRole('alert');
        await expect(errorAlert).toBeVisible({ timeout: 5000 });
        await expect(errorAlert).toContainText(text);
    }

    // ============================================================================
    // RECENT AMOUNTS
    // ============================================================================

    /**
     * Get the recent amounts section
     */
    protected getRecentAmountsSection(): Locator {
        return this.getExpenseDetailsSection().getByText(translation.expenseBasicFields.recentAmounts).locator('..');
    }

    /**
     * Get a recent amount button by its displayed text (e.g., "$50.00 USD")
     */
    protected getRecentAmountButton(amountText: string): Locator {
        return this.getRecentAmountsSection().getByRole('button', { name: amountText });
    }

    /**
     * Verify recent amounts section is visible
     */
    async verifyRecentAmountsSectionVisible(): Promise<void> {
        await expect(this.getRecentAmountsSection()).toBeVisible();
    }

    /**
     * Verify recent amounts section is not visible
     */
    async verifyRecentAmountsSectionNotVisible(): Promise<void> {
        await expect(this.page.getByText(translation.expenseBasicFields.recentAmounts)).not.toBeVisible();
    }

    /**
     * Click a recent amount button
     */
    async clickRecentAmount(amountText: string): Promise<void> {
        const button = this.getRecentAmountButton(amountText);
        await expect(button).toBeVisible();
        await button.click();
    }

    /**
     * Verify the count of recent amount buttons
     */
    async verifyRecentAmountCount(expectedCount: number): Promise<void> {
        const buttons = this.getRecentAmountsSection().getByRole('button');
        await expect(buttons).toHaveCount(expectedCount);
    }

    // ============================================================================
    // LOCATION
    // ============================================================================

    /**
     * Location input field (scoped to Expense Details section)
     * Uses regex to match any of the rotating placeholder texts
     */
    protected getLocationInput(): Locator {
        const placeholders = translation.expenseBasicFields.locationPlaceholders;
        const placeholderPattern = new RegExp(`^(${placeholders.map((p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
        return this.getExpenseDetailsSection().getByPlaceholder(placeholderPattern);
    }

    /**
     * Recent locations section
     */
    protected getRecentLocationsSection(): Locator {
        return this.getExpenseDetailsSection().getByText(translation.expenseBasicFields.recentLocations).locator('..');
    }

    /**
     * A recent location button by its displayed name
     */
    protected getRecentLocationButton(locationName: string): Locator {
        return this.getRecentLocationsSection().getByRole('button', { name: locationName });
    }

    /**
     * Clear location button
     */
    protected getClearLocationButton(): Locator {
        return this.getExpenseDetailsSection().getByRole('button', { name: translation.expenseBasicFields.clearLocation });
    }

    /**
     * Fill the location field
     */
    async fillLocation(location: string): Promise<void> {
        await this.fillPreactInput(this.getLocationInput(), location);
    }

    /**
     * Click a recent location button
     */
    async clickRecentLocation(locationName: string): Promise<void> {
        const button = this.getRecentLocationButton(locationName);
        await expect(button).toBeVisible();
        await button.click();
    }

    /**
     * Clear the location field
     */
    async clearLocation(): Promise<void> {
        const clearButton = this.getClearLocationButton();
        await expect(clearButton).toBeVisible();
        await clearButton.click();
    }

    /**
     * Verify location input is visible
     */
    async verifyLocationInputVisible(): Promise<void> {
        await expect(this.getLocationInput()).toBeVisible();
    }

    /**
     * Verify location input has a specific value
     */
    async verifyLocationValue(expectedValue: string): Promise<void> {
        await expect(this.getLocationInput()).toHaveValue(expectedValue);
    }

    /**
     * Verify location input is empty
     */
    async verifyLocationEmpty(): Promise<void> {
        await expect(this.getLocationInput()).toHaveValue('');
    }

    /**
     * Verify recent locations section is visible
     */
    async verifyRecentLocationsSectionVisible(): Promise<void> {
        await expect(this.getRecentLocationsSection()).toBeVisible();
    }

    /**
     * Verify recent locations section is not visible
     */
    async verifyRecentLocationsSectionNotVisible(): Promise<void> {
        await expect(this.page.getByText(translation.expenseBasicFields.recentLocations)).not.toBeVisible();
    }

    /**
     * Verify clear location button is visible
     */
    async verifyClearLocationButtonVisible(): Promise<void> {
        await expect(this.getClearLocationButton()).toBeVisible();
    }

    /**
     * Verify clear location button is not visible
     */
    async verifyClearLocationButtonNotVisible(): Promise<void> {
        await expect(this.getClearLocationButton()).not.toBeVisible();
    }

    /**
     * Paste text into the location field
     * Used for testing URL paste detection
     */
    async pasteIntoLocationField(text: string): Promise<void> {
        const input = this.getLocationInput();
        await input.focus();
        // Clear any existing value
        await input.clear();
        // Use keyboard shortcut to paste (triggers paste event handlers)
        await this.page.evaluate((textToPaste) => {
            const input = document.activeElement as HTMLInputElement;
            if (input) {
                // Create and dispatch a paste event with clipboard data
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: new DataTransfer(),
                });
                pasteEvent.clipboardData?.setData('text/plain', textToPaste);
                input.dispatchEvent(pasteEvent);
            }
        }, text);
    }

    /**
     * Verify the map button shows "Open on map" (indicates a URL is associated with location)
     */
    async verifyOpenOnMapButtonVisible(): Promise<void> {
        const button = this.getExpenseDetailsSection().getByRole('button', { name: translation.expenseBasicFields.openOnMap });
        await expect(button).toBeVisible();
    }

    /**
     * Verify the map button shows "Find on map" (indicates no URL is associated)
     */
    async verifyFindOnMapButtonVisible(): Promise<void> {
        const button = this.getExpenseDetailsSection().getByRole('button', { name: translation.expenseBasicFields.findOnMap });
        await expect(button).toBeVisible();
    }

    /**
     * Wait for location to finish resolving (loading state disappears)
     */
    async waitForLocationResolved(): Promise<void> {
        const input = this.getLocationInput();
        // Wait for the resolving text to disappear
        await expect(input).not.toHaveValue(translation.expenseBasicFields.resolvingLocation, { timeout: 10000 });
    }

    // ============================================================================
    // PERCENTAGE SPLITS
    // ============================================================================

    /**
     * Percentage split container
     */
    protected getPercentageSplitContainer(): Locator {
        return this.page.getByText(translation.expenseComponents.splitAmountInputs.percentageInstruction).locator('..');
    }

    /**
     * "Enter percentage for each person:" instruction text
     */
    protected getPercentageSplitInstructionText(): Locator {
        return this.page.getByText(translation.expenseComponents.splitAmountInputs.percentageInstruction);
    }

    /**
     * All percentage input fields
     */
    protected getPercentageSplitInputs(): Locator {
        return this.getPercentageSplitContainer().locator('input[type="text"][inputmode="decimal"]');
    }

    /**
     * Verify percentage split section is visible
     */
    async verifyPercentageSplitDisplayed(): Promise<void> {
        await expect(this.getPercentageSplitInstructionText()).toBeVisible();
    }

    /**
     * Verify all percentage inputs have a specific value
     */
    async verifyPercentageSplitInputsHaveValue(value: string): Promise<void> {
        const inputs = this.getPercentageSplitInputs();
        const count = await inputs.count();
        for (let i = 0; i < count; i++) {
            await expect(inputs.nth(i)).toHaveValue(value);
        }
    }

    /**
     * Set a percentage split amount at a specific index
     */
    async setPercentageSplitAmount(index: number, value: string): Promise<void> {
        const inputs = this.getPercentageSplitInputs();
        await expect(inputs.nth(index)).toBeVisible();
        await inputs.nth(index).fill(value);
        await inputs.nth(index).blur();
    }

    /**
     * Verify percentage split total display
     */
    async verifyPercentageSplitTotal(percentageTotal: string, amountTotal: string): Promise<void> {
        const container = this.getPercentageSplitContainer();
        await expect(container).toBeVisible();
        await expect(container).toContainText(percentageTotal);
        await expect(container).toContainText(amountTotal);
    }

    /**
     * Verify percentage split input count
     */
    async verifyPercentageSplitInputCount(expectedCount: number): Promise<void> {
        const inputs = this.getPercentageSplitInputs();
        const count = await inputs.count();
        expect(count).toBe(expectedCount);
    }

    // ============================================================================
    // CONVENIENCE DATE BUTTONS
    // ============================================================================

    protected getThisMorningButton(): Locator {
        return this.page.getByRole('button', { name: translation.expenseBasicFields.thisMorning });
    }

    async clickThisMorningButton(): Promise<void> {
        await this.clickButton(this.getThisMorningButton(), { buttonName: 'This Morning' });
    }

    async verifyDateValue(expectedDate: string): Promise<void> {
        await expect(this.getDateInput()).toHaveValue(expectedDate);
    }

    /**
     * Get today's date in YYYY-MM-DD format
     */
    getTodayDateString(): string {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    /**
     * Get yesterday's date in YYYY-MM-DD format
     */
    getYesterdayDateString(): string {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    /**
     * Verify currency selector shows expected value
     */
    async verifyCurrencyValue(expectedCurrency: string): Promise<void> {
        const currencyButton = this.getCurrencySelect();
        await expect(currencyButton).toContainText(expectedCurrency);
    }

    // ============================================================================
    // RECEIPT UPLOADER
    // ============================================================================

    /**
     * Receipt section - contains file input, preview, and buttons
     * Uses semantic region with aria-label
     */
    private getReceiptSection(): Locator {
        return this.page.getByRole('region', { name: translation.receiptUploader.label });
    }

    /**
     * Add receipt button
     */
    protected getAddReceiptButton(): Locator {
        return this.getReceiptSection().getByRole('button', { name: translation.receiptUploader.addReceipt });
    }

    /**
     * Change receipt button (shown when receipt exists)
     */
    protected getChangeReceiptButton(): Locator {
        return this.getReceiptSection().getByRole('button', { name: translation.receiptUploader.changeReceipt });
    }

    /**
     * Remove receipt button (X button on preview)
     */
    protected getRemoveReceiptButton(): Locator {
        return this.getReceiptSection().getByRole('button', { name: translation.receiptUploader.removeReceipt });
    }

    /**
     * Receipt preview image
     */
    protected getReceiptPreview(): Locator {
        return this.getReceiptSection().getByRole('img', { name: translation.receiptUploader.previewAlt });
    }

    /**
     * Hidden file input for receipt
     */
    private getReceiptFileInput(): Locator {
        return this.getReceiptSection().locator('input[type="file"]');
    }

    /**
     * Receipt error message
     */
    protected getReceiptError(): Locator {
        return this.getReceiptSection().getByRole('alert');
    }

    /**
     * Loading spinner in receipt section
     */
    protected getReceiptLoadingSpinner(): Locator {
        return this.getReceiptSection().getByRole('status');
    }

    /**
     * Add a receipt by selecting a file
     * Note: Playwright can set files on hidden inputs directly
     */
    async addReceiptFile(filePath: string): Promise<void> {
        const fileInput = this.getReceiptFileInput();
        await fileInput.setInputFiles(filePath);
    }

    /**
     * Click the add receipt button (opens file picker)
     */
    async clickAddReceiptButton(): Promise<void> {
        await this.clickButton(this.getAddReceiptButton(), { buttonName: 'Add receipt' });
    }

    /**
     * Click the change receipt button (opens file picker)
     */
    async clickChangeReceiptButton(): Promise<void> {
        await this.clickButton(this.getChangeReceiptButton(), { buttonName: 'Change receipt' });
    }

    /**
     * Remove the current receipt
     * Waits for the preview image to be stable before clicking the overlaid button
     */
    async removeReceipt(): Promise<void> {
        // Wait for both the preview and button to be visible and stable
        const preview = this.getReceiptPreview();
        const button = this.getRemoveReceiptButton();
        await expect(preview).toBeVisible();
        await expect(button).toBeVisible();
        // Use a longer timeout to account for image loading/rendering
        await button.click({ timeout: 5000 });
    }

    /**
     * Verify receipt section is visible
     */
    async verifyReceiptSectionVisible(): Promise<void> {
        await expect(this.getReceiptSection()).toBeVisible();
    }

    /**
     * Verify add receipt button is visible (no receipt selected)
     */
    async verifyAddReceiptButtonVisible(): Promise<void> {
        await expect(this.getAddReceiptButton()).toBeVisible();
    }

    /**
     * Verify add receipt button is not visible (receipt is selected)
     */
    async verifyAddReceiptButtonNotVisible(): Promise<void> {
        await expect(this.getAddReceiptButton()).not.toBeVisible();
    }

    /**
     * Verify receipt preview is visible
     */
    async verifyReceiptPreviewVisible(): Promise<void> {
        await expect(this.getReceiptPreview()).toBeVisible();
    }

    /**
     * Verify receipt preview is not visible
     */
    async verifyReceiptPreviewNotVisible(): Promise<void> {
        await expect(this.getReceiptPreview()).not.toBeVisible();
    }

    /**
     * Verify change receipt button is visible
     */
    async verifyChangeReceiptButtonVisible(): Promise<void> {
        await expect(this.getChangeReceiptButton()).toBeVisible();
    }

    /**
     * Verify change receipt button is not visible
     */
    async verifyChangeReceiptButtonNotVisible(): Promise<void> {
        await expect(this.getChangeReceiptButton()).not.toBeVisible();
    }

    /**
     * Verify remove receipt button is visible
     */
    async verifyRemoveReceiptButtonVisible(): Promise<void> {
        await expect(this.getRemoveReceiptButton()).toBeVisible();
    }

    /**
     * Verify remove receipt button is not visible
     */
    async verifyRemoveReceiptButtonNotVisible(): Promise<void> {
        await expect(this.getRemoveReceiptButton()).not.toBeVisible();
    }

    /**
     * Verify receipt error message is visible
     */
    async verifyReceiptErrorVisible(): Promise<void> {
        await expect(this.getReceiptError()).toBeVisible();
    }

    /**
     * Verify receipt error message contains text
     */
    async verifyReceiptErrorContains(text: string): Promise<void> {
        await expect(this.getReceiptError()).toContainText(text);
    }

    /**
     * Verify receipt error is not visible
     */
    async verifyReceiptErrorNotVisible(): Promise<void> {
        await expect(this.getReceiptError()).not.toBeVisible();
    }

    /**
     * Verify receipt loading spinner is visible
     */
    async verifyReceiptLoadingVisible(): Promise<void> {
        await expect(this.getReceiptLoadingSpinner()).toBeVisible();
    }

    /**
     * Verify receipt loading spinner is not visible
     */
    async verifyReceiptLoadingNotVisible(): Promise<void> {
        await expect(this.getReceiptLoadingSpinner()).not.toBeVisible();
    }
}
