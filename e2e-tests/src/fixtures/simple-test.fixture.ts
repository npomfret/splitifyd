import { Page, BrowserContext } from '@playwright/test';
import { test as base } from './base-test';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../workflows';
import { LoginPage, DashboardPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';
import { attachConsoleHandler } from '../helpers';
import { ApiDriver } from '@splitifyd/test-support';

interface BrowserInstance {
    page: Page;
    context: BrowserContext;
    user?: PooledTestUser;
    consoleHandler: ReturnType<typeof attachConsoleHandler>;
}

export interface SimpleTestFixtures {
    newLoggedInBrowser(): Promise<{ page: Page; dashboardPage: DashboardPage; user: PooledTestUser }>;
    newEmptyBrowser(): Promise<{ page: Page; loginPage: LoginPage }>;
}

const apiDriver = new ApiDriver();

export const simpleTest = base.extend<SimpleTestFixtures>({
    newLoggedInBrowser: async ({ browser }, use, testInfo) => {
        const browserInstances: BrowserInstance[] = [];
        const userPool = getUserPool();

        const createLoggedInBrowser = async () => {
            // Get user from pool and accept current policies before any browser setup
            const user = await userPool.claimUser(browser);

            // Accept any updated policies to prevent modal interference
            await apiDriver.acceptCurrentPublishedPolicies(user.token);

            // Create new browser context and page
            const context = await browser.newContext();
            const page = await context.newPage();

            // Set up console handling with user index
            const userIndex = browserInstances.length; // Use current length as index for this user
            const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex });

            const authWorkflow = new AuthenticationWorkflow(page);
            await authWorkflow.loginExistingUser(user);

            // Update console handler with user email now that we have it
            consoleHandler.updateUserInfo({ userEmail: user.email });

            // Create dashboard page
            const dashboardPage = new DashboardPage(page, user);

            // Wait for dashboard to be fully loaded (including "Loading your groups" spinner)
            await dashboardPage.waitForDashboard();

            // Track this browser instance for cleanup
            const browserInstance: BrowserInstance = {
                page,
                context,
                user,
                consoleHandler,
            };
            browserInstances.push(browserInstance);

            const displayName = await dashboardPage.header.getCurrentUserDisplayName();

            console.log(`Using: "${displayName}" ${user.email} ${user.uid}`);

            return { page, dashboardPage, user };
        };

        await use(createLoggedInBrowser);

        // Cleanup all browser instances
        await Promise.all(
            browserInstances.map(async (instance) => {
                try {
                    // Process any errors that occurred during the test
                    await instance.consoleHandler.processErrors(testInfo);
                    instance.consoleHandler.dispose();

                    // Release user back to pool
                    if (instance.user) {
                        await userPool.releaseUser(instance.user);
                    }

                    // Close context
                    await instance.context.close();
                } catch (error) {
                    // Ignore trace file cleanup errors
                    if (error instanceof Error && error.message?.includes('ENOENT') && error.message?.includes('.trace')) {
                        console.warn(`Ignoring trace cleanup error:`, error.message);
                    } else {
                        throw error;
                    }
                }
            }),
        );
    },

    newEmptyBrowser: async ({ browser }, use, testInfo) => {
        const browserInstances: BrowserInstance[] = [];

        const createEmptyBrowser = async () => {
            // Create new browser context and page
            const context = await browser.newContext();
            const page = await context.newPage();

            // Set up console handling with user index
            const userIndex = browserInstances.length; // Use current length as index for this user
            const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex });

            // Navigate to login page
            const loginPage = new LoginPage(page);
            await loginPage.navigate();

            // Track this browser instance for cleanup
            const browserInstance: BrowserInstance = {
                page,
                context,
                consoleHandler,
            };
            browserInstances.push(browserInstance);

            return { page, loginPage };
        };

        await use(createEmptyBrowser);

        // Cleanup all browser instances
        await Promise.all(
            browserInstances.map(async (instance) => {
                try {
                    // Process any errors that occurred during the test
                    await instance.consoleHandler.processErrors(testInfo);
                    instance.consoleHandler.dispose();

                    // Close context
                    await instance.context.close();
                } catch (error) {
                    // Ignore trace file cleanup errors
                    if (error instanceof Error && error.message?.includes('ENOENT') && error.message?.includes('.trace')) {
                        console.warn(`Ignoring trace cleanup error:`, error.message);
                    } else {
                        throw error;
                    }
                }
            }),
        );
    },
});

export { expect } from '@playwright/test';
