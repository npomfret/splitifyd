#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔥 Killing Firebase emulators...');

// Kill processes by name
const processesToKill = [
  'firebase emulators:start',
  'firebase',
  'java.*firestore',
  'java.*pubsub',
  'java.*storage',
  'nodemon'
];

processesToKill.forEach(processName => {
  try {
    execSync(`pkill -f "${processName}"`, { stdio: 'ignore' });
    console.log(`✅ Killed processes matching: ${processName}`);
  } catch (error) {
    // Process not found, which is fine
  }
});

// Kill processes on Firebase emulator ports
const ports = [4000, 5001, 8080, 9099, 9199, 5000, 8085, 9000];

ports.forEach(port => {
  try {
    const result = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' });
    if (result.trim()) {
      execSync(`kill -9 ${result.trim()}`, { stdio: 'ignore' });
      console.log(`✅ Killed process on port ${port}`);
    }
  } catch (error) {
    // No process on this port, which is fine
  }
});

console.log('🎯 Firebase emulators should now be stopped');