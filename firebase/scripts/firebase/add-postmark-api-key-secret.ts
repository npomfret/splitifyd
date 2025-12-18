#!/usr/bin/env npx tsx
/**
 * Upsert a Postmark Server API Token into Google Secret Manager.
 *
 * Secret naming (default):
 *   postmark_api_key_<normalizedPostmarkServerName>
 *
 * Normalization:
 *   - Secret Manager in this project enforces IDs matching `[a-zA-Z_0-9]+`
 *   - Any non-matching character in `<postmarkServerName>` is replaced with `_`
 *
 * Usage:
 *   printf '%s' 'POSTMARK_SERVER_TOKEN' | npx tsx firebase/scripts/firebase/add-postmark-api-key-secret.ts --postmark-servername=blackhole --api-key-stdin
 *
 * Options:
 *   --postmark-servername=<name>   Required. Logical server name used by our app config (e.g. blackhole, demo, prod).
 *   --secret-id=<id>              Optional. Override the Secret Manager secret id to use.
 *   --project-id=<id>             Optional. Override the GCP project id (default: read from firebase/service-account-key.json).
 *   --api-key=<token>             Optional. Provide token inline (not recommended; will end up in shell history).
 *   --api-key-stdin               Optional. Read token from stdin.
 *   --dry-run                     Optional. Print gcloud commands without executing.
 *
 * Prerequisites:
 *   - firebase/service-account-key.json must exist
 *   - gcloud must be installed
 *
 * Notes:
 *   - This script uses `CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE` and a temporary `CLOUDSDK_CONFIG` directory so it does not
 *     mutate your global gcloud configuration.
 *   - If the derived secret id doesn't work for your project, pass `--secret-id` explicitly.
 */

import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../lib/logger';

const FIREBASE_DIR = path.join(__dirname, '../..');
const SERVICE_ACCOUNT_PATH = path.join(FIREBASE_DIR, 'service-account-key.json');

interface ServiceAccountKeyFile {
    project_id: string;
}

interface ScriptArgs {
    postmarkServerName: string;
    secretId: string;
    projectId: string;
    apiKey: string;
    dryRun: boolean;
}

function normalizeSecretIdPart(value: string): string {
    const normalized = value.replaceAll(/[^a-zA-Z0-9_]/g, '_').replaceAll(/_+/g, '_').replaceAll(/^_+|_+$/g, '');
    return normalized || 'default';
}

const SECRET_ID_REGEX = /^[a-zA-Z0-9_]+$/;

const USAGE = `
Upsert a Postmark Server API Token into Google Secret Manager.

Usage:
  printf '%s' 'TOKEN' | npx tsx firebase/scripts/firebase/add-postmark-api-key-secret.ts --postmark-servername=<name> --api-key-stdin

Options:
  --postmark-servername=<name>   Required. Logical server name (e.g. blackhole, demo, prod).
  --secret-id=<id>               Optional. Override the Secret Manager secret id.
  --project-id=<id>              Optional. Override GCP project (default: from service-account-key.json).
  --api-key=<token>              Optional. Provide token inline (not recommended).
  --api-key-stdin                Optional. Read token from stdin.
  --dry-run                      Optional. Print gcloud commands without executing.
  --help                         Show this help message.

Prerequisites:
  - firebase/service-account-key.json must exist
  - gcloud must be installed
`.trim();

function hasFlag(rawArgs: string[], flagName: string): boolean {
    return rawArgs.some((arg) => arg === `--${flagName}`);
}

function parseArgs(rawArgs: string[], stdin: string): ScriptArgs {
    const args = new Map<string, string>();
    const flags = new Set<string>();

    for (const rawArg of rawArgs) {
        if (rawArg.startsWith('--') && rawArg.includes('=')) {
            const [key, ...rest] = rawArg.slice(2).split('=');
            args.set(key, rest.join('='));
            continue;
        }
        if (rawArg.startsWith('--')) {
            flags.add(rawArg.slice(2));
            continue;
        }
    }

    if (flags.has('help')) {
        console.log(USAGE);
        process.exit(0);
    }

    const postmarkServerName = (args.get('postmark-servername') ?? args.get('postmarkServerName') ?? '').trim();
    if (!postmarkServerName) {
        logger.error('❌ Missing required arg: --postmark-servername', { example: '--postmark-servername=blackhole' });
        process.exit(1);
    }

    const dryRun = flags.has('dry-run');

    const projectId = (args.get('project-id') ?? args.get('projectId') ?? '').trim();
    const apiKeyInline = (args.get('api-key') ?? args.get('apiKey') ?? '').trim();
    const apiKeyFromStdin = flags.has('api-key-stdin') ? stdin.trim() : '';

    const apiKey = apiKeyInline || apiKeyFromStdin;
    if (!apiKey) {
        logger.error('❌ Missing Postmark API key', {
            supported: ['--api-key=...', '--api-key-stdin (pipe token via stdin)'],
        });
        process.exit(1);
    }

    const defaultSecretId = `postmark_api_key_${normalizeSecretIdPart(postmarkServerName)}`;
    const secretId = (args.get('secret-id') ?? args.get('secretId') ?? defaultSecretId).trim();

    if (!secretId) {
        logger.error('❌ Missing secret id', { hint: 'Use --secret-id=...' });
        process.exit(1);
    }

    if (!SECRET_ID_REGEX.test(secretId)) {
        logger.error('❌ Invalid Secret Manager secret id format', {
            secretId,
            expected: SECRET_ID_REGEX.source,
            suggested: defaultSecretId,
        });
        process.exit(1);
    }

    return {
        postmarkServerName,
        secretId,
        projectId,
        apiKey,
        dryRun,
    };
}

