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
  
  // Regenerate firebase.json with the new ports
  require('./generate-firebase-config.js');
  
  console.log('\n📍 Emulator ports for this instance:');
  console.log(`  - UI: ${process.env.EMULATOR_UI_PORT}`);
  console.log(`  - Auth: ${process.env.EMULATOR_AUTH_PORT}`);
  console.log(`  - Functions: ${process.env.EMULATOR_FUNCTIONS_PORT}`);
  console.log(`  - Firestore: ${process.env.EMULATOR_FIRESTORE_PORT}`);
  console.log(`  - Hosting: ${process.env.EMULATOR_HOSTING_PORT}`);
  
  // Generate webapp/.env.development
  const webappEnvPath = path.join(__dirname, '../../webapp/.env.development');
  const webappEnvContent = `API_BASE_URL=http://localhost:${process.env.EMULATOR_FUNCTIONS_PORT}/splitifyd/us-central1/api\nAUTH_EMULATOR_HOST=http://localhost:${process.env.EMULATOR_AUTH_PORT}`;
  fs.writeFileSync(webappEnvPath, webappEnvContent);
  console.log(`✅ Generated webapp/.env.development with API_BASE_URL and AUTH_EMULATOR_HOST for instance ${instance}`);

  console.log('\n🚀 You can now run: npm run dev:with-data');
  
} catch (error) {
  console.error('❌ Failed to switch instance:', error.message);
  process.exit(1);
}