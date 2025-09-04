// Global setup that runs ONCE for the entire test suite

// Intelligently find firebase.json by walking up the directory tree
function _loadFirebaseConfig() {
    const fs = require('fs');
    const path = require('path');
    
    let currentDir = __dirname;
    while (currentDir !== path.dirname(currentDir)) {
        const firebaseJsonPath = path.join(currentDir, 'firebase.json');
        if (fs.existsSync(firebaseJsonPath)) {
            try {
                const firebaseJsonContent = fs.readFileSync(firebaseJsonPath, 'utf8');
                return JSON.parse(firebaseJsonContent);
            } catch (error) {
                throw new Error(`Failed to read firebase.json at ${firebaseJsonPath}: ${error}`);
            }
        }
        currentDir = path.dirname(currentDir);
    }
    throw new Error('firebase.json not found in directory tree');
}

async function runCleanupForTests(): Promise<void> {
    console.log('🧹 [GLOBAL SETUP] Running change document cleanup via HTTP endpoint...');
    
    try {
        // Get the Functions emulator port from firebase.json
        const firebaseConfig = _loadFirebaseConfig();
        const functionsPort = firebaseConfig.emulators?.functions?.port!;
        const projectId = 'splitifyd';
        
        // Call the test cleanup HTTP endpoint
        const cleanupUrl = `http://localhost:${functionsPort}/${projectId}/us-central1/testCleanup`;
        console.log(`🧹 [GLOBAL SETUP] Calling cleanup endpoint: ${cleanupUrl}`);
        
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
            console.log(`🧹 [GLOBAL SETUP] Cleanup complete: removed ${result.documentsDeleted} change documents`);
        } else if (result.success) {
            console.log('🧹 [GLOBAL SETUP] Cleanup complete: no change documents to remove');
        } else {
            console.warn('🧹 [GLOBAL SETUP] Cleanup endpoint returned failure:', result.message);
        }
    } catch (error) {
        console.warn('🧹 [GLOBAL SETUP] Change document cleanup failed:', error);
        // Don't fail tests if cleanup fails
    }
}

export default async function setup() {
    // This runs ONCE for the entire test suite
    console.log('🚀 [GLOBAL SETUP] Starting global test suite setup...');
    
    // Clear change documents to ensure consistent performance via HTTP endpoint
    await runCleanupForTests();
    
    console.log('✅ [GLOBAL SETUP] Global setup complete');
}