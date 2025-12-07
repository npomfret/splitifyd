#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { getDeployConfig, getHostingConfig, resolvePortsForMode } from '../lib/instances-config';
import { logger } from '../lib/logger';
import { loadRuntimeConfig } from '../lib/scripts-config';

// Load and validate runtime configuration
const runtimeConfig = loadRuntimeConfig();

const templatePath = path.join(__dirname, '../../firebase.template.json');
const configPath = path.join(__dirname, '../../firebase.json');

if (!fs.existsSync(templatePath)) {
    logger.error('❌ firebase.template.json not found');
    process.exit(1);
}

let configContent: string = fs.readFileSync(templatePath, 'utf8');

const instanceName = runtimeConfig.__INSTANCE_NAME;
const isDeployed = !instanceName.startsWith('dev');

const portConfig = resolvePortsForMode(instanceName);
const hostingConfig = getHostingConfig(instanceName);
if (!hostingConfig) {
    logger.error('❌ hosting config not found in instances.json', { instanceName });
    process.exit(1);
}

// Determine functions source - 'functions' for dev, instances.json for deployed
const deployConfig = getDeployConfig(instanceName);
let functionsSource: string;
let functionsPredeploy: string;
if (isDeployed) {
    if (!deployConfig) {
        logger.error('❌ Deploy config not found in instances.json for deployed environment.');
        process.exit(1);
    }
    functionsSource = deployConfig.functionsSource;
    functionsPredeploy = deployConfig.functionsPredeploy;
} else {
    functionsSource = 'functions';
    functionsPredeploy = '';
}

// Replace all template placeholders
const replacements: Record<string, string | number> = {
    EMULATOR_UI_PORT: portConfig.ui,
    EMULATOR_AUTH_PORT: portConfig.auth,
    EMULATOR_FUNCTIONS_PORT: portConfig.functions,
    EMULATOR_FIRESTORE_PORT: portConfig.firestore,
    EMULATOR_HOSTING_PORT: portConfig.hosting,
    EMULATOR_STORAGE_PORT: portConfig.storage,
    EMULATOR_TASKS_PORT: portConfig.tasks,
    FUNCTIONS_SOURCE: functionsSource,
    FUNCTIONS_PREDEPLOY: functionsPredeploy,
    ASSETS_CACHE_CONTROL: hostingConfig.assetsCacheControl,
};

Object.entries(replacements).forEach(([placeholder, value]) => {
    configContent = configContent.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(value));
});

// Parse the config to handle empty predeploy array
const config = JSON.parse(configContent);
if (config.functions?.[0]?.predeploy?.[0] === '') {
    config.functions[0].predeploy = [];
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

if (isDeployed) {
    logger.info('🔥 Firebase configuration generated for deployed environment', {
        functions_source: replacements.FUNCTIONS_SOURCE,
        functions_predeploy: replacements.FUNCTIONS_PREDEPLOY,
    });
} else {
    logger.info('🔥 Firebase configuration generated for emulator', {
        ports: portConfig,
    });
}
