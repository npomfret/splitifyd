#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';


const firebaseConfigPath = path.join(__dirname, '../firebase.json');
if (!fs.existsSync(firebaseConfigPath)) {
  logger.error('❌ firebase.json not found. Run the build process first to generate it.');
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
    logger.error('❌ No emulator ports found in firebase.json', {
      note: 'Configuration may be invalid'
    });
    process.exit(1);
  }
  
  logger.debug('Using ports from firebase.json', { ports });
} catch (error: any) {
  logger.error('❌ Could not read firebase.json', { error: error.message });
  process.exit(1);
}

ports.forEach(port => {
  try {
    const result: string = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }) as string;
    if (result.trim()) {
      execSync(`kill -9 ${result.trim()}`, { stdio: 'ignore' });
      logger.info(`✅ Killed process on port ${port}`);
    }
  } catch (error) {
  }
});

logger.info('🎯 Firebase emulators stopped');