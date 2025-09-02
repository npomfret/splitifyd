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

async function cleanupCollections() {
    console.log('⚡ [GLOBAL SETUP] Fast clearing ALL Firebase data via REST API...');
    
    // Get the correct emulator ports using shared logic
    const firebaseConfig = _loadFirebaseConfig();
    const firestorePort = firebaseConfig.emulators?.firestore?.port!;
    const authPort = firebaseConfig.emulators?.auth?.port!;
    const functionsPort = firebaseConfig.emulators?.functions?.port!;
    
    const projectId = process.env.GCLOUD_PROJECT || 'splitifyd';
    
    // Clear Firestore data
    const firestoreUrl = `http://localhost:${firestorePort}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
    console.log(`🗂️ Clearing Firestore data at localhost:${firestorePort}`);
    
    const firestoreResponse = await fetch(firestoreUrl, { method: 'DELETE' });
    if (!firestoreResponse.ok) {
        throw new Error(`Failed to clear Firestore data: ${firestoreResponse.status} ${firestoreResponse.statusText}`);
    }
    
    // Clear Auth data (this invalidates all cached tokens)
    const authUrl = `http://localhost:${authPort}/emulator/v1/projects/${projectId}/accounts`;
    console.log(`👤 Clearing Auth data at localhost:${authPort}`);
    
    const authResponse = await fetch(authUrl, { method: 'DELETE' });
    if (!authResponse.ok) {
        throw new Error(`Failed to clear Auth data: ${authResponse.status} ${authResponse.statusText}`);
    }

    console.log('🎉 [GLOBAL SETUP] All data cleared instantly');
}

export default async function setup() {
    // This runs ONCE for the entire test suite
    // await cleanupCollections();
}