import { expect } from '@playwright/test';

// Extend Playwright's expect with custom matchers
expect.extend({
    toBeOneOf(received: any, expected: any[]) {
        const pass = expected.includes(received);

        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be one of ${expected.join(', ')}`,
                pass: false,
            };
        }
    },
});

// Type declarations for the custom matcher
declare global {
    namespace PlaywrightTest {
        interface Matchers<R> {
            toBeOneOf(expected: any[]): R;
        }
    }
}
