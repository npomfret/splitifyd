import { BrowserContext, Page } from '@playwright/test';
import { PooledTestUser } from '@splitifyd/shared';
import { ApiDriver } from '@splitifyd/test-support';
import { ApiInterceptor, attachApiInterceptor, attachConsoleHandler, attachScreenshotHandler, ScreenshotHandler, UnifiedConsoleHandler } from '../helpers';
import { DashboardPage, LoginPage } from '../pages';
import { AuthenticationWorkflow } from '../workflows';
import { baseTest } from './base-test';
import { getUserPool } from './user-pool.fixture';

interface BrowserInstance {
    page: Page;
    context: BrowserContext;
    user?: PooledTestUser;
    apiInterceptor: ApiInterceptor;
    consoleHandler: UnifiedConsoleHandler;
    screenshotHandler: ScreenshotHandler;
}

interface SimpleTestFixtures {
    newEmptyBrowser(): Promise<{ page: Page; loginPage: LoginPage; }>;

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
    createLoggedInBrowsers(count: number): Promise<Array<{ page: Page; dashboardPage: DashboardPage; user: PooledTestUser; }>>;
}

const apiDriver = new ApiDriver();

export const simpleTest = baseTest.extend<SimpleTestFixtures>({
    newEmptyBrowser: async ({ browser }, use, testInfo) => {
        const browserInstances: BrowserInstance[] = [];

        const createEmptyBrowser = async () => {
            // Create new browser context with isolated storage
            // This ensures no auth state leaks from previous tests
            const context = await browser.newContext({
                storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
            });
            const page = await context.newPage();

            // Set up API interceptor
            const userIndex = browserInstances.length; // Use current length as index for this user
            const apiInterceptor = attachApiInterceptor(page, { testInfo, userIndex });

            // Set up console handler
            const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex });

            // Set up screenshot handler
            const screenshotHandler = attachScreenshotHandler(page, { testInfo, userIndex });

            // Navigate to login page
            const loginPage = new LoginPage(page);
            await loginPage.navigate();

            // Track this browser instance for cleanup
            const browserInstance: BrowserInstance = {
                page,
                context,
                apiInterceptor,
                consoleHandler,
                screenshotHandler,
            };
            browserInstances.push(browserInstance);

            return { page, loginPage };
        };

        await use(createEmptyBrowser);

        // Cleanup all browser instances
        await Promise.all(
            browserInstances.map(async (instance) => {
                try {
                    // Take error screenshot if test failed
                    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
                        await instance.screenshotHandler.takeErrorScreenshot(testInfo);
                    }

                    // Process any logs that occurred during the test
                    await instance.apiInterceptor.processLogs(testInfo);
                    await instance.consoleHandler.processErrors(testInfo);

                    instance.apiInterceptor.dispose();
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
            await Promise.all(users.map((user) => apiDriver.acceptCurrentPublishedPolicies(user.token)));

            // Then create browsers and login in parallel
            const browserPromises = users.map(async (user, index) => {
                // Create new browser context with isolated storage
                // This ensures no auth state leaks from previous tests
                const context = await browser.newContext({
                    storageState: undefined, // Start with clean storage (no cookies, localStorage, IndexedDB)
                });
                const page = await context.newPage();

                // Set up API interceptor
                const userIndex = browserInstances.length + index; // Use current length + index for this user
                const apiInterceptor = attachApiInterceptor(page, { testInfo, userIndex, userEmail: user.email });

                // Set up console handler
                const consoleHandler = attachConsoleHandler(page, { testInfo, userIndex, userEmail: user.email });

                // Set up screenshot handler
                const screenshotHandler = attachScreenshotHandler(page, { testInfo, userIndex });

                const authWorkflow = new AuthenticationWorkflow(page);
                await authWorkflow.loginExistingUser(user);

                // Create dashboard page
                const dashboardPage = new DashboardPage(page);

                // Wait for dashboard to be fully loaded (including "Loading your groups" spinner)
                await dashboardPage.waitForDashboard();

                // Track this browser instance for cleanup
                const browserInstance: BrowserInstance = {
                    page,
                    context,
                    user,
                    apiInterceptor,
                    consoleHandler,
                    screenshotHandler,
                };

                const displayName = await dashboardPage.header.getCurrentUserDisplayName();

                console.log(`Browser ${index + 1} using "${displayName}" ${user.email} (uid: ${user.uid})`);

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
                    // Take error screenshot if test failed
                    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
                        await instance.screenshotHandler.takeErrorScreenshot(testInfo);
                    }

                    // Process any logs that occurred during the test
                    await instance.apiInterceptor.processLogs(testInfo);
                    await instance.consoleHandler.processErrors(testInfo);

                    instance.apiInterceptor.dispose();
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
});

export { expect } from '@playwright/test';
