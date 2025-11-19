#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { requireInstanceMode } from '../functions/src/shared/instance-mode';
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
    fs.copyFileSync(sourcePath, targetPath);
    logger.info(`✅ Switched to instance ${instance} configuration`);

    dotenv.config({ path: targetPath });

    const instanceMode = requireInstanceMode();
    const expectedMode = instance === 'prod' ? 'prod' : `dev${instance}`;
    if (instanceMode !== expectedMode) {
        logger.error('❌ INSTANCE_MODE does not match requested instance', {
            requested: instance,
            instanceMode,
            expected: expectedMode,
        });
        process.exit(1);
    }

    const isProduction: boolean = instanceMode === 'prod';

    // Generate firebase.json for both emulator and production environments
    execSync('tsx scripts/generate-firebase-config.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
    });

    if (!isProduction) {
        const ports = requireInstanceConfig(expectedMode).ports;
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
