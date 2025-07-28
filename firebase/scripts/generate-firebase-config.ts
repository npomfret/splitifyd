#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config({ path: path.join(__dirname, '../functions/.env') });

const templatePath = path.join(__dirname, '../firebase.template.json');
const configPath = path.join(__dirname, '../firebase.json');

if (!fs.existsSync(templatePath)) {
  logger.error('❌ firebase.template.json not found');
  process.exit(1);
}

let configContent: string = fs.readFileSync(templatePath, 'utf8');

const requiredVars: readonly string[] = [
  'EMULATOR_AUTH_PORT',
  'EMULATOR_FUNCTIONS_PORT', 
  'EMULATOR_FIRESTORE_PORT',
  'EMULATOR_HOSTING_PORT',
  'EMULATOR_UI_PORT'
] as const;

const missingVars: string[] = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error('❌ Missing required environment variables', {
    missing: missingVars,
    note: 'Ensure .env file is properly configured'
  });
  process.exit(1);
}

requiredVars.forEach(varName => {
  const placeholder: string = `{{${varName}}}`;
  const value: number = parseInt(process.env[varName]!);
  configContent = configContent.replace(new RegExp(placeholder, 'g'), value.toString());
});

fs.writeFileSync(configPath, configContent);

logger.info('🔥 Firebase configuration generated', {
  ports: {
    ui: process.env.EMULATOR_UI_PORT || '4000',
    auth: process.env.EMULATOR_AUTH_PORT || '9099',
    functions: process.env.EMULATOR_FUNCTIONS_PORT || '5001',
    firestore: process.env.EMULATOR_FIRESTORE_PORT || '8080',
    hosting: process.env.EMULATOR_HOSTING_PORT || '5002'
  }
});