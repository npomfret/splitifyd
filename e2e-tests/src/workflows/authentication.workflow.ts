import {Page} from '@playwright/test';
import {DashboardPage, LoginPage} from '../pages';
import type {User as BaseUser} from '@shared/shared-types';
import {DEFAULT_PASSWORD} from "../utils/test-helpers.ts";

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
        await loginPage.login(user.email, DEFAULT_PASSWORD);

        // Wait for successful login and redirect to dashboard
        const dashboardPage = new DashboardPage(this.page);
        await dashboardPage.waitForDashboard();
    }
}
