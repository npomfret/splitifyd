#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../functions/.env') });

// Read template and substitute environment variables
const templatePath = path.join(__dirname, '../firebase.template.json');
const configPath = path.join(__dirname, '../firebase.json');

if (!fs.existsSync(templatePath)) {
  console.error('❌ firebase.template.json not found');
  process.exit(1);
}

let configContent = fs.readFileSync(templatePath, 'utf8');

// Required environment variables
const requiredVars = [
  'FIREBASE_AUTH_EMULATOR_PORT',
  'FIREBASE_FUNCTIONS_EMULATOR_PORT', 
  'FIREBASE_FIRESTORE_EMULATOR_PORT',
  'FIREBASE_HOSTING_EMULATOR_PORT',
  'FIREBASE_EMULATOR_UI_PORT'
];

// Check all required variables are set
const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('Ensure .env file is properly configured.');
  process.exit(1);
}

// Substitute placeholders with actual values
requiredVars.forEach(varName => {
  const placeholder = `{{${varName}}}`;
  const value = parseInt(process.env[varName]);
  configContent = configContent.replace(new RegExp(placeholder, 'g'), value);
});

fs.writeFileSync(configPath, configContent);

console.log('🔥 Firebase configuration generated with ports:');
console.log(`  - UI: ${process.env.FIREBASE_EMULATOR_UI_PORT || '4000'}`);
console.log(`  - Auth: ${process.env.FIREBASE_AUTH_EMULATOR_PORT || '9099'}`);
console.log(`  - Functions: ${process.env.FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001'}`);
console.log(`  - Firestore: ${process.env.FIREBASE_FIRESTORE_EMULATOR_PORT || '8080'}`);
console.log(`  - Hosting: ${process.env.FIREBASE_HOSTING_EMULATOR_PORT || '5002'}`);