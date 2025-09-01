#!/usr/bin/env node

// Script to clean up Firebase emulator data before running tests
// This ensures we start with a clean slate, avoiding token invalidation issues

const fs = require('fs');
const path = require('path');

// Intelligently find firebase.json by walking up the directory tree
function loadFirebaseConfig() {
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

async function cleanupTestData() {
    console.log('⚡ [CLEANUP SCRIPT] Clearing ALL Firebase test data...');
    
    try {
        // Get the correct emulator ports
        const firebaseConfig = loadFirebaseConfig();
        const firestorePort = firebaseConfig.emulators?.firestore?.port;
        const authPort = firebaseConfig.emulators?.auth?.port;
        const hostingPort = firebaseConfig.emulators?.hosting?.port;
        
        if (!firestorePort || !authPort || !hostingPort) {
            throw new Error('Missing emulator ports in firebase.json');
        }
        
        const projectId = process.env.GCLOUD_PROJECT || 'splitifyd';
        
        // Clear Firestore data
        const firestoreUrl = `http://localhost:${firestorePort}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
        console.log(`🗂️  Clearing Firestore data at localhost:${firestorePort}`);
        
        const firestoreResponse = await fetch(firestoreUrl, { method: 'DELETE' });
        if (!firestoreResponse.ok) {
            throw new Error(`Failed to clear Firestore data: ${firestoreResponse.status} ${firestoreResponse.statusText}`);
        }
        
        // Clear Auth data
        const authUrl = `http://localhost:${authPort}/emulator/v1/projects/${projectId}/accounts`;
        console.log(`👤 Clearing Auth data at localhost:${authPort}`);
        
        const authResponse = await fetch(authUrl, { method: 'DELETE' });
        if (!authResponse.ok) {
            throw new Error(`Failed to clear Auth data: ${authResponse.status} ${authResponse.statusText}`);
        }
        
        // Test user pool is now stored in Firestore and will be cleared automatically above
        
        console.log('🎉 [CLEANUP SCRIPT] All test data cleared successfully!');
        console.log('');
        
    } catch (error) {
        console.error('❌ [CLEANUP SCRIPT] Failed to clean up test data:', error.message);
        process.exit(1);
    }
}

// Run the cleanup
cleanupTestData();