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

// Safety check: warn if .env exists and might be production config
if (fs.existsSync(targetPath)) {
  console.log('⚠️  Existing .env file found - this will be overwritten');
  console.log('   If this is a production environment, ensure settings are backed up in .env.prod');
}

try {
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`✅ Switched to instance ${instance} configuration`);
  
  // Load the new config to show the ports
  require('dotenv').config({ path: targetPath });
  
  // Check if this is a production instance (no emulator ports needed)
  const isProduction = instance === 'prod';
  
  if (!isProduction) {
    // Regenerate firebase.json with the new ports for development instances
    require('./generate-firebase-config.js');
    
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
  
} catch (error) {
  console.error('❌ Failed to switch instance:', error.message);
  process.exit(1);
}