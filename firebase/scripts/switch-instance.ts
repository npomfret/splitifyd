#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getDeployConfig, requireInstanceConfig } from './instances-config';
import { logger } from './logger';

const instance: string | undefined = process.argv[2];

if (!instance) {
    console.log('Usage: tsx scripts/switch-instance.ts <instance-number>');
    console.log('Example: tsx scripts/switch-instance.ts 1');
    console.log('Example: tsx scripts/switch-instance.ts 2');
    process.exit(1);
}

if (!/^[1-9][0-9]*$/.test(instance) && !/^staging-[0-9]+$/.test(instance)) {
    logger.error('❌ Please provide a valid instance number (positive integer) or staging instance name.', {
        examples: '1, 2, 3, staging-1',
    });
    process.exit(1);
}

const sourcePath: string = path.join(__dirname, `../functions/.env.instance${instance}`);
const targetPath: string = path.join(__dirname, '../functions/.env');

if (!fs.existsSync(sourcePath)) {
    logger.error(`❌ Instance ${instance} configuration not found`, { path: sourcePath });
    process.exit(1);
}

try {
    const expectedName = /^staging-/.test(instance) ? instance : `dev${instance}`;
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
    }

    // Deployed instances: copy file for deployment clarity
    // Development instances: symlink for live updates during dev
    if (/^staging-/.test(instance)) {
        fs.copyFileSync(sourcePath, targetPath);
        logger.info(`✅ Switched to instance ${instance} configuration via copy`, { target: targetPath, source: sourcePath });
    } else {
        fs.symlinkSync(sourcePath, targetPath, 'file');
        logger.info(`✅ Switched to instance ${instance} configuration via symlink`, { target: targetPath, source: sourcePath });
    }

    const instanceName = expectedName;
    const isDeployed: boolean = /^staging-/.test(instanceName);

    // Write current instance to .current-instance file for scripts to reference
    const currentInstancePath = path.join(__dirname, '../.current-instance');
    fs.writeFileSync(currentInstancePath, instanceName, 'utf8');
    logger.info('📝 Updated .current-instance file', { instanceName });

    // Generate firebase.json for both emulator and production environments
    execSync('tsx scripts/generate-firebase-config.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
    });

    if (!isDeployed) {
        const ports = requireInstanceConfig(expectedName).ports;
        logger.info('📍 Emulator ports configured', {
            ...ports,
            nextStep: 'npm run dev:with-data',
        });
    } else {
        const deployConfig = getDeployConfig(instanceName);
        logger.info('🚀 Deployed environment configured - ready for deployment', {
            functions_source: deployConfig?.functionsSource,
            functions_predeploy: deployConfig?.functionsPredeploy,
        });
    }
} catch (error: any) {
    logger.error('❌ Failed to switch instance', { error: error.message });
    process.exit(1);
}
