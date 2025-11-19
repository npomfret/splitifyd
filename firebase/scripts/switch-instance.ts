#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvFile, requireInstanceName } from '../shared/scripts-config';
import { logger } from './logger';
import { requireInstanceConfig } from './instances-config';

const instance: string | undefined = process.argv[2];

if (!instance) {
    console.log('Usage: tsx scripts/switch-instance.ts <instance-number>');
    console.log('Example: tsx scripts/switch-instance.ts 1');
    console.log('Example: tsx scripts/switch-instance.ts 2');
    process.exit(1);
}

if (!/^[1-9][0-9]*$/.test(instance) && instance !== 'prod') {
    logger.error('❌ Please provide a valid instance number (positive integer) or "prod".', {
        examples: '1, 2, 3, prod',
    });
    process.exit(1);
}

const sourcePath: string = path.join(__dirname, `../functions/.env.instance${instance}`);
const targetPath: string = path.join(__dirname, '../functions/.env');

if (!fs.existsSync(sourcePath)) {
    logger.error(`❌ Instance ${instance} configuration not found`, { path: sourcePath });
    process.exit(1);
}

if (fs.existsSync(targetPath)) {
    logger.warn('⚠️  Existing .env file found - this will be overwritten', {
        note: 'If this is a production environment, ensure settings are backed up in .env.prod',
    });
}

try {
    // Copy the template file
    fs.copyFileSync(sourcePath, targetPath);

    // Inject INSTANCE_NAME into the .env file
    const expectedName = instance === 'prod' ? 'prod' : `dev${instance}`;
    const envContent = fs.readFileSync(targetPath, 'utf8');
    const envWithInstanceName = `INSTANCE_NAME=${expectedName}\n${envContent}`;
    fs.writeFileSync(targetPath, envWithInstanceName);

    logger.info(`✅ Switched to instance ${instance} configuration`);

    // Load and validate the new configuration
    loadEnvFile(targetPath);
    const instanceName = requireInstanceName();
    if (instanceName !== expectedName) {
        logger.error('❌ INSTANCE_NAME does not match requested instance', {
            requested: instance,
            instanceName,
            expected: expectedName,
        });
        process.exit(1);
    }

    const isProduction: boolean = instanceName === 'prod';

    // Write current instance to .current-instance file for scripts to reference
    const currentInstancePath = path.join(__dirname, '../.current-instance');
    fs.writeFileSync(currentInstancePath, instanceName, 'utf8');
    logger.info('📝 Updated .current-instance file', { instanceName });

    // Generate firebase.json for both emulator and production environments
    execSync('tsx scripts/generate-firebase-config.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
    });

    if (!isProduction) {
        const ports = requireInstanceConfig(expectedName).ports;
        logger.info('📍 Emulator ports configured', {
            ...ports,
            nextStep: 'npm run dev:with-data',
        });
    } else {
        logger.info('🚀 Production environment configured - ready for deployment', {
            functions_source: process.env.FUNCTIONS_SOURCE,
            functions_predeploy: process.env.FUNCTIONS_PREDEPLOY,
        });
    }
} catch (error: any) {
    logger.error('❌ Failed to switch instance', { error: error.message });
    process.exit(1);
}