function readServiceAccountProjectId(): string {
    if (!existsSync(SERVICE_ACCOUNT_PATH)) {
        logger.error('❌ Service account key not found', { path: 'firebase/service-account-key.json' });
        process.exit(1);
    }

    const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8')) as ServiceAccountKeyFile;
    if (!serviceAccount.project_id) {
        logger.error('❌ service-account-key.json missing project_id', { path: 'firebase/service-account-key.json' });
        process.exit(1);
    }
    return serviceAccount.project_id;
}

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runGcloud(
    commandArgs: string[],
    env: NodeJS.ProcessEnv,
    options?: { input?: string; dryRun?: boolean },
): RunResult {
    const printable = ['gcloud', ...commandArgs].join(' ');
    if (options?.dryRun) {
        logger.info('🧪 Dry run: gcloud command', { command: printable });
        return { status: 0, stdout: '', stderr: '' };
    }

    const result = spawnSync('gcloud', commandArgs, {
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        input: options?.input,
    });

    return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

function assertGcloudAvailable(): void {
    const result = spawnSync('gcloud', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status !== 0) {
        logger.error('❌ gcloud not available', { hint: 'Install Google Cloud SDK and ensure `gcloud` is on PATH' });
        process.exit(1);
    }
}

async function main(): Promise<void> {
    assertGcloudAvailable();

    const rawArgs = process.argv.slice(2);
    const stdin = hasFlag(rawArgs, 'api-key-stdin') ? readFileSync(0, 'utf8') : '';
    const parsed = parseArgs(rawArgs, stdin);

    const projectId = parsed.projectId || readServiceAccountProjectId();

    const tmpConfigDir = mkdtempSync(path.join(os.tmpdir(), 'splitifyd-gcloud-'));
    process.on('exit', () => {
        try {
            rmSync(tmpConfigDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    const gcloudEnv: NodeJS.ProcessEnv = {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: SERVICE_ACCOUNT_PATH,
        CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: SERVICE_ACCOUNT_PATH,
        CLOUDSDK_CONFIG: tmpConfigDir,
    };

    logger.info('🔐 Upserting Postmark API key secret', {
        projectId,
        postmarkServerName: parsed.postmarkServerName,
        secretId: parsed.secretId,
        dryRun: parsed.dryRun,
    });

    const describeResult = runGcloud(['secrets', 'describe', parsed.secretId, '--project', projectId], gcloudEnv, {
        dryRun: parsed.dryRun,
    });

    const secretExists = describeResult.status === 0;

    if (!secretExists) {
        logger.info('🆕 Secret does not exist; creating', { secretId: parsed.secretId });
        const createResult = runGcloud(
            ['secrets', 'create', parsed.secretId, '--replication-policy', 'automatic', '--project', projectId],
            gcloudEnv,
            { dryRun: parsed.dryRun },
        );
        if (createResult.status !== 0) {
            logger.error('❌ Failed to create secret', {
                secretId: parsed.secretId,
                stderr: createResult.stderr.trim(),
                hint: 'Try passing --secret-id explicitly to use a Secret ID format accepted by your project',
            });
            process.exit(1);
        }
    } else {
        logger.info('✅ Secret exists; adding a new version', { secretId: parsed.secretId });
    }

    const addVersionResult = runGcloud(
        ['secrets', 'versions', 'add', parsed.secretId, '--data-file=-', '--project', projectId],
        gcloudEnv,
        { input: parsed.apiKey, dryRun: parsed.dryRun },
    );
    if (addVersionResult.status !== 0) {
        logger.error('❌ Failed to add secret version', { secretId: parsed.secretId, stderr: addVersionResult.stderr.trim() });
        process.exit(1);
    }

    logger.info('✅ Secret upsert complete', { secretId: parsed.secretId, projectId });
}

void main();
