import { Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface ApiRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: Date;
    userInfo?: {
        userIndex?: number;
        userEmail?: string;
    };
}

interface ApiResponse {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: Date;
    userInfo?: {
        userIndex?: number;
        userEmail?: string;
    };
}

interface ApiInterceptorOptions {
    userIndex?: number;
    userEmail?: string;
    testInfo?: TestInfo;
}

/**
 * API interceptor that records all API requests and responses to a file for debugging.
 * Similar to the unified console handler but for API traffic.
 */
export class ApiInterceptor {
    private requests: ApiRequest[] = [];
    private responses: ApiResponse[] = [];
    private logFile: string = '';
    private disposed = false;

    constructor(
        private page: Page,
        private options: ApiInterceptorOptions = {},
    ) {
        this.setupLogFile();
        this.attachInterceptors();
    }

    private setupLogFile(): void {
        const { userIndex = 0, testInfo } = this.options;

        // Create log file path
        const testDir = testInfo?.outputDir || path.join(process.cwd(), 'e2e-tests', 'playwright-report', 'output');
        const browserSuffix = `browser-${userIndex + 1}`;
        this.logFile = path.join(testDir, `${browserSuffix}-api.log`);

        // Ensure directory exists
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // Initialize log file
        const header = `API requests/responses for Browser ${userIndex + 1}\n`;
        fs.writeFileSync(this.logFile, header, 'utf8');
    }

    private attachInterceptors(): void {
        // Set up a request/response event listener instead of route interception
        // This approach doesn't conflict with test-specific route handlers
        this.page.on('request', (request) => {
            if (this.disposed) return;

            const url = request.url();
            // Only track API requests
            if (!url.includes('/api/')) return;

            const timestamp = new Date();

            // Record request
            const apiRequest: ApiRequest = {
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                body: request.postData() || undefined,
                timestamp,
                userInfo: {
                    userIndex: this.options.userIndex,
                    userEmail: this.options.userEmail,
                },
            };

            this.requests.push(apiRequest);

            // Log request
            const requestLog = `[${timestamp.toISOString()}] REQUEST: ${apiRequest.method} ${apiRequest.url}\n`;
            fs.appendFileSync(this.logFile, requestLog, 'utf8');

            if (apiRequest.body) {
                const bodyLog = `  Body: ${apiRequest.body}\n`;
                fs.appendFileSync(this.logFile, bodyLog, 'utf8');
            }
        });

        this.page.on('response', (response) => {
            if (this.disposed) return;

            const url = response.url();
            // Only track API responses
            if (!url.includes('/api/')) return;

            const timestamp = new Date();

            // Record response
            const apiResponse: ApiResponse = {
                url: response.url(),
                status: response.status(),
                statusText: response.statusText(),
                headers: response.headers(),
                body: undefined, // We'll get body separately
                timestamp,
                userInfo: {
                    userIndex: this.options.userIndex,
                    userEmail: this.options.userEmail,
                },
            };

            this.responses.push(apiResponse);

            // Log response
            const responseLog = `[${timestamp.toISOString()}] RESPONSE: ${apiResponse.status} ${apiResponse.statusText} for ${apiResponse.url}\n`;
            fs.appendFileSync(this.logFile, responseLog, 'utf8');

            // Try to get response body asynchronously
            response
                .text()
                .then((body) => {
                    if (body && !this.disposed) {
                        const bodyLog = `  Body: ${body}\n`;
                        fs.appendFileSync(this.logFile, bodyLog, 'utf8');
                    }
                    // Add separator for readability
                    fs.appendFileSync(this.logFile, '\n', 'utf8');
                })
                .catch((error) => {
                    if (!this.disposed) {
                        const errorLog = `  Body read error: ${error}\n\n`;
                        fs.appendFileSync(this.logFile, errorLog, 'utf8');
                    }
                });
        });
    }

    /**
     * Process and attach API logs to test report
     */
    async processLogs(testInfo: TestInfo): Promise<void> {
        if (this.disposed) return;

        const hasApiTraffic = this.requests.length > 0 || this.responses.length > 0;

        if (hasApiTraffic) {
            // Only attach file path reference, not full content (reduces console verbosity)
            if (fs.existsSync(this.logFile)) {
                const filename = path.basename(this.logFile);
                const fileUrl = `file://${this.logFile}`;
                await testInfo.attach(filename, {
                    body: `See: ${fileUrl}`,
                    contentType: 'text/plain',
                });
            }
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.disposed = true;
    }
}

/**
 * Create and attach an API interceptor to a page
 */
export function attachApiInterceptor(page: Page, options: ApiInterceptorOptions = {}): ApiInterceptor {
    return new ApiInterceptor(page, options);
}
