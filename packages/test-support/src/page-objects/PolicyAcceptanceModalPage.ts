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

    getModalOverlay(): Locator {
        return this.page.getByTestId('policy-modal-overlay');
    }

    getModalContainer(): Locator {
        return this.page.getByTestId('policy-modal-card');
    }

    getTitle(): Locator {
        return this.page.getByTestId('policy-modal-title');
    }

    getSubtitle(): Locator {
        return this.page.getByTestId('policy-modal-subtitle');
    }

    getProgressBar(): Locator {
        return this.page.getByTestId('policy-progress-track');
    }

    getPolicyCard(): Locator {
        return this.page.getByTestId('policy-card');
    }

    getPolicyTitle(): Locator {
        return this.page.getByTestId('current-policy-title');
    }

    getAcceptedBadge(): Locator {
        return this.page.getByTestId('policy-accepted-badge');
    }

    getPolicyContent(): Locator {
        return this.page.getByTestId('policy-content');
    }

    getLoadingSpinner(): Locator {
        return this.page.getByTestId('policy-content-loading');
    }

    getAcceptanceSection(): Locator {
        return this.page.getByTestId('policy-acceptance-section');
    }

    getAcceptanceCheckbox(): Locator {
        return this.page.getByTestId('policy-accept-checkbox');
    }

    getAcceptanceLabel(): Locator {
        return this.page.getByTestId('policy-accept-label');
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
            // Increased timeout to 5000ms to account for two serial API calls:
            // 1. submitAllPolicies() - accepts policies via API
            // 2. refreshPolicyStatus() - checks if more policies need acceptance
            await expect(async () => {
                const modalVisible = await this.getModalContainer().isVisible();
                if (!modalVisible) {
                    return; // Modal closed, we're done
                }

                const acceptanceVisible = await this
                    .getAcceptanceSection()
                    .isVisible()
                    .catch(() => false);

                if (acceptanceVisible) {
                    return; // Next policy is ready
                }

                // If modal is visible but acceptance section is not, we're in transition
                throw new Error('Waiting for modal to close or next policy to load');
            })
                .toPass({ timeout: 5000 });

            const modalVisible = await this.getModalContainer().isVisible();
            if (!modalVisible) {
                hasMorePolicies = false;
                continue;
            }

            const acceptanceVisible = await this
                .getAcceptanceSection()
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
        })
            .toPass({ timeout: 5000 });
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
