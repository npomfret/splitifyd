import { beforeAll, afterAll, afterEach, vi, expect } from 'vitest';
import { performCleanup } from './src/scheduled/cleanup';

// Mock firebase-functions logger to use console in tests
// vi.mock('firebase-functions', () => ({
//     logger: {
//         info: console.log,
//         warn: console.log,
//         error: console.log,
//     }
// }));

// Global registry for test users that need cleanup
interface TestUserEntry {
    users: any[]; // User type from test-support
    apiDriver: any; // ApiDriver instance
}

const testUserRegistry = new Map<string, TestUserEntry>();

// Global function to register test users for automatic cleanup
(global as any).__registerTestUsers = (testId: string, users: any[], apiDriver: any) => {
    testUserRegistry.set(testId, { users, apiDriver });
};

// Automatically clean up all borrowed test users after each test
afterEach(async () => {
    if (testUserRegistry.size > 0) {
        for (const [, { users, apiDriver }] of Array.from(testUserRegistry.entries())) {
            // Return users sequentially to avoid Firebase emulator multi-instance issues
            for (const user of users) {
                try {
                    await apiDriver.returnTestUser(user.email);
                } catch (err) {
                    console.warn(`Failed to return user ${user.email}:`, (err as Error).message);
                }
            }
        }
        testUserRegistry.clear();
    }
});

// Per-file setup - global cleanup handled by vitest.global-setup.ts

beforeAll(async () => {
    // This runs once per test file, not globally
    // For integration tests, run cleanup to ensure consistent performance
    // Check if we're running integration tests by looking at the current test file path
    const testPath = expect.getState().testPath;
    const testingIntegration = testPath?.includes('src/__tests__/integration') ?? false;

    if (testingIntegration) {
        await runCleanupForTests();
    }
}, 30000); // 30 second timeout for cleanup

/**
 * Run the existing cleanup function for tests
 * This ensures integration tests start with consistent performance
 */
async function runCleanupForTests(): Promise<void> {
    try {
        console.log('🧹 Running change document cleanup before integration tests...');
        
        // Delete all documents by setting minutesToKeep to 0, skip metrics logging for tests
        const totalCleaned = await performCleanup(false, false, 0);

        if (totalCleaned > 0) {
            console.log(`🧹 Cleanup complete: removed ${totalCleaned} change documents`);
        } else {
            console.log('🧹 Cleanup complete: no documents to remove');
        }
    } catch (error) {
        console.warn('🧹 Change document cleanup failed:', error);
        // Don't fail tests if cleanup fails
    }
}

afterAll(async () => {
    // Global cleanup
});
