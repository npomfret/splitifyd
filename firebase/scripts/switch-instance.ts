#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

const instance: string | undefined = process.argv[2];

if (!instance) {
  console.log('Usage: ts-node scripts/switch-instance.ts <instance-number>');
  console.log('Example: ts-node scripts/switch-instance.ts 1');
  console.log('Example: ts-node scripts/switch-instance.ts 2');
  process.exit(1);
}

if (!/^[1-9][0-9]*$/.test(instance) && instance !== 'prod') {
  console.error('❌ Please provide a valid instance number (positive integer) or "prod".');
  console.error('   Examples: 1, 2, 3, prod');
  process.exit(1);
}

const sourcePath: string = path.join(__dirname, `../functions/.env.instance${instance}`);
const targetPath: string = path.join(__dirname, '../functions/.env');

if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Instance ${instance} configuration not found: ${sourcePath}`);
  process.exit(1);
}

if (fs.existsSync(targetPath)) {
  console.log('⚠️  Existing .env file found - this will be overwritten');
  console.log('   If this is a production environment, ensure settings are backed up in .env.prod');
}

try {
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`✅ Switched to instance ${instance} configuration`);
  
  dotenv.config({ path: targetPath });
  
  const isProduction: boolean = instance === 'prod';
  
  if (!isProduction) {
    execSync('ts-node scripts/generate-firebase-config.ts', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit' 
    });
    
    console.log('\n📍 Emulator ports for this instance:');
    console.log(`  - UI: ${process.env.EMULATOR_UI_PORT}`);
    console.log(`  - Auth: ${process.env.EMULATOR_AUTH_PORT}`);
    console.log(`  - Functions: ${process.env.EMULATOR_FUNCTIONS_PORT}`);
    console.log(`  - Firestore: ${process.env.EMULATOR_FIRESTORE_PORT}`);
    console.log(`  - Hosting: ${process.env.EMULATOR_HOSTING_PORT}`);

    console.log('\n🚀 You can now run: npm run dev:with-data');
  } else {
    console.log('\n🚀 Production environment configured - ready for deployment');
  }
  
} catch (error: any) {
  console.error('❌ Failed to switch instance:', error.message);
  process.exit(1);
}