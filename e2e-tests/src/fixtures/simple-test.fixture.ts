import { Page, BrowserContext } from '@playwright/test';
import { test as base } from './base-test';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../workflows';
import { LoginPage, DashboardPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';
import { attachConsoleHandler, attachApiInterceptor, ApiInterceptor } from '../helpers';
import { ApiDriver } from '@splitifyd/test-support';

interface BrowserInstance {
    page: Page;
    context: BrowserContext;
    user?: PooledTestUser;
    consoleHandler: ReturnType<typeof attachConsoleHandler>;
    apiInterceptor: ApiInterceptor;
}

export interface SimpleTestFixtures {
    newEmptyBrowser(): Promise<{ page: Page; loginPage: LoginPage }>;

    /**
     * Creates multiple logged-in browsers at once for multi-user testing scenarios.
     *
     * @param count Number of browsers to create
     * @returns Array of browser instances with pages, dashboard pages, and users
     *
     * @example
     * // Old way (verbose):
     * const { page: ownerPage, dashboardPage: ownerDashboardPage, } = await newLoggedInBrowser();
     * const { page: member1Page, dashboardPage: member1DashboardPage, } = await newLoggedInBrowser();
     * const { page: member2Page, dashboardPage: member2DashboardPage, } = await newLoggedInBrowser();
     *
     * // New way (concise):
     * const browsers = await createLoggedInBrowsers(3);
     * const [owner, member1, member2] = browsers;
     * // Use: owner.page, owner.dashboardPage, owner.user, etc.
     */
    createLoggedInBrowsers(count: number): Promise<Array<{ page: Page; dashboardPage: DashboardPage; user: PooledTestUser }>>;

}

const apiDriver = new ApiDriver();

export const simpleTest = base.extend<SimpleTestFixtures>({

    newEmptyBrowser: async ({ browser }, use, testInfo) => {
        const browserInstances: BrowserInstance[] = [];

        const createEmptyBrowser = async () => {
            // Create new browser context and page
            const context = await browser.newContext();
            const page = await context.newPage();

            // Set up console handling with user index
            const userIndex = browserInstances.length; // Use current length as index for this user
            const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex });

            // Set up API interceptor
            const apiInterceptor = attachApiInterceptor(page, { testInfo, userIndex });

            // Navigate to login page
            const loginPage = new LoginPage(page);
            await loginPage.navigate();

            // Track this browser instance for cleanup
            const browserInstance: BrowserInstance = {
                page,
                context,
                consoleHandler,
                apiInterceptor,
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
                    await instance.apiInterceptor.processLogs(testInfo);

                    instance.consoleHandler.dispose();
                    instance.apiInterceptor.dispose();

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

    createLoggedInBrowsers: async ({ browser }, use, testInfo) => {
        const browserInstances: BrowserInstance[] = [];
        const userPool = getUserPool();

        const createMultipleBrowsers = async (count: number) => {
            // First, claim all users sequentially
            const users: PooledTestUser[] = [];
            for (let i = 0; i < count; i++) {
                const user = await userPool.claimUser(browser);
                users.push(user);
            }

            // Accept policies for all users in parallel
            await Promise.all(users.map(user => apiDriver.acceptCurrentPublishedPolicies(user.token)));

            // Then create browsers and login in parallel
            const browserPromises = users.map(async (user, index) => {
                // Create new browser context and page
                const context = await browser.newContext();
                const page = await context.newPage();

                // Set up console handling with user index
                const userIndex = browserInstances.length + index; // Use current length + index for this user
                const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex });

                // Set up API interceptor
                const apiInterceptor = attachApiInterceptor(page, { testInfo, userIndex });

                const authWorkflow = new AuthenticationWorkflow(page);
                await authWorkflow.loginExistingUser(user);

                // Update console handler and API interceptor with user email now that we have it
                consoleHandler.updateUserInfo({ userEmail: user.email });
                apiInterceptor.updateUserInfo({ userEmail: user.email });

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
                    apiInterceptor,
                };

                const displayName = await dashboardPage.header.getCurrentUserDisplayName();

                console.log(`Browser ${index + 1} using "${displayName}" ${user.email} (id: ${user.uid})`);

                return { browserInstance, result: { page, dashboardPage, user } };
            });

            const browserResults = await Promise.all(browserPromises);

            // Add all browser instances to the tracking array
            browserResults.forEach(({ browserInstance }) => {
                browserInstances.push(browserInstance);
            });

            // Return just the results
            return browserResults.map(({ result }) => result);
        };

        await use(createMultipleBrowsers);

        // Cleanup all browser instances
        await Promise.all(
            browserInstances.map(async (instance) => {
                try {
                    // Process any errors that occurred during the test
                    await instance.consoleHandler.processErrors(testInfo);
                    await instance.apiInterceptor.processLogs(testInfo);

                    instance.consoleHandler.dispose();
                    instance.apiInterceptor.dispose();

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
});

export { expect } from '@playwright/test';
