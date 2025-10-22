import { Page, TestInfo } from '@playwright/test';
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
    userInfo?: {
        userIndex?: number;
        userEmail?: string;
    };
}

interface PageError {
    name: string;
    message: string;
    stack?: string;
    timestamp: Date;
    userInfo?: {
        userIndex?: number;
        userEmail?: string;
    };
}

interface ConsoleHandlerOptions {
    userIndex?: number;
    userEmail?: string;
    testInfo?: TestInfo;
}

/**
 * Unified console handler that combines console log file writing and error detection.
 * This replaces both the createUserFixture console logging and setupConsoleErrorReporting.
 */
export class UnifiedConsoleHandler {
    private consoleErrors: ConsoleError[] = [];
    private pageErrors: PageError[] = [];
    private logFile: string = '';
    private disposed = false;

    /**
     * Patterns for Firebase connection errors that should be ignored.
     * These are transient connection issues that Firebase handles with retries.
     */
    private readonly ignorableFirebaseErrors = [
        /Could not reach Cloud Firestore backend/,
        /Connection failed \d+ times/,
        /FirebaseError: \[code=unavailable\]: The operation could not be completed/,
        /device does not have a healthy Internet connection/,
        /client will operate in offline mode/,
        /@firebase\/firestore.*unavailable/i,
    ];

    constructor(
        private page: Page,
        private options: ConsoleHandlerOptions = {},
    ) {
        this.setupLogFile();
        this.attachListeners();
    }

    private setupLogFile(): void {
        const { userIndex = 0, userEmail, testInfo } = this.options;

        // Create log file path
        const testDir = testInfo?.outputDir || path.join(process.cwd(), 'e2e-tests', 'playwright-output', 'integration', 'data');
        const browserSuffix = `browser-${userIndex + 1}`;
        this.logFile = path.join(testDir, `${browserSuffix}-console.log`);

        // Ensure directory exists (including all parent directories)
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Initialize log file
        const header = `Console logs for ${userEmail || `Browser ${userIndex + 1}`}\n`;
        fs.writeFileSync(this.logFile, header, 'utf8');
    }

    /**
     * Check if a console error should be ignored (e.g., Firebase connection errors)
     */
    private shouldIgnoreError(errorMessage: string): boolean {
        return this.ignorableFirebaseErrors.some((pattern) => pattern.test(errorMessage));
    }

    private attachListeners(): void {
        // Console message listener - handles both logging and error tracking
        this.page.on('console', (msg) => {
            if (this.disposed) return;

            const timestamp = new Date();
            const msgType = msg.type();
            const msgText = msg.text();

            // Always log to file for debugging
            const logEntry = `[${timestamp.toISOString()}] ${msgType.toUpperCase()}: ${msgText}\n`;
            fs.appendFileSync(this.logFile, logEntry, 'utf8');

            // Track errors for test failure detection (but filter out ignorable Firebase errors)
            if (msgType === 'error') {
                if (this.shouldIgnoreError(msgText)) {
                    // Log that we're ignoring this Firebase error for debugging
                    const ignoredLogEntry = `[${timestamp.toISOString()}] IGNORED FIREBASE ERROR: ${msgText}\n`;
                    fs.appendFileSync(this.logFile, ignoredLogEntry, 'utf8');
                } else {
                    const location = msg.location();
                    this.consoleErrors.push({
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
                        userInfo: {
                            userIndex: this.options.userIndex,
                            userEmail: this.options.userEmail,
                        },
                    });
                }
            }
        });

        // Page error listener (uncaught exceptions)
        this.page.on('pageerror', (error) => {
            if (this.disposed) return;

            const timestamp = new Date();

            // Log to file
            const logEntry = `[${timestamp.toISOString()}] PAGE ERROR: ${error.name}: ${error.message}\n${error.stack || ''}\n`;
            fs.appendFileSync(this.logFile, logEntry, 'utf8');

            // Track for test failure detection
            this.pageErrors.push({
                name: error.name,
                message: error.message,
                stack: error.stack,
                timestamp,
                userInfo: {
                    userIndex: this.options.userIndex,
                    userEmail: this.options.userEmail,
                },
            });
        });
    }

    /**
     * Format user information for error reporting
     */
    private formatUserInfo(userInfo?: { userIndex?: number; userEmail?: string; }): string {
        if (!userInfo || (userInfo.userIndex === undefined && !userInfo.userEmail)) {
            return 'unknown user';
        }

        const parts = [];
        if (userInfo.userIndex !== undefined) {
            parts.push(`Browser ${userInfo.userIndex + 1}`);
        }
        if (userInfo.userEmail) {
            parts.push(`(${userInfo.userEmail})`);
        }

        return parts.length > 0 ? parts.join(' ') : 'unknown user';
    }

