#!/usr/bin/env node

const { spawn } = require('child_process');
const { generateTestData } = require('../functions/scripts/generate-test-data');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Read ports from firebase.json
const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  console.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
const UI_PORT = firebaseConfig.emulators.ui.port || '4000';
const FUNCTIONS_PORT = firebaseConfig.emulators.functions.port || '5001';

console.log('🚀 Starting Firebase emulator with test data generation...\n');
console.log(`📍 Emulator UI will be available at: http://localhost:${UI_PORT}`);
console.log(`📍 Functions will be available at: http://localhost:${FUNCTIONS_PORT}\n`);

// Start Firebase emulators (fresh start - no import)
const emulatorProcess = spawn('firebase', [
  'emulators:start',
  '--export-on-exit=./emulator-data'
], {
  stdio: 'pipe', // Changed to pipe so we can read stdout
  env: { ...process.env, NODE_ENV: 'development' }
});

// Track if emulators are ready
let emulatorsReady = false;

// Monitor emulator output
emulatorProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // Forward to console
  
  // Check for the "All emulators ready" message
  if (output.includes('All emulators ready!')) {
    emulatorsReady = true;
  }
});

emulatorProcess.stderr.on('data', (data) => {
  process.stderr.write(data); // Forward errors to console
});

// Nodemon is no longer needed - webapp watching is handled by npm run watch

// Function to check if emulator is ready
function checkEmulatorReady() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: UI_PORT,
      path: '/',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

// Function to check if API functions are ready
function checkApiReady() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: FUNCTIONS_PORT,
      path: '/splitifyd/us-central1/api',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // If we get "Function does not exist", the functions aren't ready yet
        if (data.includes('Function us-central1-api does not exist')) {
          resolve(false);
        } else {
          // Any other response (including 404, 405, etc.) means the function is loaded
          resolve(true);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

// Wait for emulator to be ready, then generate test data
setTimeout(async () => {
  console.log('\n⏳ Waiting for Firebase emulator to be ready...');
  
  // First wait for the "All emulators ready" message
  let attempts = 0;
  const maxAttempts = 60; // Increased to give more time
  
  while (attempts < maxAttempts && !emulatorsReady) {
    attempts++;
    console.log(`⏳ Waiting for all emulators to start... (${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (!emulatorsReady) {
    console.error('❌ Firebase emulators failed to start within timeout');
    return;
  }
  
  console.log('\n🎯 All emulators are ready!');
  
  // Now wait for API functions to be ready
  console.log('\n⏳ Waiting for API functions to be ready...');
  let apiAttempts = 0;
  const maxApiAttempts = 30;
  let apiReady = false;
  
  while (apiAttempts < maxApiAttempts && !apiReady) {
    apiAttempts++;
    console.log(`⏳ Checking API functions... (${apiAttempts}/${maxApiAttempts})`);
    apiReady = await checkApiReady();
    if (!apiReady) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!apiReady) {
    console.error('❌ API functions failed to become ready within timeout');
    console.error('This may indicate an issue with function deployment or configuration');
    return;
  }
  
  console.log('\n🎯 API functions are ready!');
  
  try {
    console.log('\n🎲 Generating test data...');
    await generateTestData();
    console.log('\n✅ Test data generation completed!\n');
  } catch (error) {
    console.error('❌ Test data generation failed:', error);
    // Don't exit - let the emulator continue running
  }
}, 5000);

// Handle graceful shutdown
let isShuttingDown = false;

process.on('SIGINT', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n🛑 Shutting down...');
  
  if (emulatorProcess && !emulatorProcess.killed) {
    emulatorProcess.kill('SIGINT');
  }
  
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  if (emulatorProcess && !emulatorProcess.killed) {
    emulatorProcess.kill('SIGTERM');
  }
  
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

emulatorProcess.on('exit', (code) => {
  if (!isShuttingDown) {
    console.log(`\n🔥 Firebase emulator exited with code ${code}`);
    process.exit(code);
  }
});


// Handle uncaught exceptions to prevent the EIO error
process.on('uncaughtException', (error) => {
  if (error.code === 'EIO') {
    // Ignore EIO errors during shutdown
    return;
  }
  console.error('Uncaught Exception:', error);
  process.exit(1);
});