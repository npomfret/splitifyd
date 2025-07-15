#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔥 Killing Firebase emulators...');

console.log('🎯 Killing only processes on this instance\'s ports...');

const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  console.error('❌ firebase.json not found. Run the build process first to generate it.');
  process.exit(1);
}

let ports: number[] = [];
try {
  const firebaseConfig: any = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  
  if (firebaseConfig.emulators) {
    Object.values(firebaseConfig.emulators).forEach((emulator: any) => {
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
} catch (error: any) {
  console.error('❌ Could not read firebase.json:', error.message);
  process.exit(1);
}

ports.forEach(port => {
  try {
    const result: string = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }) as string;
    if (result.trim()) {
      execSync(`kill -9 ${result.trim()}`, { stdio: 'ignore' });
      console.log(`✅ Killed process on port ${port}`);
    }
  } catch (error) {
  }
});

console.log('🎯 Firebase emulators should now be stopped');