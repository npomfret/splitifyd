import { Locator } from '@playwright/test';
import { CreateGroupModalPage as BaseCreateGroupModalPage } from '@splitifyd/test-support';

/**
 * E2E-specific CreateGroupModalPage that extends the shared base class
 * Adds methods required by error handling tests for network and validation testing
 */
export class CreateGroupModalPage extends BaseCreateGroupModalPage {
    /**
     * E2E-specific: Check if modal is open
     * Used by error handling tests to verify modal state after errors
     */
    async isOpen(): Promise<boolean> {
        return await this.getModalContainer().isVisible();
    }

    /**
     * E2E-specific: Get error message with comprehensive selector
     * Includes multiple error patterns for network error testing
     */
    getErrorMessage(pattern?: string | RegExp): Locator {
        const allErrors = this.page.locator(
            '[data-testid="create-group-error-message"], [role="alert"], [data-testid*="error"], .error-message, [role="dialog"] [role="alert"]',
        );

        if (pattern) {
            return allErrors.filter({ hasText: pattern });
        }
        return allErrors;
    }

    /**
     * E2E-specific: Get submit button with form-scoped selector
     * Used by validation tests that need specific form context
     */
    getCreateGroupFormButton(): Locator {
        return this.getSubmitButton();
    }

    /**
     * E2E-specific: Alias for clickCancel
     * Backward compatibility for existing tests
     */
    async cancel(): Promise<void> {
        await this.clickCancel();
    }
}
