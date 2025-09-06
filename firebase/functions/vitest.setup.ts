import { afterAll, afterEach, beforeEach } from 'vitest';
import { getFunctionsPort, getFirestorePort, getProjectId, getRegion } from '@splitifyd/test-support';

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

async function runCleanupForTests(): Promise<void> {
    try {
        // Get Firebase configuration
        const functionsPort = getFunctionsPort();
        const projectId = getProjectId();
        const region = getRegion();

        // Call the test cleanup HTTP endpoint
        const cleanupUrl = `http://localhost:${functionsPort}/${projectId}/${region}/testCleanup`;
        
        const response = await fetch(cleanupUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.documentsDeleted > 0) {
            console.log(`🧹 [BEFORE EACH] Cleanup complete: removed ${result.documentsDeleted} change documents`);
        }
    } catch (error) {
        console.warn('🧹 [BEFORE EACH] Change document cleanup failed:', error);
        // Don't fail tests if cleanup fails
    }
}

// Test setup hooks

// Run cleanup before each test (only for integration tests)
beforeEach(async (context) => {
    // Check if we're running integration tests by looking at the process arguments or test file path
    const processArgs = process.argv.join(' ');
    const currentFile = context?.task?.file?.name || '';
    const isIntegrationTests = processArgs.includes('src/__tests__/integration') || 
                              processArgs.includes('integration') ||
                              currentFile.includes('integration');
    
    if (isIntegrationTests) {
        console.log('🧹 [BEFORE EACH] Running cleanup before test...');
        await runCleanupForTests();
    } else {
        console.log('🎯 [BEFORE EACH] Unit test detected - skipping cleanup');
    }
});

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
