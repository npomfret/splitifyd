import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const FUNCTIONS_DIR = path.join(__dirname, '../../../');

const DEV_FILE_PATTERN = /^\.env\.instance(\d+)$/;
const STAGING_FILE_PATTERN = /^\.env\.instancestaging-(\d+)$/;

const REQUIRED_DEV_VARS = [
    '__CACHE_PATH_HOME',
    '__CACHE_PATH_LOGIN',
    '__CACHE_PATH_TERMS',
    '__CACHE_PATH_PRIVACY',
    '__CACHE_PATH_API_CONFIG',
    '__CACHE_THEME_VERSIONED',
    '__CACHE_THEME_UNVERSIONED',
];

const OPTIONAL_DEV_VARS = [
    '__DEV_FORM_EMAIL',
    '__DEV_FORM_PASSWORD',
    '__WARNING_BANNER',
    '__MIN_REGISTRATION_DURATION_MS',
    '__CLOUD_TASKS_LOCATION',
];

const ALLOWED_DEV_VARS = new Set([...REQUIRED_DEV_VARS, ...OPTIONAL_DEV_VARS]);

const REQUIRED_STAGING_VARS = [
    ...REQUIRED_DEV_VARS,
    '__CLIENT_API_KEY',
    '__CLIENT_AUTH_DOMAIN',
    '__CLIENT_STORAGE_BUCKET',
    '__CLIENT_MESSAGING_SENDER_ID',
    '__CLIENT_APP_ID',
];

const OPTIONAL_STAGING_VARS = [
    '__DEV_FORM_EMAIL',
    '__DEV_FORM_PASSWORD',
    '__WARNING_BANNER',
    '__MIN_REGISTRATION_DURATION_MS',
    '__CLOUD_TASKS_LOCATION',
    '__CLOUD_TASKS_SERVICE_ACCOUNT',
    '__CLIENT_MEASUREMENT_ID',
];

const ALLOWED_STAGING_VARS = new Set([...REQUIRED_STAGING_VARS, ...OPTIONAL_STAGING_VARS]);

const cacheVarSchema = z.coerce.number().int().min(0);

interface ParsedEnvFile {
    filePath: string;
    fileName: string;
    variables: Map<string, string>;
    instanceType: 'dev' | 'staging';
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

    // Determine instance type from filename
    const instanceType: 'dev' | 'staging' = STAGING_FILE_PATTERN.test(fileName) ? 'staging' : 'dev';

    return {
        filePath,
        fileName,
        variables,
        instanceType,
    };
}

function discoverEnvFiles(): ParsedEnvFile[] {
    const files = fs
        .readdirSync(FUNCTIONS_DIR)
        .filter(file => DEV_FILE_PATTERN.test(file) || STAGING_FILE_PATTERN.test(file))
        .map(file => parseEnvFile(path.join(FUNCTIONS_DIR, file)));

    return files;
}

describe('Environment Files Integrity', () => {
    const envFiles = discoverEnvFiles();

    it('should discover at least one env file', () => {
        expect(envFiles.length).toBeGreaterThan(0);
    });

    describe.each(envFiles)('$fileName', (envFile) => {
        it('should have all required variables for its instance type', () => {
            const requiredVars = envFile.instanceType === 'staging'
                ? REQUIRED_STAGING_VARS
                : REQUIRED_DEV_VARS;

            const missing = requiredVars.filter(v => !envFile.variables.has(v));
            expect(missing).toEqual([]);
        });

        it('should not have extraneous variables', () => {
            const allowedVars = envFile.instanceType === 'staging'
                ? ALLOWED_STAGING_VARS
                : ALLOWED_DEV_VARS;

            const extraneous = Array
                .from(envFile.variables.keys())
                .filter(v => !allowedVars.has(v));
            expect(extraneous).toEqual([]);
        });

        it('should have valid numeric values for cache variables', () => {
            const cacheVars = [
                '__CACHE_PATH_HOME',
                '__CACHE_PATH_LOGIN',
                '__CACHE_PATH_TERMS',
                '__CACHE_PATH_PRIVACY',
                '__CACHE_PATH_API_CONFIG',
                '__CACHE_THEME_VERSIONED',
                '__CACHE_THEME_UNVERSIONED',
            ];

            const invalidVars: string[] = [];
            for (const varName of cacheVars) {
                const value = envFile.variables.get(varName);
                if (value !== undefined) {
                    const result = cacheVarSchema.safeParse(value);
                    if (!result.success) {
                        invalidVars.push(`${varName}=${value}`);
                    }
                }
            }

            expect(invalidVars).toEqual([]);
        });

        if (envFile.instanceType === 'staging') {
            it('should have non-placeholder values for client config in staging', () => {
                const clientVars = [
                    '__CLIENT_API_KEY',
                    '__CLIENT_AUTH_DOMAIN',
                    '__CLIENT_STORAGE_BUCKET',
                    '__CLIENT_MESSAGING_SENDER_ID',
                    '__CLIENT_APP_ID',
                ];

                const placeholderPatterns = [
                    'your-',
                    'placeholder',
                    'xxx',
                    'TODO',
                ];

                const placeholderVars: string[] = [];
                for (const varName of clientVars) {
                    const value = envFile.variables.get(varName);
                    if (value) {
                        const isPlaceholder = placeholderPatterns.some(p => value.toLowerCase().includes(p.toLowerCase()));
                        if (isPlaceholder) {
                            placeholderVars.push(`${varName}=${value}`);
                        }
                    }
                }

                expect(placeholderVars).toEqual([]);
            });

            it('should have valid Firebase config values in staging', () => {
                const apiKey = envFile.variables.get('__CLIENT_API_KEY');
                expect(apiKey).toBeDefined();
                expect(apiKey!.startsWith('AIza')).toBe(true);

                const authDomain = envFile.variables.get('__CLIENT_AUTH_DOMAIN');
                expect(authDomain).toBeDefined();
                expect(authDomain!.includes('.firebaseapp.com')).toBe(true);

                const storageBucket = envFile.variables.get('__CLIENT_STORAGE_BUCKET');
                expect(storageBucket).toBeDefined();
                expect(storageBucket!.includes('.firebasestorage.app') || storageBucket!.includes('.appspot.com')).toBe(true);
            });
        }

        if (envFile.instanceType === 'dev') {
            it('should have valid email format for dev form email if set', () => {
                const email = envFile.variables.get('__DEV_FORM_EMAIL');
                if (email && email.trim() !== '') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    expect(emailRegex.test(email)).toBe(true);
                }
            });
        }
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

        it('dev template should have all required variables', () => {
            const template = parseEnvFile(devTemplate);
            const missing = REQUIRED_DEV_VARS.filter(v => !template.variables.has(v));
            expect(missing).toEqual([]);
        });

        it('staging template should have all required variables', () => {
            const template = parseEnvFile(stagingTemplate);
            const missing = REQUIRED_STAGING_VARS.filter(v => !template.variables.has(v));
            expect(missing).toEqual([]);
        });
    });
});
