#!/usr/bin/env npx tsx

import {spawn, ChildProcess} from 'child_process';
import * as http from 'http';
import {logger} from './logger';

interface EmulatorConfig {
    uiPort: string;
    functionsPort: string;
    firestorePort: string;
    authPort: string;
}

export async function startEmulator(config: EmulatorConfig): Promise<ChildProcess> {
    logger.info('🚀 Starting Firebase emulator...', {
        uiPort: config.uiPort,
        functionsPort: config.functionsPort,
    });

    const emulatorProcess = spawn('firebase', ['emulators:start'], {
        stdio: 'pipe',
        env: {
            ...process.env,
        },
    });

    let emulatorsReady = false;

    emulatorProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        process.stdout.write(output);

        if (output.includes('All emulators ready!')) {
            emulatorsReady = true;
        }
    });

    emulatorProcess.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data);
    });

    // Wait for emulators to be ready
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts && !emulatorsReady) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!emulatorsReady) {
        logger.error('❌ Firebase emulators failed to start within timeout', {attempts, maxAttempts});
        throw new Error('Emulators failed to start');
    }

    logger.info('🎯 All emulators are ready!');

    // Wait for API functions to be ready
    let apiAttempts = 0;
    const maxApiAttempts = 30;
    let apiReady = false;

    while (apiAttempts < maxApiAttempts && !apiReady) {
        apiAttempts++;
        apiReady = await checkApiReady(config.functionsPort);
        if (!apiReady) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    if (!apiReady) {
        logger.error('❌ API functions failed to become ready within timeout', {
            apiAttempts,
            maxApiAttempts,
            apiPath: `/${process.env.GCLOUD_PROJECT!}/us-central1/api`,
            note: 'This may indicate an issue with function deployment or configuration',
        });
        throw new Error('API functions failed to become ready');
    }

    logger.info('🎯 API functions are ready!');
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎉✅ EMULATOR STARTUP COMPLETE! 🎉✅');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📍 The Splitifyd emulators are now fully operational');
    logger.info('🌐 Firebase emulators are running and API functions are ready');
    logger.info('');

    return emulatorProcess;
}

function checkApiReady(functionsPort: string): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.request(
            {
                hostname: 'localhost',
                port: Number(functionsPort),
                path: `/${process.env.GCLOUD_PROJECT}/us-central1/api`,
                method: 'GET',
                timeout: 1000,
            },
            (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (data.includes('Function us-central1-api does not exist')) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            },
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => resolve(false));
        req.end();
    });
}
