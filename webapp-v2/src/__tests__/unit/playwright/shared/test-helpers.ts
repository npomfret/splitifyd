import { Page } from '@playwright/test';
import { createTestUsers } from '../stores/setup';

/**
 * Shared test helpers to reduce duplication across Playwright tests
 */

// Test configuration constants
export const TEST_CONFIG = {
    STANDARD_AMOUNT: 100,
    DEFAULT_CURRENCY: 'USD',
    DEFAULT_SPLIT_TYPE: 'equal' as const,
    COMMON_DESCRIPTIONS: ['Lunch', 'Dinner', 'Coffee', 'Gas'],
    DEFAULT_TIMEOUT: 5000,
} as const;

// Common test data
export const TEST_USERS = createTestUsers();

/**
 * Common test setup utilities
 */
export class TestHelpers {
    /**
     * Create a minimal test page with common structure
     */
    static async createTestPage(page: Page, content: string): Promise<void> {
        await page.setContent(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>Test Page</title>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
    }

    /**
     * Generate standard expense data for tests
     */
    static generateExpenseData(overrides?: Partial<ExpenseTestData>): ExpenseTestData {
        return {
            description: this.getRandomDescription(),
            amount: TEST_CONFIG.STANDARD_AMOUNT,
            currency: TEST_CONFIG.DEFAULT_CURRENCY,
            splitType: TEST_CONFIG.DEFAULT_SPLIT_TYPE,
            ...overrides,
        };
    }

    /**
     * Get a random description from common test descriptions
     */
    static getRandomDescription(): string {
        const descriptions = TEST_CONFIG.COMMON_DESCRIPTIONS;
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    /**
     * Generate a unique test identifier
     */
    static generateTestId(prefix = 'test'): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Wait with proper error handling
     */
    static async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Common assertion helpers
 */
export class CommonAssertions {
    /**
     * Verify element is visible and enabled
     */
    static async verifyElementReady(page: Page, selector: string): Promise<void> {
        const element = page.locator(selector);
        await element.waitFor({ state: 'visible' });
        await element.waitFor({ state: 'attached' });
    }

    /**
     * Verify form field has expected value
     */
    static async verifyFieldValue(page: Page, selector: string, expectedValue: string): Promise<void> {
        const element = page.locator(selector);
        await element.waitFor({ state: 'visible' });
        const value = await element.inputValue();
        if (value !== expectedValue) {
            throw new Error(`Expected field ${selector} to have value "${expectedValue}", but got "${value}"`);
        }
    }

    /**
     * Verify loading state transitions
     */
    static async verifyLoadingComplete(page: Page, loadingSelector: string): Promise<void> {
        const loadingElement = page.locator(loadingSelector);
        await loadingElement.waitFor({ state: 'hidden', timeout: TEST_CONFIG.DEFAULT_TIMEOUT });
    }
}

/**
 * Standard test data interfaces
 */
export interface ExpenseTestData {
    description: string;
    amount: number;
    currency: string;
    splitType: 'equal' | 'exact' | 'percentage';
}

export interface GroupTestData {
    name: string;
    description?: string;
    currency: string;
}

export interface UserTestData {
    uid: string;
    displayName: string;
    email: string;
}

/**
 * Mock data generators
 */
export class MockDataGenerator {
    static createMockGroup(overrides?: Partial<GroupTestData>): GroupTestData {
        return {
            name: `Test Group ${TestHelpers.generateTestId()}`,
            description: 'Test group description',
            currency: TEST_CONFIG.DEFAULT_CURRENCY,
            ...overrides,
        };
    }

    static createMockUser(overrides?: Partial<UserTestData>): UserTestData {
        const id = TestHelpers.generateTestId();
        return {
            uid: `user-${id}`,
            displayName: `Test User ${id}`,
            email: `test-${id}@example.com`,
            ...overrides,
        };
    }
}