#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from './logger';

const DEFAULT_PROJECT = process.env.DEFAULT_FIREBASE_PROJECT ?? 'demo-expenses';
let activeProject = process.env.GCLOUD_PROJECT ?? DEFAULT_PROJECT;
const credentialsPath = resolve(join(__dirname, '../service-account-key.json'));

function ensureAuthEnv() {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!existsSync(credentialsPath)) {
            throw new Error(`Service account key missing at ${credentialsPath}`);
        }
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        logger.info(`🔐 Using service account credentials from ${credentialsPath}`);
    }

    if (!process.env.GCLOUD_PROJECT) {
        process.env.GCLOUD_PROJECT = DEFAULT_PROJECT;
    }

    activeProject = process.env.GCLOUD_PROJECT;
}

type LogProvider = 'firebase' | 'gcloud' | 'logging';
type LogFormat = 'text' | 'json' | 'yaml';

interface ParsedArgs {
    functionName?: string;
    lines: number;
    tail: boolean;
    provider: LogProvider;
    region: string;
    filter?: string;
    format: LogFormat;
}

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: tsx scripts/show-logs.ts [function-name] [--lines <n>] [--tail] [--provider firebase|gcloud|logging] [--region <name>] [--filter <expr>] [--format text|json|yaml]');
        console.log('');
        console.log('Examples:');
        console.log('  tsx scripts/show-logs.ts                                    # All functions (Cloud Run logs, 50 lines)');
        console.log('  tsx scripts/show-logs.ts api --lines 100                    # Specific function (100 entries)');
        console.log('  tsx scripts/show-logs.ts api --provider firebase            # Use Firebase CLI instead of gcloud');
        console.log('  tsx scripts/show-logs.ts api --provider logging --format json');
        console.log('  tsx scripts/show-logs.ts api --tail                         # Follow logs via gcloud functions');
        console.log('');
        console.log('Available functions:');
        console.log('  - api');
        console.log('  - userRegistrationTrigger');
        console.log('  - userUpdateTrigger');
        console.log('  - groupUpdateTrigger');
        console.log('  - scheduledBalanceCalculation');
        process.exit(0);
    }

    let functionName: string | undefined;
    let lines = 50;
    let tail = false;
    let provider: LogProvider = 'firebase';
    let region = process.env.FIREBASE_DEFAULT_REGION || 'us-central1';
    let filter: string | undefined;
    let format: LogFormat = 'text';

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        switch (arg) {
            case '--tail':
                tail = true;
                break;
            case '--lines':
            case '-l': {
                const next = args[i + 1];
                if (!next || Number.isNaN(Number(next))) {
                    console.error('❌ Expected a number after --lines');
                    process.exit(1);
                }
                lines = Number(next);
                i += 1;
                break;
            }
            case '--provider': {
                const next = args[i + 1] as LogProvider | undefined;
                if (!next || !['firebase', 'gcloud', 'logging'].includes(next)) {
                    console.error('❌ Provider must be one of: firebase, gcloud, logging');
                    process.exit(1);
                }
                provider = next;
                i += 1;
                break;
            }
            case '--region': {
                const next = args[i + 1];
                if (!next) {
                    console.error('❌ Expected a region name after --region');
                    process.exit(1);
                }
                region = next;
                i += 1;
                break;
            }
            case '--filter': {
                const next = args[i + 1];
                if (!next) {
                    console.error('❌ Expected a filter expression after --filter');
                    process.exit(1);
                }
                filter = next;
                i += 1;
                break;
            }
            case '--format': {
                const next = args[i + 1] as LogFormat | undefined;
                if (!next || !['text', 'json', 'yaml'].includes(next)) {
                    console.error('❌ Format must be one of: text, json, yaml');
                    process.exit(1);
                }
                format = next;
                i += 1;
                break;
            }
            default: {
                if (arg.startsWith('-')) {
                    console.error(`❌ Unknown option: ${arg}`);
                    process.exit(1);
                }
                if (!functionName) {
                    functionName = arg;
                }
                break;
            }
        }
    }

    return { functionName, lines, tail, provider, region, filter, format };
}

const { functionName, lines, tail, provider, region, filter, format } = parseArgs();
let gcloudAuthenticated = false;

try {
    ensureAuthEnv();
    if (provider === 'gcloud') {
        ensureGcloudAuth();
    } else if (provider === 'logging') {
        if (tail) {
            console.warn('⚠️  --tail is not supported with provider "logging". Ignoring.');
        }
        ensureGcloudAuth();
    }

    let command: string;

    if (provider === 'firebase') {
        const baseCommand = `firebase functions:log --project ${activeProject}`;

        if (tail) {
            command = functionName
                ? `${baseCommand} --only functions:${functionName} --follow`
                : `${baseCommand} --follow`;

            logger.info('📡 Following Firebase Functions logs in real-time via Firebase CLI (Press Ctrl+C to stop)');
        } else {
            command = functionName
                ? `${baseCommand} --only functions:${functionName} --lines ${lines}`
                : `${baseCommand} --lines ${lines}`;

            logger.info(`📋 Showing last ${lines} lines of logs${functionName ? ` for function: ${functionName}` : ' for all functions'} via Firebase CLI`);
        }
    } else if (provider === 'gcloud') {
        const commandParts = ['gcloud', 'functions', 'logs', 'read'];
        if (functionName) {
            commandParts.push(functionName);
        }
        commandParts.push('--project', activeProject, '--gen2', '--region', region, '--limit', `${lines}`);
        if (tail) {
            commandParts.push('--stream');
        }

        command = commandParts.join(' ');

        logger.info(`📋 Using gcloud to ${tail ? 'stream' : `fetch last ${lines} lines of`} logs${functionName ? ` for function: ${functionName}` : ' for all functions'}`);
    } else {
        const effectiveFilter = filter ?? buildDefaultLoggingFilter(functionName);
        const commandParts = ['gcloud', 'logging', 'read', shellQuote(effectiveFilter), '--project', activeProject, '--limit', `${lines}`, '--format', format];

        command = commandParts.join(' ');

        logger.info(`📋 Using gcloud logging to fetch ${lines} entries${functionName ? ` for function: ${functionName}` : ''} (format: ${format})`);
    }

    execSync(command, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
    });
} catch (error: any) {
    logger.error('❌ Failed to fetch Firebase Functions logs', {
        error: error.message,
        note: 'Ensure firebase/service-account-key.json exists or set GOOGLE_APPLICATION_CREDENTIALS manually',
    });
    process.exit(1);
}

function ensureGcloudAuth() {
    if (gcloudAuthenticated) {
        return;
    }

    try {
        execSync(`gcloud auth activate-service-account --key-file "${credentialsPath}" --project "${activeProject}"`, {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env,
        });
        gcloudAuthenticated = true;
    } catch (error) {
        logger.error('❌ Failed to activate service account for gcloud', { error: (error as Error).message });
        throw error;
    }
}

function buildDefaultLoggingFilter(functionName?: string): string {
    const baseFilter = ['resource.type="cloud_run_revision"', `resource.labels.project_id="${activeProject}"`];

    if (functionName) {
        baseFilter.push(`resource.labels.service_name="${functionName}"`);
    }

    return baseFilter.join(' AND ');
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
