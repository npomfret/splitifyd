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
}

interface PageError {
    name: string;
    message: string;
    stack?: string;
    timestamp: Date;
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

    constructor(
        private page: Page,
        private options: ConsoleHandlerOptions = {}
    ) {
        this.setupLogFile();
        this.attachListeners();
    }

    private setupLogFile(): void {
        const { userIndex = 0, userEmail, testInfo } = this.options;
        
        // Create log file path
        const testDir = testInfo?.outputDir || path.join(process.cwd(), 'e2e-tests', 'playwright-report', 'output');
        const userSuffix = userEmail ? userEmail.replace(/\s+/g, '-') : `user-${userIndex}`;
        this.logFile = path.join(testDir, `${userSuffix}-console.log`);
        
        // Ensure directory exists
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Initialize log file
        const header = `Console logs for ${userEmail || `User ${userIndex}`}\n`;
        fs.writeFileSync(this.logFile, header, 'utf8');
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

            // Track errors for test failure detection
            if (msgType === 'error') {
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
                });
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
            });
        });
    }

    /**
     * Get accumulated console and page errors
     */
    getErrors(): { consoleErrors: ConsoleError[]; pageErrors: PageError[] } {
        return {
            consoleErrors: [...this.consoleErrors],
            pageErrors: [...this.pageErrors]
        };
    }

    /**
     * Check if there are any errors
     */
    hasErrors(): boolean {
        return this.consoleErrors.length > 0 || this.pageErrors.length > 0;
    }

    /**
     * Clear accumulated errors
     */
    clearErrors(): void {
        this.consoleErrors = [];
        this.pageErrors = [];
    }

    /**
     * Get the log file path
     */
    getLogFilePath(): string {
        return this.logFile;
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
        const skipErrorChecking = testInfo.annotations.some(
            (annotation) => annotation.type === 'skip-error-checking'
        );

        // On test failure, point to console log files
        if (testFailed) {
            console.log('\n' + '='.repeat(80));
            console.log('📋 BROWSER CONSOLE LOGS (Test Failed)');
            console.log('='.repeat(80));
            console.log(`Test: ${testInfo.title}`);
            console.log(`File: ${testInfo.file}`);
            console.log(`📄 Console log: ${this.logFile}`);
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
                console.log(`\n📋 Console Errors (${this.consoleErrors.length}):\n`);
                console.log('Console errors detected in browser. Details are in the console log file above.');
            }

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

            // Attach console errors to test report
            if (hasConsoleErrors) {
                const consoleErrorReport = this.consoleErrors
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

            // Attach page errors to test report
            if (hasPageErrors) {
                const pageErrorReport = this.pageErrors
                    .map((err, index) => 
                        `${index + 1}. ${err.name}: ${err.message}\n` +
                        `${err.stack ? `Stack trace:\n${err.stack}\n` : ''}` +
                        `Time: ${err.timestamp.toISOString()}`
                    )
                    .join('\n\n');

                await testInfo.attach('page-errors.txt', {
                    body: pageErrorReport,
                    contentType: 'text/plain',
                });
            }

            // FAIL THE TEST if there are errors and test hasn't already failed
            if (testInfo.status !== 'failed') {
                throw new Error(
                    `Test had ${this.consoleErrors.length} console error(s) and ${this.pageErrors.length} page error(s). Check console log file above for details.`
                );
            }
        } else if ((hasConsoleErrors || hasPageErrors) && skipErrorChecking) {
            // Log that errors were detected but ignored due to annotation
            console.log('\n' + '='.repeat(80));
            console.log('⚠️  ERRORS DETECTED BUT IGNORED (skip-error-checking annotation)');
            console.log('='.repeat(80));
            console.log(`Console errors: ${this.consoleErrors.length}, Page errors: ${this.pageErrors.length}`);
            console.log('These errors are expected for this test.');
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
export function attachConsoleHandler(
    page: Page,
    options: ConsoleHandlerOptions = {}
): UnifiedConsoleHandler {
    return new UnifiedConsoleHandler(page, options);
}