    /**
     * Process errors and potentially fail test
     */
    async processErrors(testInfo: TestInfo): Promise<void> {
        if (this.disposed) return;

        const hasConsoleErrors = this.consoleErrors.length > 0;
        const hasPageErrors = this.pageErrors.length > 0;
        const testFailed = testInfo.status === 'failed' || testInfo.status === 'timedOut';

        // Check if this test has skip-error-checking annotation
        const skipErrorChecking = testInfo.annotations.some((annotation) => annotation.type === 'skip-error-checking');

        // Attach console log if test failed OR if there are errors (so it's available before we throw)
        if (testFailed || hasConsoleErrors || hasPageErrors) {
            // Attach console log file reference
            if (fs.existsSync(this.logFile)) {
                const filename = path.basename(this.logFile);
                const fileUrl = `file://${this.logFile}`;

                // Attach file path reference only (consistent with API log format)
                await testInfo.attach(filename, {
                    body: `See: ${fileUrl}`,
                    contentType: 'text/plain',
                });
            } else {
                console.log(`\n⚠️  Console log file not found: ${this.logFile}\n`);
            }
        }

        if ((hasConsoleErrors || hasPageErrors) && !skipErrorChecking) {
            // Print error summary
            console.log('❌ BROWSER ERRORS DETECTED');

            if (hasPageErrors) {
                console.log(`\n⚠️  Page Errors (${this.pageErrors.length}):`);
                // Show only first 2 page errors, detailed errors are in test attachments
                this.pageErrors.slice(0, 2).forEach((err, index) => {
                    console.log(`\n  ${index + 1}. ${err.name}: ${err.message}`);
                    console.log(`     time: ${err.timestamp.toISOString()}`);
                });
                if (this.pageErrors.length > 2) {
                    console.log(`\n  ... and ${this.pageErrors.length - 2} more (see test attachments for full details)`);
                }
            }

            console.log('\n' + '='.repeat(80) + '\n');

            // FAIL THE TEST if there are errors and test hasn't already failed
            if (testInfo.status !== 'failed') {
                // Create detailed error message with user information
                let errorMessage = `Test had ${this.consoleErrors.length} console error(s) and ${this.pageErrors.length} page error(s).`;

                if (this.consoleErrors.length > 0) {
                    const consoleErrorUsers = this
                        .consoleErrors
                        .map((error) => {
                            return this.formatUserInfo(error.userInfo);
                        })
                        .filter((user, index, arr) => arr.indexOf(user) === index) // unique users
                        .join(', ');
                    errorMessage += ` Console errors from: ${consoleErrorUsers}.`;
                }

                if (this.pageErrors.length > 0) {
                    const pageErrorUsers = this
                        .pageErrors
                        .map((error) => {
                            const userInfo = this.formatUserInfo(error.userInfo);
                            // Debug: log what user info we have for this error
                            console.log(`Page error userInfo:`, error.userInfo, `formatted as:`, userInfo);
                            return userInfo;
                        })
                        .filter((user, index, arr) => arr.indexOf(user) === index) // unique users
                        .join(', ');
                    errorMessage += ` Page errors from: ${pageErrorUsers}.`;
                }

                errorMessage += ' Check console log file above for details.';

                throw new Error(errorMessage);
            }
        } else if ((hasConsoleErrors || hasPageErrors) && skipErrorChecking) {
            // Log that errors were detected but ignored due to annotation
            console.log('\n' + '='.repeat(80));
            console.log('⚠️  ERRORS DETECTED BUT IGNORED (skip-error-checking annotation)');
            console.log('='.repeat(80));

            let ignoredMessage = `Console errors: ${this.consoleErrors.length}, Page errors: ${this.pageErrors.length}`;

            if (this.consoleErrors.length > 0) {
                const consoleErrorUsers = this
                    .consoleErrors
                    .map((error) => this.formatUserInfo(error.userInfo))
                    .filter((user, index, arr) => arr.indexOf(user) === index)
                    .join(', ');
                ignoredMessage += ` (Console errors from: ${consoleErrorUsers})`;
            }

            if (this.pageErrors.length > 0) {
                const pageErrorUsers = this
                    .pageErrors
                    .map((error) => this.formatUserInfo(error.userInfo))
                    .filter((user, index, arr) => arr.indexOf(user) === index)
                    .join(', ');
                ignoredMessage += ` (Page errors from: ${pageErrorUsers})`;
            }

            console.log(ignoredMessage);

            // Always show console log file path when there are errors
            if (fs.existsSync(this.logFile)) {
                const fileUrl = `file://${this.logFile}`;
                console.log(`Console log: ${fileUrl}`);
            }

            console.log('='.repeat(80) + '\n');
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.disposed = true;
        // Note: We don't remove page listeners as that would interfere with other handlers
        // The listeners will be automatically cleaned up when the page is closed
    }
}

/**
 * Create and attach a unified console handler to a page
 */
export function attachConsoleHandler(page: Page, options: ConsoleHandlerOptions = {}): UnifiedConsoleHandler {
    return new UnifiedConsoleHandler(page, options);
}
