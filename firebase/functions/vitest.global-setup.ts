import { getFirestorePort, getProjectId } from '@splitifyd/test-support';


async function warmUpFirestoreEmulator(): Promise<void> {
    console.log('🔥 [GLOBAL SETUP] Warming up Firestore emulator...');
    
    try {
        // Get Firebase configuration
        const firestorePort = getFirestorePort();
        const projectId = getProjectId();

        // Make a simple query to warm up the emulator
        const warmupUrl = `http://localhost:${firestorePort}/v1/projects/${projectId}/databases/(default)/documents/warmup`;
        
        await fetch(warmupUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        // We don't care if this fails - it's just to warm up the connection
        console.log('🔥 [GLOBAL SETUP] Firestore emulator warmed up');
    } catch (error) {
        console.log('🔥 [GLOBAL SETUP] Warmup query completed (connection established)');
        // Expected to fail - we just want to establish the connection
    }
}

export default async function setup() {
    // Check if we're running integration tests by looking at the process arguments
    const processArgs = process.argv.join(' ');
    const isIntegrationTests = processArgs.includes('src/__tests__/integration');
    
    if (!isIntegrationTests) {
        console.log('🎯 [GLOBAL SETUP] Unit tests only - skipping Firebase emulator setup');
        return;
    }
    
    // This runs ONCE for the entire test suite
    console.log('🚀 [GLOBAL SETUP] Starting global test suite setup...');
    
    // Warm up the Firestore emulator to avoid cold start penalties
    await warmUpFirestoreEmulator();
    
    console.log('✅ [GLOBAL SETUP] Global setup complete');
}