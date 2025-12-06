#!/usr/bin/env npx tsx

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from '../lib/logger';

const credentialsPath = resolve(join(__dirname, '../../service-account-key.json'));

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
};

function ensureAuthEnv() {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        if (!existsSync(credentialsPath)) {
            throw new Error(`Service account key missing at ${credentialsPath}`);
        }
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
        logger.info(`🔐 Using service account credentials from ${credentialsPath}`);
    }
}

type LogProvider = 'firebase' | 'gcloud' | 'logging';
type LogFormat = 'text' | 'json' | 'yaml' | 'pretty';

interface ParsedArgs {
    functionName?: string;
    lines: number;
    tail: boolean;
    provider: LogProvider;
    region: string;
    filter?: string;
    format: LogFormat;
    errorsOnly: boolean;
    full: boolean;
}

function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(
            'Usage: tsx scripts/show-logs.ts [function-name] [--lines <n>] [--tail] [--provider firebase|gcloud|logging] [--region <name>] [--filter <expr>] [--format text|json|yaml|pretty] [--errors] [--full]',
        );
        console.log('');
        console.log('Examples:');
        console.log('  tsx scripts/show-logs.ts                                    # All functions, pretty format (default)');
        console.log('  tsx scripts/show-logs.ts api --lines 100                    # Specific function (100 entries)');
        console.log('  tsx scripts/show-logs.ts --errors                           # Only show errors');
        console.log('  tsx scripts/show-logs.ts --errors --full                    # Errors with full payloads and stacks');
        console.log('  tsx scripts/show-logs.ts api --format json                  # Raw JSON output');
        console.log('  tsx scripts/show-logs.ts api --tail                         # Follow logs in real-time');
        console.log('');
        console.log('Options:');
        console.log('  --full, -f      Show full payloads and stack traces (no truncation)');
        console.log('  --errors, -e    Only show error-level logs');
        console.log('  --lines, -l     Number of log entries to fetch (default: 50)');
        console.log('  --tail          Follow logs in real-time');
        console.log('  --format        Output format: text, json, yaml, pretty (default: pretty)');
        console.log('  --provider      Log source: firebase, gcloud, logging (default: firebase)');
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
    let format: LogFormat = 'pretty';
    let errorsOnly = false;
    let full = false;

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
                if (!next || !['text', 'json', 'yaml', 'pretty'].includes(next)) {
                    console.error('❌ Format must be one of: text, json, yaml, pretty');
                    process.exit(1);
                }
                format = next;
                i += 1;
                break;
            }
            case '--errors':
            case '-e':
                errorsOnly = true;
                break;
            case '--full':
            case '-f':
                full = true;
                break;
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

    return { functionName, lines, tail, provider, region, filter, format, errorsOnly, full };
}

const { functionName, lines, tail, provider, region, filter, format, errorsOnly, full } = parseArgs();
let gcloudAuthenticated = false;

/**
 * Format a log entry for pretty output
 */
