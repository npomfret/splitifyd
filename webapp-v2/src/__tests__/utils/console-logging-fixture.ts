import { Page, test as base } from '@playwright/test';
import { ClientUser } from '@splitifyd/shared';
import { ClientUserBuilder } from '@splitifyd/test-support';
import * as fs from 'fs';
import { createMockFirebase, MockFirebase, mockFullyAcceptedPoliciesApi } from './mock-firebase-service';
import { createConsoleLogPath, createScreenshotPath, createTestDirectory, logTestArtifactPaths } from './test-utils';

/**
 * Extended test fixture that provides automatic console logging and enhanced failure handling
 */

type ConsoleLoggingFixtures = {
    pageWithLogging: Page;
    mockFirebase: MockFirebase;
    authenticatedMockFirebase: (user: ClientUser) => Promise<MockFirebase>;
    authenticatedPage: { page: Page; user: ClientUser; mockFirebase: MockFirebase; };
};

// Add an afterEach hook to handle final reporting
base.afterEach(async ({}, testInfo) => {
    // This will run after each test with access to final test status
    const testPassed = testInfo.status === 'passed';

    if (!testPassed) {
        // Find the console log file for this test
        const testDir = createTestDirectory(testInfo);
        const consoleLogPath = createConsoleLogPath(testDir);

        const artifactPaths: { [key: string]: string; } = {
            'Console Log': consoleLogPath,
            'Test Directory': testDir,
        };

        // Find Playwright's screenshot from attachments
        const screenshotAttachment = testInfo.attachments.find((a) => a.name === 'screenshot' && a.contentType === 'image/png');

        if (screenshotAttachment && screenshotAttachment.path) {
            // Report the actual Playwright screenshot path
            artifactPaths['Screenshot (Playwright)'] = screenshotAttachment.path;

            // Also create a symlink in our test directory for convenience
            const symlinkPath = createScreenshotPath(testDir);
            try {
                // Remove old symlink if it exists
                if (fs.existsSync(symlinkPath)) {
                    fs.unlinkSync(symlinkPath);
                }
                // Create symlink to Playwright's screenshot
                fs.symlinkSync(screenshotAttachment.path, symlinkPath);
                artifactPaths['Screenshot (symlink)'] = symlinkPath;
            } catch (err) {
                // Symlink creation failed, just use the Playwright path
            }
        }

        // Show comprehensive debugging information
        console.log(`\n💥 TEST FAILED: ${testInfo.title}`);
        console.log(`📁 Debug files:`);
        logTestArtifactPaths('', artifactPaths);

        // Show browser errors from console log if any exist
        if (fs.existsSync(consoleLogPath)) {
            const logContent = fs.readFileSync(consoleLogPath, 'utf8');
            const browserErrors = logContent.split('\n').filter((line) => line.includes('ERROR:') || line.includes('PAGE_ERROR:') || line.includes('REQUEST_FAILED:'));

            if (browserErrors.length > 0) {
                console.log(`🔴 Browser issues detected:`);
                browserErrors.slice(0, 5).forEach((error) => {
                    const cleanError = error.replace(/^\[[^\]]+\]\s*/, '').trim();
                    if (cleanError) console.log(`   ${cleanError}`);
                });
                if (browserErrors.length > 5) {
                    console.log(`   ... and ${browserErrors.length - 5} more (see console.log file)`);
                }
            }
        } else {
            console.log(`⚠️  Console log file not found at: ${consoleLogPath}`);
        }
    }
});

