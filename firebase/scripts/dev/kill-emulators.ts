#!/usr/bin/env npx tsx

import { getAllEmulatorPorts } from '@billsplit-wl/test-support';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';

let ports: number[] = [];
try {
    ports = getAllEmulatorPorts();

    if (ports.length === 0) {
        logger.error('❌ No emulator ports found in firebase.json', {
            note: 'Configuration may be invalid',
        });
        process.exit(1);
    }

    logger.debug('Using ports from firebase.json', { ports });
} catch (error: any) {
    logger.error('❌ Could not load firebase.json', { error: error.message });
    process.exit(1);
}

let killedCount = 0;
let failedPorts: number[] = [];

ports.forEach((port) => {
    try {
        const result: string = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }) as string;
        if (result.trim()) {
            const pids = result.trim().split('\n');
            execSync(`kill -9 ${result.trim()}`, { stdio: 'ignore' });

            // Wait a moment for the process to die
            execSync('sleep 0.5', { stdio: 'ignore' });

            // Verify the port is now free
            try {
                const checkResult: string = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }) as string;
                if (checkResult.trim()) {
                    logger.error(`⚠️ Port ${port} still in use after kill attempt (PIDs: ${checkResult.trim().replace(/\n/g, ', ')})`);
                    failedPorts.push(port);
                } else {
                    logger.info(`✅ Successfully killed process on port ${port} (PIDs: ${pids.join(', ')})`);
                    killedCount++;
                }
            } catch {
                // lsof throws error when no process found - this is good!
                logger.info(`✅ Successfully killed process on port ${port} (PIDs: ${pids.join(', ')})`);
                killedCount++;
            }
        } else {
            logger.debug(`Port ${port} was already free`);
        }
    } catch (error) {
        // No process found on this port - that's fine
        logger.debug(`Port ${port} was already free`);
    }
});

// Final verification - check all ports
logger.info('🔍 Verifying all ports are free...');
let allPortsFree = true;
const stillInUse: number[] = [];

ports.forEach((port) => {
    try {
        const result: string = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }) as string;
        if (result.trim()) {
            stillInUse.push(port);
            allPortsFree = false;
            logger.error(`❌ Port ${port} is still in use by PIDs: ${result.trim().replace(/\n/g, ', ')}`);
        }
    } catch {
        // Port is free - good!
    }
});

// Summary and exit status
if (allPortsFree) {
    if (killedCount > 0) {
        logger.info(`🎯 Successfully stopped Firebase emulators (killed ${killedCount} process${killedCount > 1 ? 'es' : ''})`);
    } else {
        logger.info('🎯 Firebase emulators were not running (all ports were already free)');
    }
    process.exit(0);
} else {
    logger.error(`❌ Failed to free ports: ${stillInUse.join(', ')}`);
    logger.error('You may need to manually kill these processes or use sudo');

    // Try to provide helpful info about the stubborn processes
    stillInUse.forEach((port) => {
        try {
            const pids = execSync(`lsof -ti:${port}`, { stdio: 'pipe', encoding: 'utf8' }).toString().trim();
            pids.split('\n').forEach((pid) => {
                try {
                    const processInfo = execSync(`ps -p ${pid} -o comm=`, { stdio: 'pipe', encoding: 'utf8' }).toString().trim();
                    logger.error(`  Port ${port}: PID ${pid} (${processInfo})`);
                } catch {}
            });
        } catch {}
    });

    process.exit(1);
}
