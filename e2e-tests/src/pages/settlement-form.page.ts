import {expect, Locator, Page} from '@playwright/test';
import {BasePage} from './base.page';
import {PooledTestUser} from '@splitifyd/shared';

export interface SettlementData {
    payerName: string; // Display name of who paid
    payeeName: string; // Display name of who received payment
    amount: string;
    currency: string; // Currency for the settlement
    note: string;
}

export class SettlementFormPage extends BasePage {
    constructor(page: Page, userInfo?: PooledTestUser) {
        super(page, userInfo);
    }

    // Element accessors
    getModal(): Locator {
        return this.page.getByRole('dialog');
    }

    getPayerSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: /who paid/i });
    }

    getPayeeSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: /who received the payment/i });
    }

    getAmountInput(): Locator {
        // Amount input is now a text input with inputMode="decimal" instead of type="number"
        return this.getModal().locator('input[inputMode="decimal"]').first();
    }

    getCurrencyButton(): Locator {
        // Currency selector button in the CurrencyAmountInput component
        // Look for the button that's part of the amount input (has aria-label for currency selection)
        return this.getModal().locator('button[aria-label*="currency"], button[aria-label*="Currency"]');
    }

    getNoteInput(): Locator {
        return this.getModal().getByRole('textbox', { name: /note/i });
    }

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
        return this.getModal().locator('button[aria-label="Close"]');
    }

    // Helper methods
    private async waitForDropdownOptions(dropdown: Locator, expectedCount?: number): Promise<void> {
        await expect(async () => {
            const options = await dropdown.locator('option').all();
            const optionTexts: string[] = [];

            for (const option of options) {
                const text = await option.textContent();
                if (text) optionTexts.push(text);
            }

            // Filter out placeholder options
            const realOptions = optionTexts.filter((text) => !text.toLowerCase().includes('select') && text.trim().length > 0);

            if (realOptions.length === 0) {
                throw new Error(`Dropdown not populated yet. Only found: [${optionTexts.join(', ')}]`);
            }

            if (expectedCount && realOptions.length !== expectedCount) {
                throw new Error(`Dropdown has ${realOptions.length} members but expected ${expectedCount}. Found: [${realOptions.join(', ')}]`);
            }
        }).toPass({ timeout: 5000 });
    }

    async findOptionByDisplayName(select: Locator, displayName: string): Promise<string> {
        const options = await select.locator('option').all();
        for (const option of options) {
            const text = await option.textContent();
            const value = await option.getAttribute('value');
            if (text && text.includes(displayName)) {
                return value || '';
            }
        }
        throw new Error(`Could not find option with display name: ${displayName}`);
    }

    /**
     * Wait for the settlement form to be fully ready with all members loaded
     */
    async waitForFormReady(expectedMemberCount: number): Promise<void> {
        // Wait for modal to be visible
        await expect(this.getModal()).toBeVisible();

        // Wait for both dropdowns to have the expected number of members
        const payerSelect = this.getPayerSelect();
        const payeeSelect = this.getPayeeSelect();

        // Payer dropdown should have all group members
        await this.waitForDropdownOptions(payerSelect, expectedMemberCount);

        // Payee dropdown may have all members initially, or may have one less if a payer is pre-selected
        // Check that it has at least expectedMemberCount - 1 members
        await expect(async () => {
            const options = await payeeSelect.locator('option').all();
            const optionTexts: string[] = [];

            for (const option of options) {
                const text = await option.textContent();
                if (text) optionTexts.push(text);
            }

            // Filter out placeholder options
            const realOptions = optionTexts.filter((text) => !text.toLowerCase().includes('select') && text.trim().length > 0);

            if (realOptions.length === 0) {
                throw new Error(`Payee dropdown not populated yet. Only found: [${optionTexts.join(', ')}]`);
            }

            // Payee dropdown should have at least expectedMemberCount - 1 (when payer is filtered out)
            // or expectedMemberCount (when no payer selected yet)
            if (realOptions.length < expectedMemberCount - 1) {
                throw new Error(`Payee dropdown has ${realOptions.length} members but expected at least ${expectedMemberCount - 1}. Found: [${realOptions.join(', ')}]`);
            }
        }).toPass({ timeout: 5000 });
    }

    /**
     * Submit a settlement with all required fields
     * Note: The form should already be open and ready (use openSettlementForm() and waitForFormReady() first)
     */
    async submitSettlement(settlement: SettlementData, expectedMemberCount: number): Promise<void> {
        // Verify the form is open and in create mode
        const modal = this.getModal();
        await expect(modal).toBeVisible({ timeout: 1000 });
        await expect(modal.getByRole('heading', { name: /Record Payment|Settle Up/i })).toBeVisible();

        // Verify payer dropdown has all members
        const payerSelect = this.getPayerSelect();
        const payeeSelect = this.getPayeeSelect();
        await this.waitForDropdownOptions(payerSelect, expectedMemberCount);

        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        // Set currency if not USD
        if (settlement.currency !== 'USD') {
            const currencyButton = this.getCurrencyButton();
            await currencyButton.click();

            // Select the target currency from dropdown
            const currencyOption = modal.getByRole('option', { name: settlement.currency });
            await currencyOption.click();
        }

        // Select payer by display name
        const payerValue = await this.findOptionByDisplayName(payerSelect, settlement.payerName);
        if (!payerValue) {
            throw new Error(`Could not find payer in dropdown. Looking for: ${settlement.payerName}`);
        }
        await payerSelect.selectOption(payerValue);

        // Wait for payee dropdown to be updated after payer selection
        // Note: The UI filters out the selected payer from the payee dropdown
        await expect(async () => {
            const payeeOptions = await payeeSelect.locator('option').all();
            const payeeTexts: string[] = [];
            for (const option of payeeOptions) {
                const text = await option.textContent();
                if (text) payeeTexts.push(text);
            }

            // Filter out placeholder options
            const realOptions = payeeTexts.filter((text) => !text.toLowerCase().includes('select') && text.trim().length > 0);

            // After payer selection, payee dropdown should have expectedMemberCount - 1 members
            if (realOptions.length !== expectedMemberCount - 1) {
                throw new Error(
                    `After payer selection, payee dropdown has ${realOptions.length} members but expected ${expectedMemberCount - 1}. Found: [${realOptions.join(', ')}]. Payer selected: "${settlement.payerName}"`,
                );
            }

            // Check if payee we're looking for is in the dropdown
            const hasTargetPayee = payeeTexts.some((text) => text.includes(settlement.payeeName));

            if (!hasTargetPayee) {
                throw new Error(`Payee "${settlement.payeeName}" not found in dropdown. Available options: [${payeeTexts.join(', ')}]. Payer selected: "${settlement.payerName}"`);
            }
        }).toPass({
            timeout: 10000,
            intervals: [100, 200, 500, 1000], // Try more frequently at first
        });

        // Select payee by display name
        const payeeValue = await this.findOptionByDisplayName(payeeSelect, settlement.payeeName);
        if (!payeeValue) {
            throw new Error(`Could not find payee in dropdown. Looking for: ${settlement.payeeName}`);
        }
        await payeeSelect.selectOption(payeeValue);

        // Fill amount and note
        await this.fillNumberInput(amountInput, settlement.amount);
        await this.fillPreactInput(noteInput, settlement.note);

        // Defensive check: verify the values persisted (catches real-time update bug)
        // Use polling to check that values have stabilized
        await expect(async () => {
            // Re-check form values to ensure they haven't been reset by real-time updates
            const checkAmount = await amountInput.inputValue();
            const checkNote = await noteInput.inputValue();
            // For amount, compare numeric values to handle trailing zeros (100.50 vs 100.5)
            const expectedAmount = parseFloat(settlement.amount).toString();
            const actualAmount = parseFloat(checkAmount || '0').toString();
            if (actualAmount !== expectedAmount || checkNote !== settlement.note) {
                throw new Error('Form values still changing');
            }
        }).toPass({ timeout: 500, intervals: [50, 100] });
        const currentAmount = await amountInput.inputValue();
        const currentNote = await noteInput.inputValue();
        const currentPayer = await payerSelect.inputValue();
        const currentPayee = await payeeSelect.inputValue();

        // For amount validation, compare numeric values to handle trailing zeros
        const expectedAmountNum = parseFloat(settlement.amount).toString();
        const actualAmountNum = parseFloat(currentAmount || '0').toString();
        if (actualAmountNum !== expectedAmountNum) {
            throw new Error(`Form field was reset! Expected amount "${settlement.amount}" but got "${currentAmount}". This indicates a real-time update bug where the modal resets user input.`);
        }
        if (currentNote !== settlement.note) {
            throw new Error(`Form field was reset! Expected note "${settlement.note}" but got "${currentNote}". This indicates a real-time update bug where the modal resets user input.`);
        }
        if (currentPayer !== payerValue) {
            throw new Error(`Form field was reset! Expected payer value "${payerValue}" but got "${currentPayer}". This indicates a real-time update bug where the modal resets user input.`);
        }
        if (currentPayee !== payeeValue) {
            throw new Error(`Form field was reset! Expected payee value "${payeeValue}" but got "${currentPayee}". This indicates a real-time update bug where the modal resets user input.`);
        }

        // Submit the form
        const submitButton = this.getRecordPaymentButton();
        await expect(submitButton).toBeEnabled();
        await this.clickButton(submitButton, { buttonName: 'Record Payment' });

        // Wait for modal to close with increased timeout for settlement processing
        await expect(modal).not.toBeVisible({ timeout: 5000 });

        // Wait for settlement processing to complete
        await this.waitForDomContentLoaded();
    }

    /**
     * Simplified method to fill and submit settlement form
     * Used when the form is already open and ready
     */
    async fillAndSubmitSettlement(amount: string, payeeName: string, currency: string): Promise<void> {
        const modal = this.getModal();

        // Set currency - MANDATORY, no defaults allowed
        const currencyButton = this.getCurrencyButton();
        await currencyButton.click();

        // Select the target currency from dropdown
        const currencyOption = modal.getByRole('option', { name: currency });
        await currencyOption.click();

        const amountInput = this.getAmountInput();
        await this.fillNumberInput(amountInput, amount);

        const payeeSelect = this.getPayeeSelect();
        await payeeSelect.selectOption({ label: payeeName });

        const submitButton = this.getRecordPaymentButton();
        await this.clickButton(submitButton, { buttonName: 'Record Payment' });

        // Wait for modal to close
        await expect(modal).not.toBeVisible({ timeout: 5000 });
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
    async verifyFormValues(expected: { amount: string; note: string }): Promise<void> {
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
    async updateSettlement(data: { amount: string; note: string }): Promise<void> {
        // Assert form is in update mode before updating
        const modal = this.getModal();
        await expect(modal).toBeVisible();
        await expect(modal.getByRole('heading', { name: 'Update Payment' })).toBeVisible();

        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        // Update amount
        await this.fillNumberInput(amountInput, data.amount);

        // Update note
        await this.fillPreactInput(noteInput, data.note);

        // Submit update
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
        await this.clickButton(updateButton, { buttonName: 'Update Payment' });
    }

    /**
     * Wait for modal to close
     */
    async waitForModalClosed(): Promise<void> {
        const modal = this.getModal();
        await expect(modal).not.toBeVisible({ timeout: 3000 });
    }

    /**
     * Clear and fill amount field
     */
    async clearAndFillAmount(amount: string): Promise<void> {
        const amountInput = this.getAmountInput();
        await amountInput.clear();
        await this.fillNumberInput(amountInput, amount);
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
}
