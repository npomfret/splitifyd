import { Page } from '@playwright/test';
import { HeaderPage as BaseHeaderPage } from '@splitifyd/test-support';

/**
 * E2E-specific HeaderPage extending shared base class.
 * Currently inherits all functionality from base class.
 * E2E-specific cross-POM navigation methods can be added here if needed.
 */
export class HeaderPage extends BaseHeaderPage {
    constructor(page: Page) {
        super(page);
    }

    // All methods inherited from base class
    // Add e2e-specific methods here if needed in the future
}
