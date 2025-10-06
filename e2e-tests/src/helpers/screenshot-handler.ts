import { Page, TestInfo } from '@playwright/test';

interface ScreenshotHandlerOptions {
    userIndex?: number;
    userEmail?: string;
    testInfo?: TestInfo;
}

/**
 * Custom screenshot handler that organizes screenshots by browser/user
 * and provides meaningful naming conventions.
 */
export class ScreenshotHandler {
    private userSuffix: string;

    constructor(
        private page: Page,
        private options: ScreenshotHandlerOptions = {},
    ) {
        const { userIndex = 0 } = this.options;
        this.userSuffix = `browser-${userIndex + 1}`;
    }

    /**
     * Take a screenshot and save it with organized naming and directory structure
     */
    async takeScreenshot(testInfo: TestInfo, name: string = 'screenshot'): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = `${this.userSuffix}-${name}-${timestamp}.png`;

            // Take screenshot
            const screenshot = await this.page.screenshot({ fullPage: true });

            // Attach to test with organized naming
            await testInfo.attach(screenshotName, {
                body: screenshot,
                contentType: 'image/png',
            });
        } catch (error) {
            console.warn(`Failed to take screenshot for ${this.userSuffix}: ${error}`);
        }
    }

    /**
     * Take a screenshot on error/failure with automatic naming
     */
    async takeErrorScreenshot(testInfo: TestInfo): Promise<void> {
        await this.takeScreenshot(testInfo, 'error');
    }
}

/**
 * Create and attach a screenshot handler to a page
 */
export function attachScreenshotHandler(page: Page, options: ScreenshotHandlerOptions = {}): ScreenshotHandler {
    return new ScreenshotHandler(page, options);
}
