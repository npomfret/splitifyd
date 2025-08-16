import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

interface SettlementData {
  payerName: string;  // Display name of who paid
  payeeName: string;  // Display name of who received payment
  amount: string;
  note: string;
}

export class SettlementFormPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Element accessors
  getModal(): Locator {
    return this.page.getByRole('dialog');
  }

  getSettleUpButton(): Locator {
    return this.page.getByRole('button', { name: /settle up/i });
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

  getNoteInput(): Locator {
    return this.getModal().getByRole('textbox', { name: /note/i });
  }

  getRecordPaymentButton(): Locator {
    return this.getModal().getByRole('button', { name: /record payment/i });
  }

  // Helper methods
  async waitForDropdownOptions(dropdown: Locator): Promise<void> {
    await expect(async () => {
      const options = await dropdown.locator('option').count();
      if (options <= 1) { // Only has placeholder
        throw new Error('Dropdown not populated yet');
      }
    }).toPass({ timeout: 3000 });
  }

  async waitForPayeeDropdownUpdate(payeeSelect: Locator, excludedName: string): Promise<void> {
    await expect(async () => {
      const options = await payeeSelect.locator('option').all();
      for (const option of options) {
        const text = await option.textContent();
        if (text && text.includes(excludedName)) {
          throw new Error('Payee dropdown still includes payer name');
        }
      }
    }).toPass({ timeout: 2000 });
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
   * Open the settlement form modal
   */
  async openSettlementForm(): Promise<void> {
    const settleButton = this.getSettleUpButton();
    await this.clickButton(settleButton, { buttonName: 'Settle with payment' });
    
    // Wait for modal to appear
    await expect(this.getModal()).toBeVisible();
  }

  /**
   * Submit a settlement with all required fields
   */
  async submitSettlement(settlement: SettlementData): Promise<void> {
    // Open the form if not already open
    const modal = this.getModal();
    if (!(await modal.isVisible())) {
      await this.openSettlementForm();
    }

    const payerSelect = this.getPayerSelect();
    const payeeSelect = this.getPayeeSelect();
    const amountInput = this.getAmountInput();
    const noteInput = this.getNoteInput();

    // Wait for payer dropdown to be populated
    await this.waitForDropdownOptions(payerSelect);

    // Select payer by display name
    const payerValue = await this.findOptionByDisplayName(payerSelect, settlement.payerName);
    if (!payerValue) {
      throw new Error(`Could not find payer in dropdown. Looking for: ${settlement.payerName}`);
    }
    await payerSelect.selectOption(payerValue);

    // Wait for payee dropdown to update dynamically after payer selection
    await this.waitForPayeeDropdownUpdate(payeeSelect, settlement.payerName);

    // Select payee by display name
    const payeeValue = await this.findOptionByDisplayName(payeeSelect, settlement.payeeName);
    if (!payeeValue) {
      throw new Error(`Could not find payee in dropdown. Looking for: ${settlement.payeeName}`);
    }
    await payeeSelect.selectOption(payeeValue);

    // Fill amount and note
    await this.fillPreactInput(amountInput, settlement.amount);
    await this.fillPreactInput(noteInput, settlement.note);

    // Submit the form
    const submitButton = this.getRecordPaymentButton();
    await expect(submitButton).toBeEnabled();
    await this.clickButton(submitButton, { buttonName: 'Record Payment' });

    // Wait for modal to close with increased timeout for settlement processing
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Wait for settlement processing to complete
    await this.page.waitForLoadState('domcontentloaded');
  }
}