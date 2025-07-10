#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 Killing Firebase emulators...');

// Only kill processes on specific ports (instance-specific)
console.log('🎯 Killing only processes on this instance\'s ports...');

// Read ports from firebase.json
const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  console.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

let ports = [];
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  
  if (firebaseConfig.emulators) {
    Object.values(firebaseConfig.emulators).forEach(emulator => {
      if (emulator.port) {
        ports.push(parseInt(emulator.port));
      }
    });
  }
  
  if (ports.length === 0) {
    console.error('❌ No emulator ports found in firebase.json. Configuration may be invalid.');
    process.exit(1);
  }
  
  console.log(`📍 Using ports from firebase.json: ${ports.join(', ')}`);
} catch (error) {
  console.error('❌ Could not read firebase.json:', error.message);
  process.exit(1);
}

// Kill processes on Firebase emulator ports
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