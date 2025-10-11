import { Page } from '@playwright/test';
import { SettingsPage as BaseSettingsPage } from '@splitifyd/test-support';
import { DashboardPage } from './dashboard.page.ts';

/**
 * E2E-specific SettingsPage extending shared base class.
 * Adds e2e-specific navigation methods for cross-POM interactions.
 */
export class SettingsPage extends BaseSettingsPage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to dashboard via user menu.
     * Returns DashboardPage instance for chaining.
     * E2E-specific method for cross-POM navigation.
     */
    async navigateToDashboard(): Promise<DashboardPage> {
        await this.header.navigateToDashboard();
        return new DashboardPage(this.page);
    }

    // All other methods inherited from base class
}
