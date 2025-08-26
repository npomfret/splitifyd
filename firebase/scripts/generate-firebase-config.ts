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

// Determine if this is production mode based on FUNCTIONS_SOURCE
const isProduction = process.env.FUNCTIONS_SOURCE && process.env.FUNCTIONS_SOURCE !== 'functions';

const requiredVars: readonly string[] = isProduction ? [] : [
    'EMULATOR_AUTH_PORT',
    'EMULATOR_FUNCTIONS_PORT',
    'EMULATOR_FIRESTORE_PORT',
    'EMULATOR_HOSTING_PORT',
    'EMULATOR_UI_PORT'
] as const;

// Optional staging variables with defaults
const optionalVars: Record<string, string> = {
    'FUNCTIONS_SOURCE': 'functions',
    'FUNCTIONS_PREDEPLOY': 'npm --prefix "$RESOURCE_DIR" run build'
};

const missingVars: string[] = requiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
    logger.error('❌ Missing required environment variables', {
        missing: missingVars,
        note: 'Ensure .env file is properly configured',
    });
    process.exit(1);
}

// Replace required variables (ports)
if (!isProduction) {
    requiredVars.forEach((varName) => {
        const placeholder: string = `{{${varName}}}`;
        const value: number = parseInt(process.env[varName]!);
        configContent = configContent.replace(new RegExp(placeholder, 'g'), value.toString());
    });
} else {
    // For production, replace emulator placeholders with default values (won't be used anyway)
    const defaultPorts = {
        'EMULATOR_AUTH_PORT': '6002',
        'EMULATOR_FUNCTIONS_PORT': '6003',
        'EMULATOR_FIRESTORE_PORT': '6004',
        'EMULATOR_HOSTING_PORT': '6005',
        'EMULATOR_UI_PORT': '6001'
    };
    Object.entries(defaultPorts).forEach(([varName, defaultValue]) => {
        const placeholder: string = `{{${varName}}}`;
        configContent = configContent.replace(new RegExp(placeholder, 'g'), defaultValue);
    });
}

// Replace optional variables (staging configuration)
Object.entries(optionalVars).forEach(([varName, defaultValue]) => {
    const placeholder: string = `{{${varName}}}`;
    const value: string = process.env[varName] || defaultValue;
    configContent = configContent.replace(new RegExp(placeholder, 'g'), value);
});

fs.writeFileSync(configPath, configContent);

if (isProduction) {
    logger.info('🔥 Firebase configuration generated for production', {
        functions_source: process.env.FUNCTIONS_SOURCE || optionalVars.FUNCTIONS_SOURCE,
        functions_predeploy: process.env.FUNCTIONS_PREDEPLOY || optionalVars.FUNCTIONS_PREDEPLOY,
    });
} else {
    logger.info('🔥 Firebase configuration generated', {
        ports: {
            ui: process.env.EMULATOR_UI_PORT!,
            auth: process.env.EMULATOR_AUTH_PORT!,
            functions: process.env.EMULATOR_FUNCTIONS_PORT!,
            firestore: process.env.EMULATOR_FIRESTORE_PORT!,
            hosting: process.env.EMULATOR_HOSTING_PORT!,
        },
    });
}
