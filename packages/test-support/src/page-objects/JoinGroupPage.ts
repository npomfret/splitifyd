import { expect, Locator, Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../test-constants';
import { translationEn } from '../translations/translation-en';
import { BasePage } from './BasePage';

const translation = translationEn;

/**
 * Page Object Model for join group functionality via share links.
 * Handles different authentication states and provides robust join operations.
 * Reusable across unit tests and e2e tests.
 */
export class JoinGroupPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ============================================================================
    // STATIC UTILITY METHODS
    // ============================================================================

    /**
     * Helper to build a group detail URL pattern
     * Use for URL matching in tests and navigation verification
     */
    static groupDetailUrlPattern(groupId?: string): RegExp {
        if (groupId) {
            return new RegExp(`/groups/${groupId}$`);
        }
        return /\/groups\/[a-zA-Z0-9]+/;
    }

    // ============================================================================
    // ELEMENT SELECTORS - Scoped to join group page
    // ============================================================================

    protected getJoinGroupHeading(): Locator {
        return this.page.getByRole('heading', { name: translation.joinGroupPage.title });
    }

    /**
     * Get the group name heading displayed in the group preview card.
     * The group name appears as a level 2 heading.
     */
    protected getGroupNameHeading(): Locator {
        return this.page.getByRole('heading', { level: 2 });
    }

    protected getJoinGroupButton(): Locator {
        return this.page.locator('#main-content').getByRole('button', { name: translation.joinGroupPage.joinGroup });
    }

    protected getAlreadyMemberMessage(): Locator {
        return this.page.getByText(translation.joinGroupPage.alreadyMember);
    }

    protected getLoginButton(): Locator {
        return this.page.getByRole('button', { name: translation.header.login });
    }

    protected getRegisterButton(): Locator {
        return this.page.getByRole('button', { name: translation.header.signUp });
    }

    /**
     * Check if any error warning is visible.
     * Used internally to detect error state - not for assertions.
     * For assertions, use verifyInvalidLinkWarningVisible() or verifyUnableToJoinWarningVisible().
     */
    private async isAnyErrorWarningVisible(): Promise<boolean> {
        const invalidLinkVisible = await this.getInvalidLinkWarning().isVisible().catch(() => false);
        if (invalidLinkVisible) return true;
        const unableToJoinVisible = await this.getUnableToJoinWarning().isVisible().catch(() => false);
        return unableToJoinVisible;
    }

    /**
     * Get the text content of whichever error warning is visible.
     * Returns empty string if neither is visible.
     */
    private async getVisibleErrorText(): Promise<string> {
        const invalidLinkVisible = await this.getInvalidLinkWarning().isVisible().catch(() => false);
        if (invalidLinkVisible) {
            return (await this.getInvalidLinkWarning().textContent()) || '';
        }
        const unableToJoinVisible = await this.getUnableToJoinWarning().isVisible().catch(() => false);
        if (unableToJoinVisible) {
            return (await this.getUnableToJoinWarning().textContent()) || '';
        }
        return '';
    }

    /**
     * Pending approval alert - uses role='alert' with aria-label
     */
    protected getPendingApprovalAlert(): Locator {
        return this.page.getByRole('alert', { name: translation.joinGroupPage.pendingApprovalTitle });
    }

    protected getBackToDashboardButton(): Locator {
        return this.page.getByRole('button', { name: translation.header.goToDashboard });
    }

    protected getOkButton(): Locator {
        return this.page.getByRole('button', { name: translation.joinGroupPage.goToGroup });
    }

    private getCancelButton(): Locator {
        return this.page.getByRole('button', { name: translation.joinGroupPage.cancel });
    }

    /**
     * Invalid link warning - identified by role='alert' with aria-label containing error title
     */
    private getInvalidLinkWarning(): Locator {
        return this.page.getByRole('alert', { name: translation.errors.invalidLink });
    }

    /**
     * Unable to join warning - identified by role='alert' with aria-label containing error title
     */
    private getUnableToJoinWarning(): Locator {
        return this.page.getByRole('alert', { name: translation.joinGroupPage.errors.joinFailed });
    }

    /**
     * Join success container - identified by role='status' with aria-label containing welcome text prefix
     */
    private getJoinSuccessContainer(): Locator {
        // Extract the prefix before the variable placeholder from the translation
        const welcomePrefix = translation.joinGroupPage.welcome.split('{{')[0];
        return this.page.getByRole('status', { name: new RegExp(welcomePrefix) });
    }

    private getSuccessIcon(): Locator {
        // .first(): Multiple SVGs may exist in success container; first is the success icon
        return this.getJoinSuccessContainer().locator('svg').first();
    }

    // ============================================================================
    // STATE VERIFICATION METHODS
    // ============================================================================

    /**
     * Get the text content of the group name heading.
     * @returns Promise resolving to the group name as a string
     */
    async getGroupName(): Promise<string> {
        const heading = this.getGroupNameHeading();
        await expect(heading).toBeVisible();
        const text = await heading.textContent();
        if (!text) {
            throw new Error('Group name heading is empty');
        }
        return text.trim();
    }

    async isErrorPage(): Promise<boolean> {
        return await this.isAnyErrorWarningVisible();
    }

    // ============================================================================
    // ACTION METHODS - Non-fluent versions (action only)
    // ============================================================================

    /**
     * Navigate to a share link
     * Non-fluent version - navigates without verification
     */
    async navigateToShareLink(shareLink: string): Promise<void> {
        await this.page.goto(shareLink);
        await this.waitForDomContentLoaded();
        // will either go to login page or join group page
        // will show either join button or "already a member" message
    }

    /**
     * Click the join group button
     * Non-fluent version - clicks without verification
     * Private method - use public methods for reliable join flows
     */
    private async clickJoinGroup(): Promise<void> {
        const joinButton = this.getJoinGroupButton();

        // Make sure button is enabled
        if (!(await joinButton.isEnabled())) {
            throw new Error('Join Group button is disabled');
        }

        // Check if button is already in joining state
        const dataJoining = await joinButton.getAttribute('data-joining');
        if (dataJoining === 'true') {
            throw new Error('Join Group button is already in joining state');
        }

        // Click the button
        await this.clickButton(joinButton, { buttonName: 'Join Group' });
    }

    /**
     * Click the OK/Go to Group button after successful join
     * Non-fluent version - clicks without navigation verification
     */
    async clickOkButton(): Promise<void> {
        const okButton = this.getOkButton();
        await this.clickButton(okButton, { buttonName: 'OK/Go to Group' });
    }

    // ============================================================================
    // ACTION METHODS - Fluent versions (action + verification)
    // ============================================================================

    /**
     * Join group using share link
     * Fluent version - complete join flow with verification
     * Throws specific error types based on the failure reason
     * @param shareLink - The share link to join
     */
    async joinGroupUsingShareLink(shareLink: string): Promise<void> {
        // Navigate to the share link
        await this.navigateToShareLink(shareLink);

        await expect(this.getJoinGroupHeading()).toBeVisible();

        // Wait a bit for page to stabilize
        await this.waitForDomContentLoaded();

        // Check various error conditions
        if (await this.isErrorPage()) {
            throw new Error('Share link is invalid or expired');
        }

        await this.clickJoinGroupAndWaitForJoin();
    }

    /**
     * Click join button and wait for join to complete
     * Fluent version - verifies navigation to group page or success screen
     * Now handles the display name prompt modal
     */
    async clickJoinGroupAndWaitForJoin(): Promise<void> {
        await this.clickJoinGroup();

        // Wait for the display name modal to appear
        await this.waitForDisplayNameModal();

        // Submit the modal with the pre-filled display name
        await this.submitDisplayNameModal();

        // Wait for join to complete using single polling loop
        await expect(async () => {
            const currentUrl = this.page.url();
            const isOnGroupPage = currentUrl.match(JoinGroupPage.groupDetailUrlPattern());
            const hasError = await this.isAnyErrorWarningVisible();
            const hasSuccessScreen = await this.getJoinSuccessContainer().isVisible().catch(() => false);

            if (isOnGroupPage) {
                return; // Success - direct navigation
            }

            if (hasError) {
                const errorText = await this.getVisibleErrorText();
                throw new Error(`Join failed: ${errorText}`);
            }

            if (hasSuccessScreen) {
                await this.clickOkButton();
                await expect(this.page).toHaveURL(JoinGroupPage.groupDetailUrlPattern(), { timeout: TEST_TIMEOUTS.NAVIGATION });
                return; // Success - via success screen
            }

            // Still joining - keep polling
            throw new Error('Still joining...');
        })
            .toPass({ timeout: 5000 });
    }

    // ============================================================================
    // VERIFICATION METHODS - For test verification
    // ============================================================================

    async verifyJoinGroupHeadingVisible(timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getJoinGroupHeading()).toBeVisible({ timeout });
    }

    async verifyGroupNameHeadingContains(expectedText: string, timeout: number = TEST_TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
        await expect(this.getGroupNameHeading()).toContainText(expectedText, { timeout });
    }

    async verifyJoinButtonVisible(): Promise<void> {
        await expect(this.getJoinGroupButton()).toBeVisible();
    }

    async verifyJoinButtonEnabled(): Promise<void> {
        await expect(this.getJoinGroupButton()).toBeEnabled();
    }

    async verifyJoinButtonDisabled(): Promise<void> {
        await expect(this.getJoinGroupButton()).toBeDisabled();
    }

    async verifyPendingApprovalAlertVisible(expectedGroupName: string): Promise<void> {
        const alert = this.getPendingApprovalAlert();
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(expectedGroupName);
    }

    async clickJoinGroupButton(): Promise<void> {
        await this.clickJoinGroup();
    }

    /**
     * Verify join button is not visible (user already a member)
     */
    async verifyJoinGroupButtonNotVisible(): Promise<void> {
        const joinButton = this.getJoinGroupButton();
        await expect(joinButton).not.toBeVisible();
    }

    /**
     * Verify "already a member" message is displayed
     */
    async verifyAlreadyMemberMessageVisible(): Promise<void> {
        const alreadyMemberMessage = this.getAlreadyMemberMessage();
        await expect(alreadyMemberMessage).toBeVisible();
    }

    /**
     * Click the "Back to Dashboard" button on error pages
     */
    async clickBackToDashboard(): Promise<void> {
        const backButton = this.getBackToDashboardButton();
        await this.clickButton(backButton, { buttonName: 'Back to Dashboard' });
    }

    async verifyInvalidLinkWarningVisible(): Promise<void> {
        await expect(this.getInvalidLinkWarning()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    }

    async verifyUnableToJoinWarningVisible(): Promise<void> {
        await expect(this.getUnableToJoinWarning()).toBeVisible({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    }

    async verifyJoinGroupButtonDisabled(): Promise<void> {
        await expect(this.getJoinGroupButton()).toBeDisabled();
    }

    async verifyJoinGroupButtonEnabled(): Promise<void> {
        await expect(this.getJoinGroupButton()).toBeEnabled();
    }

    async verifyBackToDashboardButtonVisible(): Promise<void> {
        await expect(this.getBackToDashboardButton()).toBeVisible();
    }

    async verifyBackToDashboardButtonEnabled(): Promise<void> {
        await expect(this.getBackToDashboardButton()).toBeEnabled();
    }

    async isJoinGroupButtonVisible(): Promise<boolean> {
        return await this.getJoinGroupButton().isVisible().catch(() => false);
    }

    /**
     * Verify error message - uses role='alert' which is present on error messages
     */
    async verifyErrorMessageContains(expectedText: string): Promise<void> {
        const alertElement = this.page.getByRole('alert');
        const headingError = this.page.getByRole('heading', { name: expectedText });

        await expect(async () => {
            const alertVisible = await alertElement.isVisible().catch(() => false);
            const headingVisible = await headingError.isVisible().catch(() => false);

            if (alertVisible) {
                await expect(alertElement).toContainText(expectedText);
                return;
            }

            if (headingVisible) {
                await expect(headingError).toBeVisible();
                return;
            }

            throw new Error(`Expected error message "${expectedText}" not found in alert or heading`);
        })
            .toPass({ timeout: TEST_TIMEOUTS.ERROR_DISPLAY });
    }

    /**
     * Expect current URL to match pattern
     */
    async expectUrl(pattern: RegExp): Promise<void> {
        await expect(this.page).toHaveURL(pattern);
    }

    async verifyJoinSuccessIndicatorVisible(): Promise<void> {
        await expect(this.getJoinSuccessContainer()).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
    }

    async verifySuccessIconVisible(): Promise<void> {
        await expect(this.getSuccessIcon()).toBeVisible({ timeout: TEST_TIMEOUTS.API_RESPONSE });
    }

    async verifySuccessHeadingContains(expectedText: string): Promise<void> {
        await expect(this.page.getByRole('heading', { name: expectedText, exact: false })).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async verifyGoToGroupButtonVisible(): Promise<void> {
        await expect(this.getOkButton()).toBeVisible({ timeout: TEST_TIMEOUTS.ELEMENT_VISIBLE });
    }

    async clickCancelButton(): Promise<void> {
        const cancelButton = this.getCancelButton();
        await this.clickButton(cancelButton, { buttonName: 'Cancel Join Group' });
    }

    /**
     * Display name modal dialog - identified by its title
     */
    private getDisplayNameModal(): Locator {
        return this.page.getByRole('dialog', { name: translation.joinGroupPage.displayName.title });
    }

    /**
     * Display name input - identified by label text within the modal dialog
     */
    private getDisplayNameInput(): Locator {
        return this.getDisplayNameModal().getByLabel(translation.joinGroupPage.displayName.label);
    }

    private getModalJoinButton(): Locator {
        return this.getDisplayNameModal().getByRole('button', { name: translation.joinGroupPage.joinGroup });
    }

    async waitForDisplayNameModal(timeout: number = TEST_TIMEOUTS.MODAL_TRANSITION): Promise<void> {
        await expect(this.getDisplayNameInput()).toBeVisible({ timeout });
    }

    async submitDisplayNameModal(): Promise<void> {
        await this.clickButton(this.getModalJoinButton(), { buttonName: 'Join Group (Modal)' });
    }
}