export const test = base.extend<ConsoleLoggingFixtures>({
    /**
     * Mock Firebase fixture - automatically disposed after each test
     * Starts with no authenticated user (logged out state)
     */
    mockFirebase: async ({ pageWithLogging }, use) => {
        const mock = await createMockFirebase(pageWithLogging, null);
        await use(mock);
        await mock.dispose();
    },

    /**
     * Factory fixture for creating authenticated mock Firebase
     * Useful when you need to create mock with a specific user
     */
    authenticatedMockFirebase: async ({ pageWithLogging }, use) => {
        const mocks: MockFirebase[] = [];

        await use(async (user: ClientUser) => {
            const mock = await createMockFirebase(pageWithLogging, user);
            mocks.push(mock);
            return mock;
        });

        // Cleanup all mocks created during the test
        for (const mock of mocks) {
            await mock.dispose();
        }
    },

    /**
     * Authenticated page fixture - provides a pre-authenticated test user with policies accepted
     * Eliminates the need for manual beforeEach/afterEach mock management
     *
     * Usage:
     *   test('my test', async ({ authenticatedPage }) => {
     *       const { page, user, mockFirebase } = authenticatedPage;
     *       // page is authenticated, policies accepted, ready to test
     *   });
     */
    authenticatedPage: async ({ pageWithLogging }, use) => {
        const testUser = ClientUserBuilder
            .validUser()
            .build();
        const mockFirebase = await createMockFirebase(pageWithLogging, testUser);
        await mockFullyAcceptedPoliciesApi(pageWithLogging);

        await use({
            page: pageWithLogging,
            user: testUser,
            mockFirebase,
        });

        await mockFirebase.dispose();
    },

    pageWithLogging: async ({ page }, use, testInfo) => {
        // Create test-specific directory
        const testDir = createTestDirectory(testInfo);
        const consoleLogPath = createConsoleLogPath(testDir);

        // Create console log file and write header
        const logStream = fs.createWriteStream(consoleLogPath, { flags: 'w' });
        logStream.write(`Console Log for Test: ${testInfo.title}\n`);
        logStream.write(`Suite: ${testInfo.titlePath[0]}\n`);
        logStream.write(`Started: ${new Date().toISOString()}\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        // Track all console messages
        const consoleMessages: string[] = [];

        // Set up console message listener
        const consoleListener = (msg: any) => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${msg.type().toUpperCase()}: ${msg.text()}\n`;

            // Write to file immediately
            logStream.write(logEntry);

            // Store for potential error reporting
            consoleMessages.push(logEntry.trim());

            // Store errors for potential failure reporting (don't log immediately)
            if (msg.type() === 'error') {
                consoleMessages.push(`🔴 BROWSER ERROR: ${msg.text()}`);
            }
        };
        page.on('console', consoleListener);

        // Set up page error listener for uncaught exceptions
        const pageErrorListener = (error: Error) => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] PAGE_ERROR: ${error.message}\n${error.stack}\n\n`;

            logStream.write(logEntry);
            consoleMessages.push(`🔴 PAGE ERROR: ${error.message}`);
        };
        page.on('pageerror', pageErrorListener);

        // Set up request failure listener
        const requestFailedListener = (request: any) => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] REQUEST_FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}\n`;

            logStream.write(logEntry);
            consoleMessages.push(`🔴 REQUEST FAILED: ${request.method()} ${request.url()}`);
        };
        page.on('requestfailed', requestFailedListener);

        // Clean browser state before each test for isolation
        await page.context().clearCookies();

        // Note: localStorage/sessionStorage clearing temporarily disabled
        // to avoid interference with test setup. The storageState: undefined
        // in playwright.config.ts provides isolation between tests.

        let testPassed = true;
        let testError: any = null;

        try {
            // Use the page with logging
            await use(page);
        } catch (error) {
            testPassed = false;
            testError = error;

            // Log fixture failure (this catch only runs for fixture errors, not test errors)
            const timestamp = new Date().toISOString();
            logStream.write(`\n${'='.repeat(80)}\n`);
            logStream.write(`[${timestamp}] FIXTURE_ERROR: ${error}\n`);

            // Note: Test failures are handled by Playwright directly and reported in afterEach
            // This catch block only captures fixture setup/teardown errors
        } finally {
            // Remove event listeners BEFORE closing stream to prevent "write after end" errors
            page.off('console', consoleListener);
            page.off('pageerror', pageErrorListener);
            page.off('requestfailed', requestFailedListener);

            // Write test completion info (status will be updated by afterEach)
            const timestamp = new Date().toISOString();
            logStream.write(`\n${'='.repeat(80)}\n`);
            logStream.write(`[${timestamp}] TEST_COMPLETED\n`);
            logStream.write(`Console messages captured: ${consoleMessages.length}\n`);
            logStream.write(`Completed: ${timestamp}\n`);

            // Close the log stream
            logStream.end();

            // Minimal output for passed tests (failures are handled by afterEach)
            if (testPassed) {
                console.log(`✅ ${testInfo.title} (${consoleMessages.length} console messages logged)`);
            }

            // Re-throw the error if there was one
            if (testError) {
                throw testError;
            }
        }
    },
});

export { expect } from '@playwright/test';
