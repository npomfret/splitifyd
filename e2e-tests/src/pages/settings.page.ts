import { Page } from '@playwright/test';
import { SettingsPage as BaseSettingsPage } from '@splitifyd/test-support';

/**
 * E2E-specific SettingsPage extending shared base class.
 * Adds e2e-specific navigation methods for cross-POM interactions.
 */
export class SettingsPage extends BaseSettingsPage {
    constructor(page: Page) {
        super(page);
    }

    // All other methods inherited from base class
}
