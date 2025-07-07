#!/usr/bin/env node

const { spawn } = require('child_process');
const { generateTestData } = require('../functions/scripts/generate-test-data');
const http = require('http');

console.log('🚀 Starting Firebase emulator with test data generation...\n');

// Start Firebase emulators (fresh start - no import)
const emulatorProcess = spawn('firebase', [
  'emulators:start',
  '--export-on-exit=./emulator-data'
], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

// Start nodemon for webapp watching
const nodemonProcess = spawn('nodemon', [
  '--watch', '../webapp',
  '--ext', 'html,css,js',
  '--exec', 'npm run build:webapp'
], {
  stdio: 'inherit'
});

// Function to check if emulator is ready
function checkEmulatorReady() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4000,
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

// Wait for emulator to be ready, then generate test data
setTimeout(async () => {
  console.log('\n⏳ Waiting for Firebase emulator to be ready...');
  
  // Poll for emulator readiness
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    const isReady = await checkEmulatorReady();
    if (isReady) {
      console.log('\n🎯 Firebase emulator is ready!');
      break;
    }
    
    attempts++;
    console.log(`⏳ Waiting for emulator... (${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  if (attempts >= maxAttempts) {
    console.error('❌ Firebase emulator failed to start within timeout');
    return;
  }
  
  // Wait a bit more for all services to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  
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
  
  if (nodemonProcess && !nodemonProcess.killed) {
    nodemonProcess.kill('SIGINT');
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
  
  if (nodemonProcess && !nodemonProcess.killed) {
    nodemonProcess.kill('SIGTERM');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

emulatorProcess.on('exit', (code) => {
  if (!isShuttingDown) {
    console.log(`\n🔥 Firebase emulator exited with code ${code}`);
    if (nodemonProcess && !nodemonProcess.killed) {
      nodemonProcess.kill('SIGINT');
    }
    process.exit(code);
  }
});

nodemonProcess.on('exit', (code) => {
  if (!isShuttingDown) {
    console.log(`\n👀 Nodemon watcher exited with code ${code}`);
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