import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Shared base class for Settlement Form page object.
 * Contains common selectors and basic actions for settlement forms.
 * E2E tests may extend this with additional e2e-specific functionality.
 */
export class SettlementFormPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // Modal and container selectors
    getModal(): Locator {
        return this.page.getByRole('dialog');
    }

    // Protected selectors - accessible to subclasses but not exposed to tests
    protected getPayerSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: /who paid/i });
    }

    protected getPayeeSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: /who received the payment/i });
    }

    protected getAmountInput(): Locator {
        return this.getModal().locator('input[inputMode="decimal"]').first();
    }

    protected getCurrencyButton(): Locator {
        return this.getModal().locator('button[aria-label*="currency"], button[aria-label*="Currency"]');
    }

    protected getNoteInput(): Locator {
        return this.getModal().getByRole('textbox', { name: /note/i });
    }

    // Button selectors
    getRecordPaymentButton(): Locator {
        return this.getModal().getByRole('button', { name: /record payment/i });
    }

    getUpdatePaymentButton(): Locator {
        return this.getModal().getByRole('button', { name: /update payment/i });
    }

    getCancelButton(): Locator {
        return this.getModal().getByRole('button', { name: /cancel/i });
    }

    getCloseButton(): Locator {
        // The close button is in the modal header with SVG icon
        return this.getModal().locator('button[aria-label]').first();
    }

    // Navigation

    /**
     * Navigate to group page and open settlement form modal
     */
    async navigateAndOpen(groupId: string): Promise<void> {
        await this.page.goto(`/groups/${groupId}`);
        const openButton = this.page.getByRole('button', { name: /settle up/i });
        await openButton.click();
        await expect(this.getModal()).toBeVisible();
    }

    // Basic form actions

    /**
     * Select currency from the currency dropdown
     */
    async selectCurrency(currency: string): Promise<void> {
        const currencyButton = this.getCurrencyButton();
        await currencyButton.click();

        // Select the target currency from dropdown
        const currencyOption = this.getModal().getByRole('option', { name: currency });
        await currencyOption.click();
    }

    /**
     * Fill the amount field
     * Note: Using simple fill() + blur() pattern for number inputs
     * because number inputs can't be truly "cleared" to empty string - they default to 0
     */
    async fillAmount(amount: string): Promise<void> {
        const input = this.getAmountInput();
        await input.fill(amount);
        await input.blur();
    }

    /**
     * Fill the note field
     */
    async fillNote(note: string): Promise<void> {
        const noteInput = this.getNoteInput();
        await this.fillPreactInput(noteInput, note);
    }

    /**
     * Clear and fill amount field
     * Note: fill() automatically clears the input first, which should work fine
     * for number inputs as they don't trigger validation on programmatic clear
     */
    async clearAndFillAmount(amount: string): Promise<void> {
        const input = this.getAmountInput();
        await input.fill(amount);
        await input.blur();
    }

    /**
     * Select payer from the payer dropdown
     */
    async selectPayer(payerName: string): Promise<void> {
        const payerSelect = this.getPayerSelect();
        await payerSelect.selectOption({ label: payerName });
    }

    /**
     * Select payee from the payee dropdown
     */
    async selectPayee(payeeName: string): Promise<void> {
        const payeeSelect = this.getPayeeSelect();
        await payeeSelect.selectOption({ label: payeeName });
    }

    /**
     * Simplified method to fill and submit settlement form
     * Used when the form is already open and ready
     */
    async fillAndSubmitSettlement(payeeName: string, amount: string, currency: string, note?: string): Promise<void> {
        // Set currency - MANDATORY, no defaults allowed
        await this.selectCurrency(currency);

        // Fill amount
        await this.fillAmount(amount);

        // Select payee by label
        await this.selectPayee(payeeName);

        // Fill note if provided
        if (note) {
            await this.fillNote(note);
        }

        // Submit
        const submitButton = this.getRecordPaymentButton();
        await this.clickButton(submitButton, { buttonName: 'Record Payment' });

        // Wait for modal to close
        await expect(this.getModal()).not.toBeVisible({ timeout: 5000 });
    }

    /**
     * Wait for modal to close
     */
    async waitForModalClosed(): Promise<void> {
        const modal = this.getModal();
        await expect(modal).not.toBeVisible({ timeout: 3000 });
    }

    /**
     * Click the close (X) button
     */
    async clickCloseButton(): Promise<void> {
        const closeButton = this.getCloseButton();
        await closeButton.click();
    }

    /**
     * Close the modal
     */
    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        const cancelButton = this.getCancelButton();

        // Try close button first, then cancel
        if (await closeButton.isVisible()) {
            await closeButton.click();
        } else if (await cancelButton.isVisible()) {
            await cancelButton.click();
        }
    }

    /**
     * Verify the form is in update mode
     */
    async verifyUpdateMode(): Promise<void> {
        const modal = this.getModal();
        await expect(modal).toBeVisible();
        await expect(modal.getByRole('heading', { name: 'Update Payment' })).toBeVisible();
    }

    /**
     * Verify form values match expected
     */
    async verifyFormValues(expected: { amount: string; note: string; }): Promise<void> {
        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        // For amount, compare numeric values to handle trailing zeros (100.50 vs 100.5)
        const expectedAmount = parseFloat(expected.amount).toString();
        await expect(amountInput).toHaveValue(expectedAmount);
        await expect(noteInput).toHaveValue(expected.note);
    }

    /**
     * Update a settlement (form should already be in edit mode)
     */
    async updateSettlement(data: { amount: string; note: string; }): Promise<void> {
        // Assert form is in update mode before updating
        await this.verifyUpdateMode();

        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        // Update amount
        await amountInput.fill(data.amount);
        await amountInput.blur();

        // Update note
        await this.fillPreactInput(noteInput, data.note);

        // Submit update
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
        await this.clickButton(updateButton, { buttonName: 'Update Payment' });
    }

    /**
     * Verify update button is disabled
     */
    async verifyUpdateButtonDisabled(): Promise<void> {
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeDisabled();
    }

    /**
     * Verify update button is enabled
     */
    async verifyUpdateButtonEnabled(): Promise<void> {
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
    }
}
