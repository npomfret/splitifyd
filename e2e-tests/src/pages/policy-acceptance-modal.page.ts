import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class PolicyAcceptanceModalPage extends BasePage {
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

    // Error handling
    readonly errorState: Locator;

    constructor(page: Page) {
        super(page);

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

        // Error handling
        this.errorState = page.locator('[data-testid="error-state"], .error-state');
    }

    async isVisible(): Promise<boolean> {
        return await this.modal.isVisible();
    }

    async waitForModalToAppear(timeoutMs: number = 2000): Promise<void> {
        await expect(this.modal).toBeVisible({ timeout: timeoutMs });
    }

    async getCurrentPolicyName(): Promise<string> {
        return (await this.policyTitle.textContent()) || '';
    }

    async acceptCurrentPolicy(): Promise<void> {
        // Wait for policy content to load
        await expect(this.acceptanceCheckbox).toBeVisible();
        await expect(this.acceptanceCheckbox).toBeEnabled();

        // Click the acceptance checkbox
        // Note: Don't use check() because Preact removes the checkbox immediately after onChange
        // causing check() to timeout waiting to verify the checked state
        await this.acceptanceCheckbox.click();

        // After clicking, the checkbox section disappears and the accepted badge appears
        // Wait for the badge to confirm the acceptance was registered
        await expect(this.acceptedBadge).toBeVisible();
    }

    async waitForPolicyContentToLoad(): Promise<void> {
        // Wait for loading spinner to disappear and content to appear
        await expect(this.loadingSpinner).not.toBeVisible();
        await expect(this.policyContent).toBeVisible();
        // Also wait for acceptance section to be ready
        await expect(this.acceptanceSection).toBeVisible();
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

            // Check if there are more policies (modal will auto-advance if so)
            // Wait a bit for auto-advance to occur
            await this.page.waitForTimeout(600);

            // Check if modal is still visible
            const modalStillVisible = await this.modal.isVisible();
            if (!modalStillVisible) {
                // Modal closed - all policies accepted and submitted
                hasMorePolicies = false;
            } else {
                // Modal still open - check if we moved to next policy
                // If acceptance section is visible, there's another policy
                const hasAcceptanceSection = await this.acceptanceSection.isVisible().catch(() => false);
                hasMorePolicies = hasAcceptanceSection;
            }
        }
    }

    /**
     * Verify policy name has meaningful content (min length)
     * Uses Playwright's polling to handle async content loading
     */
    async verifyPolicyNameHasContent(minLength: number = 5): Promise<void> {
        await expect(async () => {
            const policyName = await this.getCurrentPolicyName();
            expect(policyName).toBeTruthy();
            expect(policyName.length).toBeGreaterThan(minLength);
        }).toPass({ timeout: 5000 });
    }

    /**
     * Verify modal structure elements are visible
     */
    async verifyTitleVisible(): Promise<void> {
        await expect(this.title).toBeVisible();
    }

    async verifySubtitleVisible(): Promise<void> {
        await expect(this.subtitle).toBeVisible();
    }

    async verifyProgressBarVisible(): Promise<void> {
        await expect(this.progressBar).toBeVisible();
    }

    async verifyPolicyCardVisible(): Promise<void> {
        await expect(this.policyCard).toBeVisible();
    }

    async verifyAcceptanceCheckboxVisible(): Promise<void> {
        await expect(this.acceptanceCheckbox).toBeVisible();
    }

    async verifyAcceptanceLabelVisible(): Promise<void> {
        await expect(this.acceptanceLabel).toBeVisible();
    }
}
