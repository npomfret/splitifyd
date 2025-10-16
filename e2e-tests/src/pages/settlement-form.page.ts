import { expect, Locator, Page } from '@playwright/test';
import type { SettlementFormData } from '@splitifyd/shared';
import { SettlementFormPage as BaseSettlementFormPage } from '@splitifyd/test-support';

/**
 * E2E-specific SettlementFormPage extending shared base class.
 * Adds comprehensive member loading verification and real-time update handling.
 */
export class SettlementFormPage extends BaseSettlementFormPage {
    constructor(page: Page) {
        super(page);
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
        })
            .toPass({ timeout: 5000 });
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
        })
            .toPass({ timeout: 5000 });
    }

    /**
     * Submit a settlement with all required fields
     * Note: The form should already be open and ready (use openSettlementForm() and waitForFormReady() first)
     */
    async submitSettlement(settlement: SettlementFormData, expectedMemberCount: number): Promise<void> {
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

            // Brief wait for currency change to propagate
            await this.page.waitForTimeout(100);
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
                    `After payer selection, payee dropdown has ${realOptions.length} members but expected ${expectedMemberCount - 1}. Found: [${
                        realOptions.join(', ')
                    }]. Payer selected: "${settlement.payerName}"`,
                );
            }

            // Check if payee we're looking for is in the dropdown
            const hasTargetPayee = payeeTexts.some((text) => text.includes(settlement.payeeName));

            if (!hasTargetPayee) {
                throw new Error(`Payee "${settlement.payeeName}" not found in dropdown. Available options: [${payeeTexts.join(', ')}]. Payer selected: "${settlement.payerName}"`);
            }
        })
            .toPass({
                timeout: 10000,
                intervals: [100, 200, 500, 1000], // Try more frequently at first
            });

        // Select payee by display name
        const payeeValue = await this.findOptionByDisplayName(payeeSelect, settlement.payeeName);
        if (!payeeValue) {
            throw new Error(`Could not find payee in dropdown. Looking for: ${settlement.payeeName}`);
        }
        await payeeSelect.selectOption(payeeValue);

        // Fill amount and note inputs
        // Note: Use fill() instead of fillPreactInput() for amount to avoid triggering validation
        // when clearing the input. The amount input is empty after currency change, so we can
        // fill it directly without clearing.
        await amountInput.fill(settlement.amount);
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
        })
            .toPass({ timeout: 500, intervals: [50, 100] });
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

    // All other methods (fillAndSubmitSettlement, verifyUpdateMode, verifyFormValues,
    // updateSettlement, waitForModalClosed, clearAndFillAmount, verifyUpdateButtonDisabled,
    // verifyUpdateButtonEnabled, closeModal) are inherited from base class
}
