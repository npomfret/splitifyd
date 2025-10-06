import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility functions for Playwright test setup and file management
 */

/**
 * Creates a test-specific directory path for storing test artifacts
 * @param testInfo - Playwright test info object containing test metadata
 * @returns The full path to the test-specific directory
 */
export function createTestDirectory(testInfo: any): string {
    // Clean test title for use in file path (remove special characters)
    const cleanTitle = testInfo.title
        .replace(/[^a-zA-Z0-9\s-_]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();

    // Create directory path: playwright-report/test-artifacts/{suite}/{test}
    const testDir = path.join(
        'playwright-report',
        'test-artifacts',
        testInfo.titlePath[0]
            .replace(/[^a-zA-Z0-9\s-_]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase(),
        cleanTitle,
    );

    // Ensure directory exists
    fs.mkdirSync(testDir, { recursive: true });

    return testDir;
}

/**
 * Creates a console log file path for a specific test
 * @param testDir - The test-specific directory path
 * @returns The full path to the console log file
 */
export function createConsoleLogPath(testDir: string): string {
    return path.join(testDir, 'console.log');
}

/**
 * Creates a screenshot file path for a specific test
 * @param testDir - The test-specific directory path
 * @param suffix - Optional suffix for the screenshot filename (e.g., 'failure', 'final-state')
 * @returns The full path to the screenshot file
 */
export function createScreenshotPath(testDir: string, suffix = 'failure'): string {
    return path.join(testDir, `screenshot-${suffix}.png`);
}

/**
 * Logs file locations to console for easy access during test runs
 * @param testTitle - The test title for identification (can be empty for failure scenarios)
 * @param filePaths - Object containing file paths to log
 */
export function logTestArtifactPaths(testTitle: string, filePaths: { [key: string]: string }): void {
    if (testTitle) {
        console.log(`\n🧪 Test: ${testTitle}`);
    }
    Object.entries(filePaths).forEach(([type, path]) => {
        console.log(`   ${type}: ${path}`);
    });
    if (testTitle) {
        console.log('');
    }
}
