import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { BasePage } from './BasePage';
import { translationEn } from '../translations/translation-en';

/**
 * Page Object Model for the Display Name Conflict modal shown during the join group flow.
 * Encapsulates all selectors and assertions related to the modal to keep Playwright tests clean.
 */
export class DisplayNameConflictModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // PRIVATE LOCATOR HELPERS
    // ============================================================================

    private getModalContainer(): Locator {
        return this.page.locator('[role="dialog"][aria-labelledby="display-name-conflict-title"]');
    }

    private getTitle(): Locator {
        return this.page.locator('#display-name-conflict-title');
    }

    private getDescription(): Locator {
        return this.page.locator('#display-name-conflict-description');
    }

    private getDisplayNameInput(): Locator {
        return this.page.getByTestId('display-name-conflict-input');
    }

    private getSubmitButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translationEn.joinGroupPage.displayNameConflict.submit });
    }

    private getSavingButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translationEn.joinGroupPage.displayNameConflict.saving });
    }

    private getCancelButton(): Locator {
        return this.getModalContainer().getByRole('button', { name: translationEn.joinGroupPage.displayNameConflict.cancel });
    }

    private getCloseButton(): Locator {
        return this.getModalContainer().getByLabel(translationEn.common.close);
    }

    private getValidationError(): Locator {
        return this.getModalContainer().getByTestId('input-error-message');
    }

    getServerError(): Locator {
        return this.getModalContainer().getByTestId('display-name-conflict-error');
    }

    private getSavingLabel(): Locator {
        return this.getModalContainer().getByText(translationEn.joinGroupPage.displayNameConflict.saving);
    }

    // ============================================================================
    // LIFE-CYCLE HELPERS
    // ============================================================================

    async waitForOpen(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout });
        await expect(this.getTitle()).toBeVisible({ timeout });
        await expect(this.getDisplayNameInput()).toBeVisible({ timeout });
    }

    async waitForClose(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getModalContainer()).not.toBeVisible({ timeout });
    }

    // ============================================================================
    // ACTION METHODS
    // ============================================================================

    async fillDisplayName(value: string): Promise<void> {
        await this.fillPreactInput(this.getDisplayNameInput(), value);
    }

    async submit(): Promise<void> {
        await this.clickButton(this.getSubmitButton(), { buttonName: translationEn.joinGroupPage.displayNameConflict.submit });
    }

    async clickCancel(): Promise<void> {
        await this.clickButton(this.getCancelButton(), { buttonName: translationEn.joinGroupPage.displayNameConflict.cancel });
    }

    async clickClose(): Promise<void> {
        await this.getCloseButton().click();
    }

    // ============================================================================
    // VERIFICATION METHODS
    // ============================================================================

    async verifyTitleContains(expectedText: string): Promise<void> {
        await expect(this.getTitle()).toContainText(expectedText);
    }

    async verifyDescriptionContains(expectedText: string): Promise<void> {
        await expect(this.getDescription()).toContainText(expectedText);
    }

    async verifyInputFocused(): Promise<void> {
        await expect(this.getDisplayNameInput()).toBeFocused({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async verifyDisplayNameValue(expectedValue: string): Promise<void> {
        await expect(this.getDisplayNameInput()).toHaveValue(expectedValue);
    }

    async verifyCurrentNameVisible(expectedName: string): Promise<void> {
        await expect(this.getModalContainer().getByText(expectedName, { exact: true })).toBeVisible();
    }

    async verifyValidationErrorContains(expectedText: string): Promise<void> {
        await expect(this.getValidationError()).toContainText(expectedText, { timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    }

    async verifyNoValidationError(): Promise<void> {
        await expect(this.getValidationError()).not.toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE }).catch(() => undefined);
    }

    async verifyServerErrorContains(expectedText: string): Promise<void> {
        await expect(async () => {
            const errorElement = this.getServerError();
            await expect(errorElement).toBeVisible();
            const text = await errorElement.textContent();
            expect(text).toContain(expectedText);
        }).toPass({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY, intervals: [50, 100, 200, 500] });
    }

    async verifyNoServerError(): Promise<void> {
        await expect(this.getServerError()).not.toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE }).catch(() => undefined);
    }

    async verifySubmitButtonEnabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeEnabled();
    }

    async verifySubmitButtonDisabled(): Promise<void> {
        await expect(this.getSubmitButton()).toBeDisabled();
    }

    async verifySavingStateVisible(): Promise<void> {
        await expect(this.getSavingButton()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
        await expect(this.getSavingButton()).toBeDisabled();
    }
}
