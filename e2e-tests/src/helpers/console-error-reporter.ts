import { test } from '@playwright/test';

interface ConsoleMessage {
    message: string;
    type: string;
    location?: {
        url?: string;
        lineNumber?: number;
        columnNumber?: number;
    };
    timestamp: Date;
}

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
 * Sets up automatic console error reporting for all tests.
 * When a test fails, console errors and page errors are:
 * 1. Printed to the console for immediate visibility
 * 2. Attached to the test report for later review
 *
 * All browser console messages are collected but only output if the test fails.
 */
export function setupConsoleErrorReporting() {
    let consoleMessages: ConsoleMessage[] = [];
    let consoleErrors: ConsoleError[] = [];
    let pageErrors: PageError[] = [];

    test.beforeEach(async ({ page }) => {
        // Clear arrays for each test
        consoleMessages = [];
        consoleErrors = [];
        pageErrors = [];

        // Capture ALL console messages (but don't log them immediately)
        page.on('console', (msg) => {
            const msgType = msg.type();
            const msgText = msg.text();
            const location = msg.location();

            // Store all console messages
            consoleMessages.push({
                message: msgText,
                type: msgType,
                location: location
                    ? {
                          url: location.url,
                          lineNumber: location.lineNumber,
                          columnNumber: location.columnNumber,
                      }
                    : undefined,
                timestamp: new Date(),
            });

            // Also keep track of errors separately
            if (msgType === 'error') {
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
                    timestamp: new Date(),
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

        // Output all browser console messages if test failed
        if (testFailed && consoleMessages.length > 0) {
            console.log('\n' + '='.repeat(80));
            console.log('📋 BROWSER CONSOLE OUTPUT (Test Failed)');
            console.log('='.repeat(80));
            console.log(`Test: ${testInfo.title}`);
            console.log(`File: ${testInfo.file}`);
            console.log(`\nAll browser console messages (${consoleMessages.length} total):\n`);

            consoleMessages.forEach((msg, index) => {
                console.log(`[Browser Console ${msg.type.toUpperCase()}]: ${msg.message}`);
                if (msg.location?.url) {
                    console.log(`  at ${msg.location.url}:${msg.location.lineNumber}:${msg.location.columnNumber}`);
                }
            });
            console.log('='.repeat(80) + '\n');
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
                
                // Check for console log files in test output directory
                const fs = require('fs');
                const path = require('path');
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
                    console.log(`📄 Console logs captured in files:`);
                    consoleLogFiles.forEach((filePath, index) => {
                        console.log(`  ${index + 1}. ${filePath}`);
                    });
                } else {
                    // Fallback to showing first few errors if no files found
                    console.log('⚠️  No console log files found. Showing first 3 errors:');
                    consoleErrors.slice(0, 3).forEach((err, index) => {
                        console.log(`\n  ${index + 1}. ${err.type.toUpperCase()}: ${err.message}`);
                        if (err.location?.url) {
                            console.log(`     at ${err.location.url}:${err.location.lineNumber || '?'}:${err.location.columnNumber || '?'}`);
                        }
                        console.log(`     time: ${err.timestamp.toISOString()}`);
                    });
                }
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

            // Attach all console messages if test failed
            if (testFailed && consoleMessages.length > 0) {
                const allConsoleOutput = consoleMessages
                    .map(
                        (msg, index) =>
                            `${index + 1}. [${msg.type.toUpperCase()}]: ${msg.message}\n` +
                            `   Location: ${msg.location?.url || 'unknown'}:${msg.location?.lineNumber || '?'}:${msg.location?.columnNumber || '?'}\n` +
                            `   Time: ${msg.timestamp.toISOString()}`,
                    )
                    .join('\n\n');

                await testInfo.attach('all-console-output.txt', {
                    body: allConsoleOutput,
                    contentType: 'text/plain',
                });
            }

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
                throw new Error(`Test had ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s). Check console output above for details.`);
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
