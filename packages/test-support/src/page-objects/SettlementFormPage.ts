import { GroupId } from '@billsplit-wl/shared';
import type { CurrencyISOCode } from '@billsplit-wl/shared';
import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

type ReadyOptions = {
    expectedMemberCount?: number;
    timeout?: number;
};

const MEMBER_PLACEHOLDER_PATTERN = /select/i;

/**
 * Settlement Form Page Object Model for Playwright tests
 *
 * ## Selector Strategy
 * - Single dialog invariant: only one settlement modal open at a time
 * - All selectors scoped to `getModal()` for clarity
 * - Currency listbox uses portal rendering, so accessed at page level with justification
 */
export class SettlementFormPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // Single dialog invariant: only one modal open at a time
    protected getModal(): Locator {
        return this.page.getByRole('dialog');
    }

    private getForm(): Locator {
        return this.getModal().locator('form');
    }

    protected getPayerSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: translation.settlementForm.whoPaidLabel });
    }

    protected getPayeeSelect(): Locator {
        return this.getModal().getByRole('combobox', { name: translation.settlementForm.whoReceivedPaymentLabel });
    }

    protected getAmountInput(): Locator {
        // Amount is a number input (spinbutton role)
        return this.getModal().getByRole('spinbutton');
    }

    protected getCurrencyButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.uiComponents.currencyAmountInput.selectCurrency });
    }

    protected getNoteInput(): Locator {
        return this.getModal().getByRole('textbox', { name: translation.settlementForm.noteLabel });
    }

    protected getRecordPaymentButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.settlementForm.recordSettlement });
    }

    protected getUpdatePaymentButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.settlementForm.updateSettlement });
    }

    protected getCancelButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.common.cancel });
    }

    protected getCloseButton(): Locator {
        return this.getModal().getByRole('button', { name: translation.settlementForm.closeModal });
    }

    protected getWarningMessage(): Locator {
        return this.getModal().getByRole('status');
    }

    protected getQuickSettleHeading(): Locator {
        return this.getModal().getByText(translation.settlementForm.quickSettleLabel);
    }

    protected getQuickSettleShortcutButton(pattern: string | RegExp): Locator {
        return this.getModal().getByRole('button', { name: pattern });
    }

    async navigateAndOpen(groupId: GroupId | string, options?: ReadyOptions): Promise<void> {
        await this.page.goto(`/groups/${groupId}`);

        // Wait for page to be fully loaded
        await this.page.waitForLoadState('networkidle').catch(() => {});

        // Try multiple strategies to find the Settle Up button:
        // 1. GroupActions button by accessible name (primary, semantic approach)
        // 2. BalanceSummary button (pre-fills the form with specific debt)
        const groupActionsButtonByName = this.page.getByRole('button', { name: translation.groupActions.settleUp });
        // .first(): Multiple debt buttons may exist; need any one to open form
        const balanceSummaryButton = this.page.getByRole('button', { name: new RegExp(`${translation.settlementForm.recordSettlement}.*debt`, 'i') }).first();

        let openButton = groupActionsButtonByName;

        // .first(): Responsive layout may have duplicate regions; wait for any
        await this.page.getByRole('region', { name: translation.pages.groupDetailPage.balances }).first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

        // Check if primary button is visible, fall back to balance summary button
        const nameVisible = await groupActionsButtonByName.isVisible({ timeout: 1000 }).catch(() => false);

        if (!nameVisible) {
            openButton = balanceSummaryButton;
        }

        await expect(openButton).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(openButton).toBeEnabled({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await openButton.click();
        await this.waitForReady(options);
    }

    async waitForReady(options: ReadyOptions = {}): Promise<void> {
        const { expectedMemberCount, timeout = TEST_TIMEOUTS.MODAL_TRANSITION } = options;

        await expect(this.getModal()).toBeVisible({ timeout });

        await expect(async () => {
            const amountEditable = await this.getAmountInput().isEditable();
            const payerEnabled = await this.getPayerSelect().isEnabled();
            const payeeEnabled = await this.getPayeeSelect().isEnabled();
            const noteEditable = await this.getNoteInput().isEditable();

            if (!amountEditable || !payerEnabled || !payeeEnabled || !noteEditable) {
                throw new Error('Settlement form inputs are not ready yet');
            }

            if (expectedMemberCount !== undefined) {
                const payerMembers = await this.collectMemberOptions(this.getPayerSelect());
                if (payerMembers.length < expectedMemberCount) {
                    throw new Error(`Payer list has ${payerMembers.length} members, expected at least ${expectedMemberCount}`);
                }

                const payeeMembers = await this.collectMemberOptions(this.getPayeeSelect());
                const minimumPayeeCount = Math.max(1, expectedMemberCount - 1);
                if (payeeMembers.length < minimumPayeeCount) {
                    throw new Error(`Payee list has ${payeeMembers.length} members, expected at least ${minimumPayeeCount}`);
                }
            }

            const actionButton = await this.resolvePrimaryActionButton();
            const visible = await actionButton.isVisible().catch(() => false);

            if (!visible) {
                throw new Error('Settlement form action button is not visible');
            }
        })
            .toPass({
                timeout,
                intervals: [75, 150, 250, 400],
            });

        if (expectedMemberCount !== undefined) {
            const payerMembers = await this.collectMemberOptions(this.getPayerSelect());
            if (payerMembers.length < expectedMemberCount) {
                throw new Error(`Payer list regressed to ${payerMembers.length} members after ready check`);
            }
        }
    }

    async selectCurrency(currency: CurrencyISOCode | string): Promise<void> {
        await this.waitForReady();

        const currencyButton = this.getCurrencyButton();
        await this.clickButton(currencyButton, { buttonName: 'Select currency' });

        // Currency dropdown renders via portal to document.body, so look at page level
        const currencyDropdown = this.page.getByRole('listbox');
        await expect(currencyDropdown).toBeVisible({ timeout: 3000 });

        const searchInput = currencyDropdown.getByPlaceholder(translation.uiComponents.currencyAmountInput.searchPlaceholder);
        const searchVisible = await searchInput.isVisible().catch(() => false);

        if (searchVisible) {
            await this.fillPreactInput(searchInput, currency);

            // Wait for the dropdown to filter and show the matching option, then click it
            const currencyOption = currencyDropdown.getByRole('option', { name: new RegExp(currency, 'i') });
            await expect(currencyOption).toBeVisible({ timeout: 2000 });
            await currencyOption.click();

            await expect(currencyDropdown).not.toBeVisible({ timeout: 2000 });
            return;
        }

        const currencyOption = currencyDropdown.getByRole('option', { name: new RegExp(currency, 'i') });
        await expect(currencyOption).toBeVisible({ timeout: 3000 });
        await currencyOption.click();

        await expect(async () => {
            const buttonText = await currencyButton.textContent();
            if (!buttonText || !buttonText.includes(currency)) {
                throw new Error(`Currency button does not reflect selection of ${currency}`);
            }
        })
            .toPass({ timeout: 2000 });
    }

    async expectCurrencySelectionDisplays(symbol: string, currencyCode: CurrencyISOCode | string): Promise<void> {
        const currencyButton = this.getCurrencyButton();
        await expect(currencyButton).toContainText(symbol);
        await expect(currencyButton).toContainText(currencyCode);
    }

    async fillAmount(amount: string): Promise<void> {
        await this.waitForReady();

        const input = this.getAmountInput();
        await input.fill(amount);
        await input.blur();

        await expect(async () => {
            const value = await input.inputValue();
            if (value !== amount) {
                throw new Error(`Amount input shows "${value}" instead of "${amount}"`);
            }
        })
            .toPass({ timeout: 1000 });
    }

    async expectAmountValue(value: string): Promise<void> {
        await expect(this.getAmountInput()).toHaveValue(value);
    }

    async fillNote(note: string): Promise<void> {
        await this.waitForReady();
        const noteInput = this.getNoteInput();
        await this.fillPreactInput(noteInput, note);
        await expect(noteInput).toHaveValue(note);
    }

    async clearAndFillAmount(amount: string): Promise<void> {
        await this.waitForReady();

        const input = this.getAmountInput();
        await input.fill(amount);
        await input.blur();
        await expect(input).toHaveValue(amount, { timeout: 2000 });
    }

    async selectPayer(payerName: string): Promise<void> {
        await this.waitForReady();

        const payerSelect = this.getPayerSelect();
        await expect(async () => {
            const options = await this.collectMemberOptions(payerSelect);
            if (!options.some((option) => option.includes(payerName))) {
                throw new Error(`Payer "${payerName}" not available in dropdown: [${options.join(', ')}]`);
            }
        })
            .toPass({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const value = await this.findOptionValue(payerSelect, payerName);

        // Use evaluate to set value and trigger events for Preact compatibility
        await payerSelect.evaluate((el: HTMLSelectElement, newValue: string) => {
            el.value = newValue;
            // Dispatch both input and change events to ensure Preact handles it
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);

        // Wait for Preact to re-render the payee dropdown with updated filter
        // The payee dropdown filters out the selected payer, so it needs time to update
        await this.page.waitForTimeout(100);
    }

    async selectPayee(payeeName: string): Promise<void> {
        await this.waitForReady();

        const payeeSelect = this.getPayeeSelect();
        await expect(async () => {
            const options = await this.collectMemberOptions(payeeSelect);
            if (!options.some((option) => option.includes(payeeName))) {
                throw new Error(`Payee "${payeeName}" not available in dropdown: [${options.join(', ')}]`);
            }
        })
            .toPass({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });

        const value = await this.findOptionValue(payeeSelect, payeeName);

        // Use evaluate to set value and trigger events for Preact compatibility
        await payeeSelect.evaluate((el: HTMLSelectElement, newValue: string) => {
            el.value = newValue;
            // Dispatch both input and change events to ensure Preact handles it
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
    }

    async fillAndSubmitSettlement(payeeName: string, amount: string, currency: CurrencyISOCode | string, note?: string): Promise<void> {
        await this.waitForReady();

        await this.selectCurrency(currency);
        await this.fillAmount(amount);
        await this.selectPayee(payeeName);

        if (note) {
            await this.fillNote(note);
        }

        await this.clickSubmitButton();
        await this.waitForModalClosed();
    }

    async expectSubmitDisabled(): Promise<void> {
        const button = await this.resolvePrimaryActionButton();
        await expect(button).toBeDisabled();
    }

    async expectSubmitEnabled(): Promise<void> {
        const button = await this.resolvePrimaryActionButton();
        await expect(button).toBeEnabled();
    }

    async clickSubmitButton(): Promise<void> {
        await this.waitForReady();

        const button = await this.resolvePrimaryActionButton();
        const name = (await button.textContent())?.trim() || 'Submit settlement';
        await this.clickButton(button, { buttonName: name });
    }

    async waitForModalClosed(): Promise<void> {
        await expect(this.getModal()).not.toBeVisible({ timeout: 3000 });
    }

    async expectModalClosed(): Promise<void> {
        await expect(this.getModal()).not.toBeVisible();
    }

    async clickCloseButton(): Promise<void> {
        const closeButton = this.getCloseButton();
        await expect(closeButton).toBeVisible();
        await closeButton.click();
        await this.waitForModalClosed();
    }

    async setDate(value: string): Promise<void> {
        await this.waitForReady();
        const dateInput = this.getModal().getByLabel(translation.settlementForm.dateLabel);
        await dateInput.fill(value);
        await dateInput.blur();
        await expect(dateInput).toHaveValue(value);
    }

    async requestSubmit(): Promise<void> {
        await this.waitForReady();
        const form = this.getForm();
        await expect(form).toBeVisible();
        await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
        await this.waitForDomContentLoaded();
    }

    async expectValidationErrorContains(text: string): Promise<void> {
        const error = this.getModal().getByRole('alert');
        await expect(error).toBeVisible();
        await expect(error).toContainText(text);
    }

    async submitExpectValidationError(text: string): Promise<void> {
        await this.requestSubmit();
        await this.expectValidationErrorContains(text);
    }

    async closeModal(): Promise<void> {
        const closeButton = this.getCloseButton();
        const cancelButton = this.getCancelButton();

        if (await closeButton.isVisible().catch(() => false)) {
            await closeButton.click();
        } else if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
        }

        await this.waitForModalClosed();
    }

    async verifyModalVisible(options?: { timeout?: number; }): Promise<void> {
        const { timeout = TEST_TIMEOUTS.MODAL_TRANSITION } = options || {};
        await expect(this.getModal()).toBeVisible({ timeout });
    }

    async verifyModalNotVisible(): Promise<void> {
        await expect(this.getModal()).not.toBeVisible();
    }

    async verifyRecordSettlementMode(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
        await expect(this.getModal().getByRole('heading', { name: translation.settlementForm.recordSettlement })).toBeVisible();
    }

    async verifyUpdateMode(): Promise<void> {
        await expect(this.getModal()).toBeVisible();
        await expect(this.getModal().getByRole('heading', { name: translation.settlementForm.updateSettlement })).toBeVisible();
    }

    async verifyFormValues(expected: { amount: string; note: string; }): Promise<void> {
        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        const expectedAmount = parseFloat(expected.amount).toString();
        await expect(amountInput).toHaveValue(expectedAmount);
        await expect(noteInput).toHaveValue(expected.note);
    }

    async updateSettlement(data: { amount: string; note: string; }): Promise<void> {
        await this.verifyUpdateMode();

        const amountInput = this.getAmountInput();
        const noteInput = this.getNoteInput();

        await amountInput.fill(data.amount);
        await amountInput.blur();

        await this.fillPreactInput(noteInput, data.note);

        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
        await this.clickButton(updateButton, { buttonName: 'Update Payment' });
    }

    async verifyUpdateButtonDisabled(): Promise<void> {
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeDisabled();
    }

    async verifyUpdateButtonEnabled(): Promise<void> {
        const updateButton = this.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
    }

    async verifyQuickSettleHeadingVisible(): Promise<void> {
        await expect(this.getQuickSettleHeading()).toBeVisible();
    }

    async verifyQuickSettleHeadingNotVisible(): Promise<void> {
        await expect(this.getQuickSettleHeading()).toHaveCount(0);
    }

    async verifyQuickSettleShortcutButtonVisible(pattern: string | RegExp): Promise<void> {
        await expect(this.getQuickSettleShortcutButton(pattern)).toBeVisible();
    }

    async verifyQuickSettleShortcutButtonNotVisible(pattern: string | RegExp): Promise<void> {
        await expect(this.getQuickSettleShortcutButton(pattern)).toHaveCount(0);
    }

    async verifyWarningMessageVisible(): Promise<void> {
        await expect(this.getWarningMessage()).toBeVisible();
    }

    async verifyWarningMessageNotVisible(): Promise<void> {
        await expect(this.getWarningMessage()).not.toBeVisible();
    }

    async verifyWarningMessageContainsText(expectedText: string): Promise<void> {
        await expect(this.getWarningMessage()).toBeVisible();
        await expect(this.getWarningMessage()).toContainText(expectedText);
    }

    protected getAmountError(): Locator {
        // .first(): Amount precision error is the first alert; form may have multiple
        return this.getModal().getByRole('alert').first();
    }

    async verifyAmountErrorContainsText(expectedText: string): Promise<void> {
        await expect(this.getAmountError()).toBeVisible();
        await expect(this.getAmountError()).toContainText(expectedText);
    }

    async verifyAmountErrorNotVisible(): Promise<void> {
        await expect(this.getAmountError()).toHaveCount(0);
    }

    /**
     * Verifies no global error messages are displayed on the form
     */
    async expectNoGlobalErrors(): Promise<void> {
        // Check that no error alerts are visible in the modal
        const alerts = this.getModal().getByRole('alert');
        await expect(alerts).toHaveCount(0);
    }

    private async resolvePrimaryActionButton(): Promise<Locator> {
        // Return whichever button is visible based on the form mode
        const recordButton = this.getRecordPaymentButton();
        const updateButton = this.getUpdatePaymentButton();

        const recordVisible = await recordButton.isVisible().catch(() => false);
        if (recordVisible) {
            return recordButton;
        }

        return updateButton;
    }

    private async collectMemberOptions(select: Locator): Promise<string[]> {
        const options = await select.locator('option').all();
        const members: string[] = [];

        for (const option of options) {
            const text = await option.textContent();
            if (!text) {
                continue;
            }

            const trimmed = text.trim();
            if (!trimmed || MEMBER_PLACEHOLDER_PATTERN.test(trimmed)) {
                continue;
            }
            members.push(trimmed);
        }

        return members;
    }

    private async findOptionValue(select: Locator, displayName: string): Promise<string> {
        const options = await select.locator('option').all();

        for (const option of options) {
            const text = await option.textContent();
            if (text && text.includes(displayName)) {
                const value = await option.getAttribute('value');
                if (value) {
                    return value;
                }
            }
        }

        throw new Error(`Unable to locate option value for display name "${displayName}"`);
    }
}
