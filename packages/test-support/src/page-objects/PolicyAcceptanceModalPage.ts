import { expect, Locator, Page, Request } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Policy acceptance modal page object following the modern POM pattern.
 * Provides high-level helpers to verify modal content and accept policies sequentially.
 */
export class PolicyAcceptanceModalPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // LOCATOR HELPERS
    // ============================================================================

    getModalContainer(): Locator {
        return this.page.locator('div.fixed.inset-0.bg-black.bg-opacity-50.flex.items-center.justify-center.p-4.z-50');
    }

    getTitle(): Locator {
        return this.page.locator('h2.text-2xl.font-bold.text-gray-900:has-text("Accept Updated Policies")');
    }

    getSubtitle(): Locator {
        return this.page.locator('p.text-sm.text-gray-600.mt-1');
    }

    getCloseButton(): Locator {
        return this.page.locator('button[aria-label="Close"]');
    }

    getProgressBar(): Locator {
        return this.page.locator('div.w-full.bg-gray-200.rounded-full.h-2');
    }

    getProgressText(): Locator {
        return this.page.locator('span:has-text("of"):has-text("accepted")');
    }

    getPolicyCard(): Locator {
        return this.page.locator('div.bg-white.rounded-lg.shadow-xl.max-w-4xl');
    }

    getPolicyTitle(): Locator {
        return this.getModalContainer().locator('h3.text-lg.font-semibold.text-gray-900');
    }

    getAcceptedBadge(): Locator {
        return this.page.locator('span.inline-flex.items-center.px-2\\.5.py-0\\.5.rounded-full:has-text("✓ Accepted")');
    }

    getPolicyContent(): Locator {
        return this.page.locator('div.bg-gray-50.rounded-lg.p-4.max-h-96.overflow-y-auto');
    }

    getLoadingSpinner(): Locator {
        return this.page.locator('span:has-text("Loading policy content...")');
    }

    getAcceptanceSection(): Locator {
        return this.page.locator('div.bg-blue-50.border.border-blue-200.rounded-lg.p-4');
    }

    getAcceptanceCheckbox(): Locator {
        return this.page.locator('input[type="checkbox"][id^="accept-"]');
    }

    getAcceptanceLabel(): Locator {
        return this.page.locator('label:has-text("I have read and accept this")');
    }

    getPreviousButton(): Locator {
        return this.page.locator('button:has-text("Previous")');
    }

    getNextButton(): Locator {
        return this.page.locator('button:has-text("Next")');
    }

    getErrorState(): Locator {
        return this.page.locator('[data-testid="error-state"], .error-state');
    }

    // ============================================================================
    // PUBLIC ACTIONS & ASSERTIONS
    // ============================================================================

    async isVisible(): Promise<boolean> {
        return this.getModalContainer().isVisible();
    }

    async waitForModalToAppear(timeoutMs = 2000): Promise<void> {
        await expect(this.getModalContainer()).toBeVisible({ timeout: timeoutMs });
    }

    async getCurrentPolicyName(): Promise<string> {
        return (await this.getPolicyTitle().textContent()) ?? '';
    }

    async acceptCurrentPolicy(): Promise<void> {
        const checkbox = this.getAcceptanceCheckbox();
        await expect(checkbox).toBeVisible();
        await expect(checkbox).toBeEnabled();

        // Use click instead of check due to immediate unmounting on change.
        await checkbox.click();
        await expect(this.getAcceptedBadge()).toBeVisible();
    }

    async waitForPolicyContentToLoad(): Promise<void> {
        await expect(this.getLoadingSpinner()).not.toBeVisible();
        await expect(this.getPolicyContent()).toBeVisible();
        await expect(this.getAcceptanceSection()).toBeVisible();
    }

    /**
     * Accept all policies sequentially and wait for the submit request.
     * Returns the request object for verification.
     */
    async acceptMultiplePoliciesSequentially(): Promise<Request> {
        await this.waitForModalToAppear();

        // Set up request promise before starting to accept policies
        const acceptanceRequestPromise = this.page.waitForRequest(
            (request) => request.method() === 'POST' && request.url().endsWith('/api/user/policies/accept-multiple'),
            { timeout: 3000 },
        );

        let hasMorePolicies = true;

        while (hasMorePolicies) {
            await this.waitForPolicyContentToLoad();
            await this.acceptCurrentPolicy();

            // Wait for either modal to close or next policy to load using expect().toPass()
            await expect(async () => {
                const modalVisible = await this.getModalContainer().isVisible();
                if (!modalVisible) {
                    return; // Modal closed, we're done
                }

                const acceptanceVisible = await this.getAcceptanceSection()
                    .isVisible()
                    .catch(() => false);

                if (acceptanceVisible) {
                    return; // Next policy is ready
                }

                // If modal is visible but acceptance section is not, we're in transition
                throw new Error('Waiting for modal to close or next policy to load');
            }).toPass({ timeout: 2000 });

            const modalVisible = await this.getModalContainer().isVisible();
            if (!modalVisible) {
                hasMorePolicies = false;
                continue;
            }

            const acceptanceVisible = await this.getAcceptanceSection()
                .isVisible()
                .catch(() => false);

            hasMorePolicies = acceptanceVisible;
        }

        return await acceptanceRequestPromise;
    }

    async verifyPolicyNameHasContent(minLength = 5): Promise<void> {
        await expect(async () => {
            const policyName = await this.getCurrentPolicyName();
            expect(policyName).toBeTruthy();
            expect(policyName.length).toBeGreaterThan(minLength);
        }).toPass({ timeout: 5000 });
    }

    async verifyTitleVisible(): Promise<void> {
        await expect(this.getTitle()).toBeVisible();
    }

    async verifySubtitleVisible(): Promise<void> {
        await expect(this.getSubtitle()).toBeVisible();
    }

    async verifyProgressBarVisible(): Promise<void> {
        await expect(this.getProgressBar()).toBeVisible();
    }

    async verifyPolicyCardVisible(): Promise<void> {
        await expect(this.getPolicyCard()).toBeVisible();
    }

    async verifyAcceptanceCheckboxVisible(): Promise<void> {
        await expect(this.getAcceptanceCheckbox()).toBeVisible();
    }

    async verifyAcceptanceLabelVisible(): Promise<void> {
        await expect(this.getAcceptanceLabel()).toBeVisible();
    }
}
