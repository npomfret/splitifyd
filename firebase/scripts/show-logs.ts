#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { logger } from './logger';

const functionName: string | undefined = process.argv[2];
const lines: string = process.argv[3] || '50';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: tsx scripts/show-logs.ts [function-name] [lines]');
    console.log('');
    console.log('Examples:');
    console.log('  tsx scripts/show-logs.ts                    # Show logs for all functions (50 lines)');
    console.log('  tsx scripts/show-logs.ts api               # Show logs for api function (50 lines)');
    console.log('  tsx scripts/show-logs.ts api 100           # Show logs for api function (100 lines)');
    console.log('  tsx scripts/show-logs.ts --tail            # Follow logs in real-time');
    console.log('');
    console.log('Available functions:');
    console.log('  - api');
    console.log('  - userRegistrationTrigger');
    console.log('  - userUpdateTrigger');
    console.log('  - groupUpdateTrigger');
    console.log('  - scheduledBalanceCalculation');
    process.exit(0);
}

try {
    let command: string;

    if (process.argv.includes('--tail')) {
        // Follow logs in real-time
        command = functionName ? `firebase functions:log --only functions:${functionName} --follow` : `firebase functions:log --follow`;

        logger.info('📡 Following Firebase Functions logs in real-time (Press Ctrl+C to stop)');
    } else {
        // Show recent logs
        command = functionName ? `firebase functions:log --only functions:${functionName} --lines ${lines}` : `firebase functions:log --lines ${lines}`;

        logger.info(`📋 Showing last ${lines} lines of logs${functionName ? ` for function: ${functionName}` : ' for all functions'}`);
    }

    execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
    });
} catch (error: any) {
    logger.error('❌ Failed to fetch Firebase Functions logs', {
        error: error.message,
        note: 'Make sure you are logged in to Firebase CLI and have selected the correct project',
    });
    process.exit(1);
}
