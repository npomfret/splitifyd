#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { logger } from './logger';

const instance: string | undefined = process.argv[2];

if (!instance) {
  console.log('Usage: ts-node scripts/switch-instance.ts <instance-number>');
  console.log('Example: ts-node scripts/switch-instance.ts 1');
  console.log('Example: ts-node scripts/switch-instance.ts 2');
  process.exit(1);
}

if (!/^[1-9][0-9]*$/.test(instance) && instance !== 'prod') {
  logger.error('❌ Please provide a valid instance number (positive integer) or "prod".', {
    examples: '1, 2, 3, prod'
  });
  process.exit(1);
}

const sourcePath: string = path.join(__dirname, `../functions/.env.instance${instance}`);
const targetPath: string = path.join(__dirname, '../functions/.env');

if (!fs.existsSync(sourcePath)) {
  logger.error(`❌ Instance ${instance} configuration not found`, { path: sourcePath });
  process.exit(1);
}

if (fs.existsSync(targetPath)) {
  logger.warn('⚠️  Existing .env file found - this will be overwritten', {
    note: 'If this is a production environment, ensure settings are backed up in .env.prod'
  });
}

try {
  fs.copyFileSync(sourcePath, targetPath);
  logger.info(`✅ Switched to instance ${instance} configuration`);
  
  dotenv.config({ path: targetPath });
  
  const isProduction: boolean = instance === 'prod';
  
  if (!isProduction) {
    execSync('ts-node scripts/generate-firebase-config.ts', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit' 
    });
    
    logger.info('📍 Emulator ports configured', {
      ui: process.env.EMULATOR_UI_PORT,
      auth: process.env.EMULATOR_AUTH_PORT,
      functions: process.env.EMULATOR_FUNCTIONS_PORT,
      firestore: process.env.EMULATOR_FIRESTORE_PORT,
      hosting: process.env.EMULATOR_HOSTING_PORT,
      nextStep: 'npm run dev:with-data'
    });
  } else {
    logger.info('🚀 Production environment configured - ready for deployment');
  }
  
} catch (error: any) {
  logger.error('❌ Failed to switch instance', { error: error.message });
  process.exit(1);
}