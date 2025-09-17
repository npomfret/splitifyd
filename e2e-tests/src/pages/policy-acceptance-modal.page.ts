import { type Page, type Locator, expect } from '@playwright/test';

export class PolicyAcceptanceModalPage {
    readonly page: Page;

    // Main modal container
    readonly modal: Locator;

    // Header elements
    readonly title: Locator;
    readonly subtitle: Locator;
    readonly closeButton: Locator;

    // Progress elements
    readonly progressBar: Locator;
    readonly progressText: Locator;

    // Policy content
    readonly policyCard: Locator;
    readonly policyTitle: Locator;
    readonly acceptedBadge: Locator;
    readonly policyContent: Locator;
    readonly loadingSpinner: Locator;

    // Policy acceptance
    readonly acceptanceSection: Locator;
    readonly acceptanceCheckbox: Locator;
    readonly acceptanceLabel: Locator;

    // Navigation buttons
    readonly previousButton: Locator;
    readonly nextButton: Locator;
    readonly acceptAllButton: Locator;

    // Error handling
    readonly errorState: Locator;

    constructor(page: Page) {
        this.page = page;

        // Main modal - based on the exact classes from PolicyAcceptanceModal.tsx
        this.modal = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50.flex.items-center.justify-center.p-4.z-50');

        // Header elements
        this.title = page.locator('h2.text-2xl.font-bold.text-gray-900:has-text("Accept Updated Policies")');
        this.subtitle = page.locator('p.text-sm.text-gray-600.mt-1');
        this.closeButton = page.locator('button[aria-label="Close"]');

        // Progress elements - target the container, not the inner bar which might have 0 width
        this.progressBar = page.locator('div.w-full.bg-gray-200.rounded-full.h-2');
        this.progressText = page.locator('span:has-text("of"):has-text("accepted")');

        // Policy content
        this.policyCard = page.locator('div.bg-white.rounded-lg.shadow-xl.max-w-4xl');
        this.policyTitle = this.modal.locator('h3.text-lg.font-semibold.text-gray-900');
        this.acceptedBadge = page.locator('span.inline-flex.items-center.px-2\\.5.py-0\\.5.rounded-full:has-text("✓ Accepted")');
        this.policyContent = page.locator('div.bg-gray-50.rounded-lg.p-4.max-h-96.overflow-y-auto');
        this.loadingSpinner = page.locator('span:has-text("Loading policy content...")');

        // Policy acceptance
        this.acceptanceSection = page.locator('div.bg-blue-50.border.border-blue-200.rounded-lg.p-4');
        this.acceptanceCheckbox = page.locator('input[type="checkbox"][id^="accept-"]');
        this.acceptanceLabel = page.locator('label:has-text("I have read and accept this")');

        // Navigation buttons
        this.previousButton = page.locator('button:has-text("Previous")');
        this.nextButton = page.locator('button:has-text("Next")');
        this.acceptAllButton = page.locator('button:has-text("Accept All & Continue")');

        // Error handling
        this.errorState = page.locator('[data-testid="error-state"], .error-state');
    }

    async isVisible(): Promise<boolean> {
        return await this.modal.isVisible();
    }

    async waitForModalToAppear(timeoutMs: number = 10000): Promise<void> {
        await expect(this.modal).toBeVisible({ timeout: timeoutMs });
    }

    async waitForModalToDisappear(timeoutMs: number = 10000): Promise<void> {
        await expect(this.modal).not.toBeVisible({ timeout: timeoutMs });
    }

    async getCurrentPolicyName(): Promise<string> {
        return (await this.policyTitle.textContent()) || '';
    }

    async acceptCurrentPolicy(): Promise<void> {
        // Wait for policy content to load
        await expect(this.acceptanceCheckbox).toBeVisible();
        await expect(this.acceptanceCheckbox).toBeEnabled();

        // Check the acceptance checkbox
        await this.acceptanceCheckbox.click();

        // After clicking, the checkbox section disappears and the accepted badge appears
        await expect(this.acceptedBadge).toBeVisible();
    }

    async navigateToNextPolicy(): Promise<void> {
        await expect(this.nextButton).toBeEnabled();
        await this.nextButton.click();
    }

    async acceptAllPolicies(): Promise<void> {
        // Wait for the button to become enabled after all individual policies are accepted
        await expect(this.acceptAllButton).toBeEnabled({ timeout: 5000 });
        await this.acceptAllButton.click();
    }

    async waitForPolicyContentToLoad(): Promise<void> {
        // Wait for loading spinner to disappear and content to appear
        await expect(this.loadingSpinner).not.toBeVisible();
        await expect(this.policyContent).toBeVisible();
        // Also wait for acceptance section to be ready
        await expect(this.acceptanceSection).toBeVisible();
    }

    async acceptSinglePolicyComplete(): Promise<void> {
        // Wait for modal to appear
        await this.waitForModalToAppear();

        // Wait for policy content to load
        await this.waitForPolicyContentToLoad();

        // Accept the current policy
        await this.acceptCurrentPolicy();

        // Accept all to complete the process
        await this.acceptAllPolicies();

        // Wait for modal to disappear
        await this.waitForModalToDisappear();
    }

    async acceptMultiplePoliciesSequentially(): Promise<void> {
        // Wait for modal to appear
        await this.waitForModalToAppear();

        let hasMorePolicies = true;

        while (hasMorePolicies) {
            // Wait for policy content to load
            await this.waitForPolicyContentToLoad();

            // Accept the current policy
            await this.acceptCurrentPolicy();

            // Check if we can navigate to next policy
            const nextButtonEnabled = await this.nextButton.isEnabled();

            if (nextButtonEnabled) {
                await this.navigateToNextPolicy();
            } else {
                hasMorePolicies = false;
            }
        }

        // Accept all to complete the process
        await this.acceptAllPolicies();

        // Wait for modal to disappear
        await this.waitForModalToDisappear();
    }
}
