import { Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PathUtils } from './path-utils';

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
        const { userIndex = 0, userEmail, testInfo } = this.options;

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
     * Set up specific route interceptor for debugging specific API endpoints
     * Note: This method is deprecated since we now use event listeners instead of route interception
     * to avoid conflicts with test-specific routes. The general API interceptor will capture all API traffic.
     */
    addSpecificInterceptor(pattern: string, debugLabel?: string): void {
        console.log(`API Interceptor: ${debugLabel || 'Specific interceptor'} for pattern ${pattern} - using general event-based tracking instead`);
        // No-op since we're using event listeners now
    }

    /**
     * Update user information for better request/response tracking
     */
    updateUserInfo(userInfo: { userIndex?: number; userEmail?: string }): void {
        this.options = { ...this.options, ...userInfo };
    }

    /**
     * Get summary of recorded API traffic
     */
    getSummary(): { requestCount: number; responseCount: number; logFile: string } {
        return {
            requestCount: this.requests.length,
            responseCount: this.responses.length,
            logFile: this.logFile,
        };
    }

    /**
     * Process and attach API logs to test report
     */
    async processLogs(testInfo: TestInfo): Promise<void> {
        if (this.disposed) return;

        const hasApiTraffic = this.requests.length > 0 || this.responses.length > 0;
        const testFailed = testInfo.status === 'failed' || testInfo.status === 'timedOut';

        // On test failure, point to API log files
        if (testFailed && hasApiTraffic) {
            const relativePath = PathUtils.getRelativePathWithFileUrl(this.logFile);
            console.log('\n' + '='.repeat(80));
            console.log('🌐 API REQUEST/RESPONSE LOGS (Test Failed)');
            console.log('='.repeat(80));
            console.log(`Test: ${testInfo.title}`);
            console.log(`File: ${testInfo.file}`);
            console.log(`📄 API log: ${relativePath}`);
            console.log(`📊 Requests: ${this.requests.length}, Responses: ${this.responses.length}`);
            console.log('='.repeat(80) + '\n');
        }

        if (hasApiTraffic) {
            // Create API summary report
            const summary = `API Traffic Summary:
Requests: ${this.requests.length}
Responses: ${this.responses.length}
Log file: ${this.logFile}

Recent requests:
${this.requests
    .slice(-5)
    .map((req) => `${req.method} ${req.url} (${req.timestamp.toISOString()})`)
    .join('\n')}

Recent responses:
${this.responses
    .slice(-5)
    .map((res) => `${res.status} ${res.url} (${res.timestamp.toISOString()})`)
    .join('\n')}`;

            await testInfo.attach('api-traffic-summary.txt', {
                body: summary,
                contentType: 'text/plain',
            });

            // Attach the full log file if it exists
            if (fs.existsSync(this.logFile)) {
                const logContent = fs.readFileSync(this.logFile, 'utf8');
                await testInfo.attach('api-traffic.log', {
                    body: logContent,
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
