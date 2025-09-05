import { EMULATOR_URL } from '../helpers';
import { getFunctionsPort, getProjectId, getRegion } from '@splitifyd/test-support';

async function runCleanupForTests(): Promise<void> {
    console.log('🧹 [E2E SETUP] Running change document cleanup via HTTP endpoint...');
    
    try {
        // Get Firebase configuration
        const functionsPort = getFunctionsPort();
        const projectId = getProjectId();
        const region = getRegion();

        // Call the test cleanup HTTP endpoint
        const cleanupUrl = `http://localhost:${functionsPort}/${projectId}/${region}/testCleanup`;
        console.log(`🧹 [E2E SETUP] Calling cleanup endpoint: ${cleanupUrl}`);
        
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
            console.log(`🧹 [E2E SETUP] Cleanup complete: removed ${result.documentsDeleted} change documents`);
        } else if (result.success) {
            console.log('🧹 [E2E SETUP] Cleanup complete: no change documents to remove');
        } else {
            console.warn('🧹 [E2E SETUP] Cleanup endpoint returned failure:', result.message);
        }
    } catch (error) {
        console.warn('🧹 [E2E SETUP] Change document cleanup failed:', error);
        // Don't fail tests if cleanup fails
    }
}

async function globalSetup() {
    console.log('🚀 Starting e2e test global setup...');

    const baseURL = EMULATOR_URL;

    // Simple connectivity test without creating a browser instance
    try {
        console.log(`Testing connectivity to ${baseURL}`);
        const response = await fetch(baseURL);
        if (response.ok) {
            console.log('✅ Basic connectivity confirmed');

            // Test register page accessibility (critical for user creation)
            console.log('Testing register page navigation...');
            const registerResponse = await fetch(`${baseURL}/register`);
            if (registerResponse.ok) {
                console.log('✅ Register page accessible');
            } else {
                console.warn(`⚠️  Register page returned status ${registerResponse.status}`);
            }
        } else {
            console.warn(`⚠️  Server responded with status ${response.status}, but tests will proceed`);
        }

        // Clear change documents to ensure clean test state
        await runCleanupForTests();

        console.log('✅ Global setup completed - workers will create users on-demand');
    } catch (error: any) {
        console.warn(`⚠️  Connectivity test failed: ${error.message}`);
        console.log('Tests will proceed - connectivity will be tested during actual test execution');
    }
}

export default globalSetup;
