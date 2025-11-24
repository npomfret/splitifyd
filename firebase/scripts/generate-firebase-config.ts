#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { loadRuntimeConfig } from '../shared/scripts-config';
import { resolvePortsForMode } from './instances-config';
import { logger } from './logger';

// Load and validate runtime configuration
const runtimeConfig = loadRuntimeConfig();

const templatePath = path.join(__dirname, '../firebase.template.json');
const configPath = path.join(__dirname, '../firebase.json');

if (!fs.existsSync(templatePath)) {
    logger.error('❌ firebase.template.json not found');
    process.exit(1);
}

let configContent: string = fs.readFileSync(templatePath, 'utf8');

const instanceName = runtimeConfig.INSTANCE_NAME;
const isProduction = instanceName === 'prod';

// Optional staging variables with defaults
const optionalVars: Record<string, string> = {
    FUNCTIONS_SOURCE: 'functions',
    FUNCTIONS_PREDEPLOY: '',
};

if (isProduction && !process.env.FUNCTIONS_SOURCE) {
    logger.error('❌ FUNCTIONS_SOURCE must be defined for production deployments.');
    process.exit(1);
}

const portConfig = resolvePortsForMode(instanceName);
const portPlaceholders: Record<string, number> = {
    EMULATOR_UI_PORT: portConfig.ui,
    EMULATOR_AUTH_PORT: portConfig.auth,
    EMULATOR_FUNCTIONS_PORT: portConfig.functions,
    EMULATOR_FIRESTORE_PORT: portConfig.firestore,
    EMULATOR_HOSTING_PORT: portConfig.hosting,
    EMULATOR_STORAGE_PORT: portConfig.storage,
};

Object.entries(portPlaceholders).forEach(([placeholderKey, portValue]) => {
    const placeholder: string = `{{${placeholderKey}}}`;
    configContent = configContent.replace(new RegExp(placeholder, 'g'), portValue.toString());
});

// Replace optional variables (staging configuration)
Object.entries(optionalVars).forEach(([varName, defaultValue]) => {
    const placeholder: string = `{{${varName}}}`;
    const value: string = process.env[varName] || defaultValue;
    configContent = configContent.replace(new RegExp(placeholder, 'g'), value);
});

// Parse the config to handle empty predeploy array
const config = JSON.parse(configContent);
if (config.functions?.[0]?.predeploy?.[0] === '') {
    config.functions[0].predeploy = [];
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

if (isProduction) {
    logger.info('🔥 Firebase configuration generated for production', {
        functions_source: process.env.FUNCTIONS_SOURCE || optionalVars.FUNCTIONS_SOURCE,
        functions_predeploy: process.env.FUNCTIONS_PREDEPLOY || optionalVars.FUNCTIONS_PREDEPLOY,
    });
} else {
    logger.info('🔥 Firebase configuration generated', {
        ports: portConfig,
    });
}
