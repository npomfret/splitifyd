#!/usr/bin/env npx tsx

import { ApiDriver } from '@billsplit-wl/test-support';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export async function startEmulator(): Promise<ChildProcess> {
    logger.info('🚀 Starting Firebase emulator...');

    const emulatorProcess = spawn('firebase', ['emulators:start'], {
        stdio: 'pipe',
        env: {
            ...process.env,
        },
    });

    const logFilePath = path.join(process.cwd(), 'firebase-debug.log');
    let logStream: fs.WriteStream | null = null;

    try {
        logStream = fs.createWriteStream(logFilePath, { flags: 'w' });
        logger.info('📝 Capturing Firebase emulator logs', { logFilePath });
    } catch (error) {
        logger.warn('⚠️ Failed to open firebase-debug.log for writing', {
            logFilePath,
            error: error instanceof Error ? error.message : error,
        });
    }

    let emulatorsReady = false;

    const writeToLog = (chunk: Buffer): void => {
        if (logStream) {
            logStream.write(chunk);
        }
    };

    emulatorProcess.stdout.on('data', (data: Buffer) => {
        writeToLog(data);
        const output = data.toString();

        // Filter out noisy hosting logs for static assets and HTTP access logs.
        const staticAssetLogPattern =
            /hosting: \d+\.\d+\.\d+\.\d+ - - \[.*\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS) \/.*\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|map|webmanifest|json|xml|txt)" HTTP/;
        const generalAccessLogPattern = /hosting: \d+\.\d+\.\d+\.\d+ - - \[.*\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS) \//;

        const lines = output.split('\n');
        const filteredLines = lines.filter((line) => {
            // Filter out static asset requests
            if (staticAssetLogPattern.test(line)) return false;

            // Keep important hosting logs (errors, warnings, startup messages)
            if (line.includes('hosting:') && !line.includes(' - - [')) return true;

            // Filter out general access logs for all paths to reduce noise
            if (generalAccessLogPattern.test(line)) return false;

            return true;
        });

        const filteredOutput = filteredLines.join('\n').trimEnd();

        if (filteredOutput.length > 0) {
            process.stdout.write(filteredOutput + '\n');
        }

        if (output.includes('All emulators ready!')) {
            emulatorsReady = true;
        }
    });

    emulatorProcess.stderr.on('data', (data: Buffer) => {
        writeToLog(data);
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
        logger.error('❌ Firebase emulators failed to start within timeout', { attempts, maxAttempts });
        throw new Error('Emulators failed to start');
    }

    logger.info('🎯 All emulators are ready!');

    // Wait for API functions to be ready
    let apiAttempts = 0;
    const maxApiAttempts = 30;
    let apiReady = false;

    while (apiAttempts < maxApiAttempts && !apiReady) {
        apiAttempts++;
        apiReady = await checkApiReady();
        if (!apiReady) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    if (!apiReady) {
        logger.error('❌ API functions failed to become ready within timeout', {
            apiAttempts,
            maxApiAttempts,
            note: 'This may indicate an issue with function deployment or configuration',
        });
        throw new Error('API functions failed to become ready');
    }

    logger.info('🎯 API functions are ready!');
    logger.info('');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎉✅ EMULATOR STARTUP COMPLETE! 🎉✅');
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('📍 The tenant emulators are now fully operational');
    logger.info('🌐 Firebase emulators are running and API functions are ready');
    logger.info('');

    emulatorProcess.on('close', () => {
        if (logStream) {
            logStream.end();
            logStream = null;
        }
    });

    return emulatorProcess;
}

async function checkApiReady(): Promise<boolean> {
    try {
        const apiDriver = await ApiDriver.create();
        await apiDriver.getHealth();
        return true;
    } catch {
        return false;
    }
}
