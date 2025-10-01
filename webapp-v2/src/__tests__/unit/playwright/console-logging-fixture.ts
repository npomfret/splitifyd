import { test as base, Page } from '@playwright/test';
import * as fs from 'fs';
import { createTestDirectory, createConsoleLogPath, createScreenshotPath, logTestArtifactPaths } from './test-utils';

/**
 * Extended test fixture that provides automatic console logging and enhanced failure handling
 */

type ConsoleLoggingFixtures = {
    pageWithLogging: Page;
};

// Add an afterEach hook to handle final reporting
base.afterEach(async ({}, testInfo) => {
    // This will run after each test with access to final test status
    const testPassed = testInfo.status === 'passed';

    if (!testPassed) {
        // Find the console log file for this test
        const testDir = createTestDirectory(testInfo);
        const consoleLogPath = createConsoleLogPath(testDir);
        const screenshotPath = createScreenshotPath(testDir);

        const artifactPaths: { [key: string]: string } = {
            'Console Log': consoleLogPath,
            'Screenshot (on failure)': screenshotPath,
            'Test Directory': testDir
        };

        // Check if custom screenshot exists
        if (fs.existsSync(screenshotPath)) {
            artifactPaths['Custom Screenshot'] = screenshotPath;
        }

        // Show comprehensive debugging information
        console.log(`\n💥 TEST FAILED: ${testInfo.title}`);
        console.log(`📁 Debug files:`);
        logTestArtifactPaths('', artifactPaths);

        // Show browser errors from console log if any exist
        const logContent = fs.readFileSync(consoleLogPath, 'utf8');
        const browserErrors = logContent.split('\n').filter(line =>
            line.includes('ERROR:') || line.includes('PAGE_ERROR:') || line.includes('REQUEST_FAILED:')
        );

        if (browserErrors.length > 0) {
            console.log(`🔴 Browser issues detected:`);
            browserErrors.slice(0, 5).forEach(error => {
                const cleanError = error.replace(/^\[[^\]]+\]\s*/, '').trim();
                if (cleanError) console.log(`   ${cleanError}`);
            });
            if (browserErrors.length > 5) {
                console.log(`   ... and ${browserErrors.length - 5} more (see console.log file)`);
            }
        }
    }
});

export const test = base.extend<ConsoleLoggingFixtures>({
    pageWithLogging: async ({ page }, use, testInfo) => {
        // Create test-specific directory
        const testDir = createTestDirectory(testInfo);
        const consoleLogPath = createConsoleLogPath(testDir);
        const screenshotPath = createScreenshotPath(testDir);

        // Store file paths for potential failure reporting
        const artifactPaths: { [key: string]: string } = {
            'Console Log': consoleLogPath,
            'Screenshot (on failure)': screenshotPath,
            'Test Directory': testDir
        };

        // Create console log file and write header
        const logStream = fs.createWriteStream(consoleLogPath, { flags: 'w' });
        logStream.write(`Console Log for Test: ${testInfo.title}\n`);
        logStream.write(`Suite: ${testInfo.titlePath[0]}\n`);
        logStream.write(`Started: ${new Date().toISOString()}\n`);
        logStream.write(`${'='.repeat(80)}\n\n`);

        // Track all console messages
        const consoleMessages: string[] = [];

        // Set up console message listener
        page.on('console', (msg) => {
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
        });

        // Set up page error listener for uncaught exceptions
        page.on('pageerror', (error) => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] PAGE_ERROR: ${error.message}\n${error.stack}\n\n`;

            logStream.write(logEntry);
            consoleMessages.push(`🔴 PAGE ERROR: ${error.message}`);
        });

        // Set up request failure listener
        page.on('requestfailed', (request) => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] REQUEST_FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}\n`;

            logStream.write(logEntry);
            consoleMessages.push(`🔴 REQUEST FAILED: ${request.method()} ${request.url()}`);
        });

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

            // Log test failure
            const timestamp = new Date().toISOString();
            logStream.write(`\n${'='.repeat(80)}\n`);
            logStream.write(`[${timestamp}] TEST_FAILED: ${error}\n`);

            // Take screenshot on failure (in addition to Playwright's built-in screenshot)
            await page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
            artifactPaths['Custom Screenshot'] = screenshotPath;
        } finally {
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