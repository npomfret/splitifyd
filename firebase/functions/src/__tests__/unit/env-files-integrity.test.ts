import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const FUNCTIONS_DIR = path.join(__dirname, '../../../');

const ENV_FILE_PATTERN = /^\.env\.instance/;

/**
 * All env files must have the same structure.
 * Values can be empty, but all keys must be present.
 */
const ALL_VARS = [
    // Client configuration (empty in dev, populated in staging)
    '__CLIENT_API_KEY',
    '__CLIENT_AUTH_DOMAIN',
    '__CLIENT_STORAGE_BUCKET',
    '__CLIENT_MESSAGING_SENDER_ID',
    '__CLIENT_APP_ID',
    '__CLIENT_MEASUREMENT_ID',

    // Development helpers (can be empty)
    '__DEV_FORM_EMAIL',
    '__DEV_FORM_PASSWORD',
    '__WARNING_BANNER',

    // Service configuration
    '__MIN_REGISTRATION_DURATION_MS',
    '__CLOUD_TASKS_LOCATION',
    '__CLOUD_TASKS_SERVICE_ACCOUNT',

    // Cache configuration (seconds)
    '__CACHE_PATH_HOME',
    '__CACHE_PATH_LOGIN',
    '__CACHE_PATH_TERMS',
    '__CACHE_PATH_PRIVACY',
    '__CACHE_PATH_POLICY_TEXT',
    '__CACHE_PATH_API_CONFIG',
    '__CACHE_THEME_VERSIONED',
    '__CACHE_THEME_UNVERSIONED',

    // POSTMARK CONFIG
    '__POSTMARK_SERVERNAME',
    '__POSTMARK_MESSAGE_STREAM',
];

const CACHE_VARS = ALL_VARS.filter(v => v.startsWith('__CACHE_'));
const cacheVarSchema = z.coerce.number().int().min(0);

interface ParsedEnvFile {
    filePath: string;
    fileName: string;
    variables: Map<string, string>;
}

function parseEnvFile(filePath: string): ParsedEnvFile {
    const content = fs.readFileSync(filePath, 'utf8');
    const variables = new Map<string, string>();
    const fileName = path.basename(filePath);

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) {
            const [, key, rawValue] = match;
            const value = rawValue.replace(/^["']|["']$/g, '').trim();
            variables.set(key, value);
        }
    }

    return { filePath, fileName, variables };
}

function discoverEnvFiles(): ParsedEnvFile[] {
    return fs
        .readdirSync(FUNCTIONS_DIR)
        .filter(file => ENV_FILE_PATTERN.test(file))
        .map(file => parseEnvFile(path.join(FUNCTIONS_DIR, file)));
}

describe('Environment Files Integrity', () => {
    const envFiles = discoverEnvFiles();

    it('should discover at least one env file', () => {
        expect(envFiles.length).toBeGreaterThan(0);
    });

    describe.each(envFiles)('$fileName', (envFile) => {
        it('should have all required variables (can be empty)', () => {
            const missing = ALL_VARS.filter(v => !envFile.variables.has(v));
            expect(missing).toEqual([]);
        });

        it('should not have extraneous variables', () => {
            const allowedSet = new Set(ALL_VARS);
            const extraneous = Array
                .from(envFile.variables.keys())
                .filter(v => !allowedSet.has(v));
            expect(extraneous).toEqual([]);
        });

        it('should have valid numeric values for cache variables', () => {
            const invalidVars: string[] = [];
            for (const varName of CACHE_VARS) {
                const value = envFile.variables.get(varName);
                if (value !== undefined && value !== '') {
                    const result = cacheVarSchema.safeParse(value);
                    if (!result.success) {
                        invalidVars.push(`${varName}=${value}`);
                    }
                }
            }
            expect(invalidVars).toEqual([]);
        });
    });

    describe('Template Files', () => {
        const devTemplate = path.join(FUNCTIONS_DIR, '.env.devinstance.example');
        const stagingTemplate = path.join(FUNCTIONS_DIR, '.env.firebase.example');

        it('should have dev instance template file', () => {
            expect(fs.existsSync(devTemplate)).toBe(true);
        });

        it('should have staging instance template file', () => {
            expect(fs.existsSync(stagingTemplate)).toBe(true);
        });

        it('dev template should have all variables', () => {
            const template = parseEnvFile(devTemplate);
            const missing = ALL_VARS.filter(v => !template.variables.has(v));
            expect(missing).toEqual([]);
        });

        it('staging template should have all variables', () => {
            const template = parseEnvFile(stagingTemplate);
            const missing = ALL_VARS.filter(v => !template.variables.has(v));
            expect(missing).toEqual([]);
        });
    });
});
