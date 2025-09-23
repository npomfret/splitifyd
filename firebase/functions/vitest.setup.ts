import { afterEach } from 'vitest';

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
