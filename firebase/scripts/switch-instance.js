#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const instance = process.argv[2];

if (!instance) {
  console.log('Usage: node scripts/switch-instance.js <instance-number>');
  console.log('Example: node scripts/switch-instance.js 1');
  console.log('Example: node scripts/switch-instance.js 2');
  process.exit(1);
}

const sourcePath = path.join(__dirname, `../functions/.env.instance${instance}`);
const targetPath = path.join(__dirname, '../functions/.env');

if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Instance ${instance} configuration not found: ${sourcePath}`);
  process.exit(1);
}

try {
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`✅ Switched to instance ${instance} configuration`);
  
  // Load the new config to show the ports
  require('dotenv').config({ path: targetPath });
  
  console.log('\n📍 Emulator ports for this instance:');
  console.log(`  - UI: ${process.env.FIREBASE_EMULATOR_UI_PORT}`);
  console.log(`  - Auth: ${process.env.FIREBASE_AUTH_EMULATOR_PORT}`);
  console.log(`  - Functions: ${process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT}`);
  console.log(`  - Firestore: ${process.env.FIREBASE_FIRESTORE_EMULATOR_PORT}`);
  console.log(`  - Hosting: ${process.env.FIREBASE_HOSTING_EMULATOR_PORT}`);
  
  console.log('\n🚀 You can now run: npm run dev:with-data');
  
} catch (error) {
  console.error('❌ Failed to switch instance:', error.message);
  process.exit(1);
}