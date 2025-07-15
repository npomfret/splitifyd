#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../functions/.env') });

const templatePath = path.join(__dirname, '../firebase.template.json');
const configPath = path.join(__dirname, '../firebase.json');

if (!fs.existsSync(templatePath)) {
  console.error('❌ firebase.template.json not found');
  process.exit(1);
}

let configContent = fs.readFileSync(templatePath, 'utf8');

const requiredVars = [
  'EMULATOR_AUTH_PORT',
  'EMULATOR_FUNCTIONS_PORT', 
  'EMULATOR_FIRESTORE_PORT',
  'EMULATOR_HOSTING_PORT',
  'EMULATOR_UI_PORT'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('Ensure .env file is properly configured.');
  process.exit(1);
}

requiredVars.forEach(varName => {
  const placeholder = `{{${varName}}}`;
  const value = parseInt(process.env[varName]!);
  configContent = configContent.replace(new RegExp(placeholder, 'g'), value.toString());
});

fs.writeFileSync(configPath, configContent);

console.log('🔥 Firebase configuration generated with ports:');
console.log(`  - UI: ${process.env.EMULATOR_UI_PORT || '4000'}`);
console.log(`  - Auth: ${process.env.EMULATOR_AUTH_PORT || '9099'}`);
console.log(`  - Functions: ${process.env.EMULATOR_FUNCTIONS_PORT || '5001'}`);
console.log(`  - Firestore: ${process.env.EMULATOR_FIRESTORE_PORT || '8080'}`);
console.log(`  - Hosting: ${process.env.EMULATOR_HOSTING_PORT || '5002'}`);