function formatLogEntry(line: string): string | null {
    // Parse the firebase log format: TIMESTAMP LEVEL FUNCTION: JSON_DATA
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+([EIDW])\s+(\w+):\s*(.*)$/);
    if (!match) {
        return line; // Return as-is if not matching expected format
    }

    const [, timestamp, level, func, jsonPart] = match;
    const time = new Date(timestamp).toLocaleTimeString();

    // Determine color based on level
    let levelColor = colors.white;
    let levelIcon = '•';
    if (level === 'E') {
        levelColor = colors.red;
        levelIcon = '✖';
    } else if (level === 'W') {
        levelColor = colors.yellow;
        levelIcon = '⚠';
    } else if (level === 'I') {
        levelColor = colors.blue;
        levelIcon = 'ℹ';
    }

    // Filter errors only if requested
    if (errorsOnly && level !== 'E') {
        return null;
    }

    // Try to parse JSON
    let parsed: any;
    try {
        parsed = JSON.parse(jsonPart);
    } catch {
        // Not JSON, return formatted line
        return `${colors.gray}${time}${colors.reset} ${levelColor}${levelIcon}${colors.reset} ${colors.cyan}${func}${colors.reset} ${jsonPart}`;
    }

    // Format error logs specially
    if (level === 'E' && parsed.error) {
        const output: string[] = [];
        output.push(`${colors.gray}${time}${colors.reset} ${levelColor}${levelIcon} ERROR${colors.reset} ${colors.cyan}${func}${colors.reset}`);

        if (parsed.requestPath) {
            output.push(`  ${colors.gray}Path:${colors.reset} ${parsed.requestMethod || 'GET'} ${parsed.requestPath}`);
        }
        if (parsed.correlationId) {
            output.push(`  ${colors.gray}CorrelationId:${colors.reset} ${parsed.correlationId}`);
        }

        const err = parsed.error;
        if (err.code) {
            output.push(`  ${colors.gray}Code:${colors.reset} ${colors.red}${err.code}${colors.reset}`);
        }
        if (err.message) {
            output.push(`  ${colors.gray}Message:${colors.reset} ${colors.red}${err.message}${colors.reset}`);
        }
        if (err.data?.detail) {
            output.push(`  ${colors.gray}Detail:${colors.reset} ${colors.red}${err.data.detail}${colors.reset}`);
        }
        if (err.errors && Array.isArray(err.errors)) {
            output.push(`  ${colors.gray}Validation Errors:${colors.reset}`);
            for (const e of err.errors) {
                output.push(`    ${colors.red}• ${e.path}:${colors.reset} ${e.message} (${e.code})`);
            }
        }
        if (err.payload) {
            if (full) {
                // Show full payload, pretty-printed if JSON
                output.push(`  ${colors.gray}Payload:${colors.reset}`);
                try {
                    const payloadObj = typeof err.payload === 'string' ? JSON.parse(err.payload) : err.payload;
                    const prettyPayload = JSON.stringify(payloadObj, null, 2);
                    for (const line of prettyPayload.split('\n')) {
                        output.push(`    ${line}`);
                    }
                } catch {
                    output.push(`    ${err.payload}`);
                }
            } else {
                const payload = err.payload.length > 200 ? err.payload.substring(0, 200) + '... (use --full to see all)' : err.payload;
                output.push(`  ${colors.gray}Payload:${colors.reset} ${payload}`);
            }
        }
        if (err.stack) {
            if (full) {
                // Show full stack trace
                output.push(`  ${colors.gray}Stack:${colors.reset}`);
                for (const stackLine of err.stack.split('\n')) {
                    output.push(`    ${colors.gray}${stackLine}${colors.reset}`);
                }
            } else if (!err.errors) {
                // Only show abbreviated stack if no validation errors
                const stackLines = err.stack.split('\n').slice(0, 3);
                output.push(`  ${colors.gray}Stack:${colors.reset} (use --full for complete trace)`);
                for (const stackLine of stackLines) {
                    output.push(`    ${colors.gray}${stackLine}${colors.reset}`);
                }
            }
        }
        // Show raw error data if --full and there's additional info
        if (full && err.data && Object.keys(err.data).length > 0) {
            const dataWithoutDetail = { ...err.data };
            delete dataWithoutDetail.detail; // Already shown above
            if (Object.keys(dataWithoutDetail).length > 0) {
                output.push(`  ${colors.gray}Error Data:${colors.reset}`);
                const prettyData = JSON.stringify(dataWithoutDetail, null, 2);
                for (const line of prettyData.split('\n')) {
                    output.push(`    ${line}`);
                }
            }
        }

        return output.join('\n');
    }

    // For errors without parsed.error structure, show raw JSON when --full
    if (level === 'E' && full) {
        const output: string[] = [];
        output.push(`${colors.gray}${time}${colors.reset} ${levelColor}${levelIcon} ERROR${colors.reset} ${colors.cyan}${func}${colors.reset}`);
        output.push(`  ${colors.gray}Raw:${colors.reset}`);
        const prettyJson = JSON.stringify(parsed, null, 2);
        for (const line of prettyJson.split('\n')) {
            output.push(`    ${line}`);
        }
        return output.join('\n');
    }

    // Format info logs
    const message = parsed.message || '';
    const details: string[] = [];

    if (parsed.operation) details.push(`op=${parsed.operation}`);
    if (parsed.userId) details.push(`user=${parsed.userId.substring(0, 8)}...`);
    if (parsed.correlationId) details.push(`cid=${parsed.correlationId.substring(0, 8)}...`);

    const detailStr = details.length > 0 ? ` ${colors.gray}(${details.join(', ')})${colors.reset}` : '';

    return `${colors.gray}${time}${colors.reset} ${levelColor}${levelIcon}${colors.reset} ${colors.cyan}${func}${colors.reset} ${message}${detailStr}`;
}

/**
 * Process and format log output
 */
function processLogs(output: string): void {
    const lines = output.split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        const formatted = formatLogEntry(line);
        if (formatted !== null) {
            console.log(formatted);
        }
    }
}

try {
    ensureAuthEnv();
    const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
    const activeProject = serviceAccount.project_id;

    if (provider === 'gcloud') {
        ensureGcloudAuth();
    } else if (provider === 'logging') {
        if (tail) {
            console.warn('⚠️  --tail is not supported with provider "logging". Ignoring.');
        }
        ensureGcloudAuth();
    }

    let command: string;
    const usePrettyFormat = format === 'pretty';

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

            logger.info(`📋 Showing last ${lines} lines of logs${functionName ? ` for function: ${functionName}` : ' for all functions'}${errorsOnly ? ' (errors only)' : ''}`);
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
        const effectiveFilter = filter ?? buildDefaultLoggingFilter(activeProject, functionName);
        const actualFormat = usePrettyFormat ? 'json' : format;
        const commandParts = ['gcloud', 'logging', 'read', shellQuote(effectiveFilter), '--project', activeProject, '--limit', `${lines}`, '--format', actualFormat];

        command = commandParts.join(' ');

        logger.info(`📋 Using gcloud logging to fetch ${lines} entries${functionName ? ` for function: ${functionName}` : ''} (format: ${format})`);
    }

    if (usePrettyFormat && !tail) {
        // Capture output and format it
        const result = spawnSync(command, {
            shell: true,
            cwd: process.cwd(),
            env: process.env,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        if (result.error) {
            throw result.error;
        }
        if (result.stdout) {
            processLogs(result.stdout);
        }
        if (result.stderr) {
            console.error(result.stderr);
        }
        if (result.status !== 0) {
            process.exit(result.status ?? 1);
        }
    } else {
        // Stream directly for tail mode or non-pretty format
        execSync(command, {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env,
        });
    }
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

    const projectId = JSON.parse(readFileSync(credentialsPath, 'utf-8')).project_id;

    try {
        execSync(`gcloud auth activate-service-account --key-file "${credentialsPath}" --project "${projectId}"`, {
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

function buildDefaultLoggingFilter(projectId: string, functionName?: string): string {
    const baseFilter = ['resource.type="cloud_run_revision"', `resource.labels.project_id="${projectId}"`];

    if (functionName) {
        baseFilter.push(`resource.labels.service_name="${functionName}"`);
    }

    return baseFilter.join(' AND ');
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
