import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface ConsoleError {
    message: string;
    type: string;
    location?: {
        url?: string;
        lineNumber?: number;
        columnNumber?: number;
    };
    timestamp: Date;
}

interface PageError {
    name: string;
    message: string;
    stack?: string;
    timestamp: Date;
}

/**
 * Sets up automatic console error detection for all tests.
 * This system:
 * 1. Detects console errors and page errors during test execution
 * 2. On test failure, points to console log files created by fixtures
 * 3. Fails tests if console errors are detected (unless explicitly allowed)
 * 4. Attaches error summaries to the test report
 *
 * Console log files are created by test fixtures. Error detection can be 
 * disabled with @skip-error-checking annotation.
 */
export function setupConsoleErrorReporting() {
    let consoleErrors: ConsoleError[] = [];
    let pageErrors: PageError[] = [];
    test.beforeEach(async ({ page }) => {
        // Clear arrays for each test
        consoleErrors = [];
        pageErrors = [];

        // Capture console errors only (console logging to files is handled by fixtures)
        page.on('console', (msg) => {
            const msgType = msg.type();
            
            // Only track errors for test failure detection
            if (msgType === 'error') {
                const msgText = msg.text();
                const location = msg.location();
                const timestamp = new Date();

                consoleErrors.push({
                    message: msgText,
                    type: msgType,
                    location: location
                        ? {
                              url: location.url,
                              lineNumber: location.lineNumber,
                              columnNumber: location.columnNumber,
                          }
                        : undefined,
                    timestamp,
                });
            }
        });

        // Capture page errors (uncaught exceptions)
        page.on('pageerror', (error) => {
            pageErrors.push({
                name: error.name,
                message: error.message,
                stack: error.stack,
                timestamp: new Date(),
            });
        });
    });

    test.afterEach(async ({}, testInfo) => {
        const hasConsoleErrors = consoleErrors.length > 0;
        const hasPageErrors = pageErrors.length > 0;
        const testFailed = testInfo.status === 'failed' || testInfo.status === 'timedOut';

        // Check if this test has skip-error-checking annotation
        const skipErrorChecking = testInfo.annotations.some((annotation) => annotation.type === 'skip-error-checking');

        // On test failure, point to console log files instead of dumping content
        if (testFailed) {
            const consoleLogFiles: string[] = [];
            
            if (testInfo.outputDir && fs.existsSync(testInfo.outputDir)) {
                try {
                    const files = fs.readdirSync(testInfo.outputDir);
                    const logFiles = files.filter((file: string) => file.endsWith('-console.log'));
                    logFiles.forEach((file: string) => {
                        consoleLogFiles.push(path.join(testInfo.outputDir, file));
                    });
                } catch (error) {
                    // Ignore file system errors
                }
            }
            
            if (consoleLogFiles.length > 0) {
                console.log('\n' + '='.repeat(80));
                console.log('📋 BROWSER CONSOLE LOGS (Test Failed)');
                console.log('='.repeat(80));
                console.log(`Test: ${testInfo.title}`);
                console.log(`File: ${testInfo.file}`);
                console.log(`📄 Console logs captured in files:`);
                consoleLogFiles.forEach((filePath, index) => {
                    console.log(`  ${index + 1}. ${filePath}`);
                });
                console.log('='.repeat(80) + '\n');
            }
        }

        if ((hasConsoleErrors || hasPageErrors) && !skipErrorChecking) {
            // Print error summary
            console.log('\n' + '='.repeat(80));
            console.log('❌ BROWSER ERRORS DETECTED');
            console.log('='.repeat(80));
            console.log(`Test: ${testInfo.title}`);
            console.log(`File: ${testInfo.file}`);

            if (hasConsoleErrors) {
                console.log(`\n📋 Console Errors (${consoleErrors.length}):\n`);
                console.log('Console errors detected in browser. Details are in the console log files above.');
            }

            if (hasPageErrors) {
                console.log(`\n⚠️  Page Errors (${pageErrors.length}):`);
                // Show only first 2 page errors, detailed errors are in test attachments
                pageErrors.slice(0, 2).forEach((err, index) => {
                    console.log(`\n  ${index + 1}. ${err.name}: ${err.message}`);
                    console.log(`     time: ${err.timestamp.toISOString()}`);
                });
                if (pageErrors.length > 2) {
                    console.log(`\n  ... and ${pageErrors.length - 2} more (see test attachments for full details)`);
                }
            }

            console.log('\n' + '='.repeat(80) + '\n');

            // Attach console errors to test report
            if (hasConsoleErrors) {
                const consoleErrorReport = consoleErrors
                    .map(
                        (err, index) =>
                            `${index + 1}. ${err.type.toUpperCase()}: ${err.message}\n` +
                            `   Location: ${err.location?.url || 'unknown'}:${err.location?.lineNumber || '?'}:${err.location?.columnNumber || '?'}\n` +
                            `   Time: ${err.timestamp.toISOString()}`,
                    )
                    .join('\n\n');

                await testInfo.attach('console-errors.txt', {
                    body: consoleErrorReport,
                    contentType: 'text/plain',
                });
            }

            // Console output is now captured in files by the multi-user fixture

            // Attach page errors to test report
            if (hasPageErrors) {
                const pageErrorReport = pageErrors
                    .map((err, index) => `${index + 1}. ${err.name}: ${err.message}\n` + `${err.stack ? `Stack trace:\n${err.stack}\n` : ''}` + `Time: ${err.timestamp.toISOString()}`)
                    .join('\n\n');

                await testInfo.attach('page-errors.txt', {
                    body: pageErrorReport,
                    contentType: 'text/plain',
                });
            }

            // FAIL THE TEST if there are errors and test hasn't already failed
            if (testInfo.status !== 'failed') {
                throw new Error(`Test had ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s). Check console log files above for details.`);
            }
        } else if ((hasConsoleErrors || hasPageErrors) && skipErrorChecking) {
            // Log that errors were detected but ignored due to annotation
            console.log('\n' + '='.repeat(80));
            console.log('⚠️  ERRORS DETECTED BUT IGNORED (skip-error-checking annotation)');
            console.log('='.repeat(80));
            console.log(`Console errors: ${consoleErrors.length}, Page errors: ${pageErrors.length}`);
            console.log('These errors are expected for this test.');
            console.log('='.repeat(80) + '\n');
        }
    });
}
