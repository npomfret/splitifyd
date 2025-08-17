import { Page } from '@playwright/test';
import { LoginPage } from '../pages';
import { DashboardPage } from '../pages';
import type { User as BaseUser } from '@shared/shared-types';

/**
 * Authentication workflow class that handles user creation and login flows.
 * Encapsulates the multi-step process of creating and authenticating test users.
 */
export class AuthenticationWorkflow {
    constructor(private page: Page) {}

    /**
     * Logs in an existing test user (for use with user pool)
     * Expects to start from a clean state - will fail fast if not
     */
    async loginExistingUser(user: BaseUser): Promise<void> {
        const loginPage = new LoginPage(this.page);
        await loginPage.navigate();

        // Extract password from user creation pattern - all pool users use same password
        const password = 'TestPassword123!';
        await loginPage.login(user.email, password);

        // Wait for successful login and redirect to dashboard
        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
    }
}
