import { Page } from '@playwright/test';
import { DashboardPage, LoginPage } from '../pages';

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
    async loginExistingUser(user: { email: string; password: string }): Promise<void> {
        const loginPage = new LoginPage(this.page);
        await loginPage.navigate();

        // Extract password from user creation pattern - all pool users use same password
        const { email, password } = user;
        if (!email || !password) throw Error(`inavlid user: ${JSON.stringify(user)}`);
        await loginPage.login(email, password);

        // Wait for successful login and redirect to dashboard
        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
    }
}
