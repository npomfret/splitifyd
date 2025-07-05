#!/usr/bin/env node

const { spawn } = require('child_process');
const { generateTestData } = require('../functions/scripts/generate-test-data');

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

// Wait for emulator to be ready, then generate test data
setTimeout(async () => {
  console.log('\n⏳ Waiting for Firebase emulator to be ready...');
  
  // Wait a bit more for emulator to fully initialize
  setTimeout(async () => {
    try {
      console.log('\n🎲 Generating test data...');
      await generateTestData();
      console.log('\n✅ Test data generation completed!\n');
    } catch (error) {
      console.error('❌ Test data generation failed:', error);
      // Don't exit - let the emulator continue running
    }
  }, 3000);
}, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  
  if (emulatorProcess) {
    emulatorProcess.kill('SIGINT');
  }
  
  if (nodemonProcess) {
    nodemonProcess.kill('SIGINT');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

emulatorProcess.on('exit', (code) => {
  console.log(`\n🔥 Firebase emulator exited with code ${code}`);
  if (nodemonProcess) {
    nodemonProcess.kill('SIGINT');
  }
  process.exit(code);
});

nodemonProcess.on('exit', (code) => {
  console.log(`\n👀 Nodemon watcher exited with code ${code}`);
});