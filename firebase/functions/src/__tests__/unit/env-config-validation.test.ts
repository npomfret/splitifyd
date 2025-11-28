import fs from 'fs';
import path from 'path';

interface EnvVariable {
    key: string;
    value: string;
    isRequired: boolean;
    isPlaceholder: boolean;
}

interface EnvConfig {
    filePath: string;
    variables: Map<string, EnvVariable>;
}

describe('Environment Configuration Validation', () => {
    const envDir = path.join(__dirname, '../../../');
    const templateFile = path.join(envDir, '.env.devinstance.example');

    let templateConfig: EnvConfig;
    let envFiles: string[] = [];

    beforeAll(() => {
        // Parse template file
        templateConfig = parseEnvFile(templateFile);

        // Discover all .env.xxx files (excluding staging files)
        envFiles = fs
            .readdirSync(envDir)
            .filter((file) => file.match(/^\.env\.(instance\d+|[a-zA-Z]+)$/))
            .filter((file) => !file.includes('staging')) // Exclude staging files
            .map((file) => path.join(envDir, file));
    });

    describe('Template File Validation', () => {
        it('should have a valid .env.devinstance.example template file', () => {
            expect(fs.existsSync(templateFile)).toBe(true);
            expect(templateConfig.variables.size).toBeGreaterThan(0);
        });

        it('should contain all expected core environment variables', () => {
            const expectedVars = ['__DEV_FORM_EMAIL', '__DEV_FORM_PASSWORD', '__WARNING_BANNER'];

            expectedVars.forEach((varName) => {
                expect(templateConfig.variables.has(varName)).toBe(true);
            });
        });
    });

    describe('Environment File Discovery', () => {
        it('should discover at least one environment instance file', () => {
            expect(envFiles.length).toBeGreaterThan(0);
        });

        it('should have instance files for known instances', () => {
            const expectedInstances = ['.env.instance1', '.env.instance2', '.env.instance3'];
            expectedInstances.forEach((instance) => {
                const instancePath = path.join(envDir, instance);
                expect(envFiles).toContain(instancePath);
            });
        });
    });

    envFiles.forEach((envFile) => {
        describe(`Environment File: ${path.basename(envFile)}`, () => {
            let envConfig: EnvConfig;

            beforeAll(() => {
                envConfig = parseEnvFile(envFile);
            });

            it('should be a valid environment file', () => {
                expect(fs.existsSync(envFile)).toBe(true);
                expect(envConfig.variables.size).toBeGreaterThan(0);
            });

            it('should contain all required variables from template', () => {
                const missingVars: string[] = [];

                templateConfig.variables.forEach((templateVar, key) => {
                    if (templateVar.isRequired && !envConfig.variables.has(key)) {
                        missingVars.push(key);
                    }
                });

                expect(missingVars).toEqual([]);
            });

            it('should not have placeholder values for required variables', () => {
                const placeholderVars: string[] = [];
                const placeholderPatterns = ['your-project-id', 'your-api-key', 'your-sender-id', 'your-app-id', 'your-measurement-id', 'placeholder'];

                envConfig.variables.forEach((envVar, key) => {
                    if (envVar.isRequired && placeholderPatterns.some((pattern) => envVar.value.toLowerCase().includes(pattern.toLowerCase()))) {
                        placeholderVars.push(`${key}=${envVar.value}`);
                    }
                });

                expect(placeholderVars).toEqual([]);
            });

            it('should have non-empty values for required variables', () => {
                const emptyVars: string[] = [];

                templateConfig.variables.forEach((templateVar, key) => {
                    const envVar = envConfig.variables.get(key);
                    if (templateVar.isRequired && (!envVar || envVar.value.trim() === '')) {
                        emptyVars.push(key);
                    }
                });

                expect(emptyVars).toEqual([]);
            });

            it('should have valid email format for development form email', () => {
                const emailVar = envConfig.variables.get('__DEV_FORM_EMAIL');
                if (emailVar && emailVar.value && emailVar.value.trim() !== '') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    expect(emailRegex.test(emailVar.value)).toBe(true);
                }
            });

            it('should not define emulator port variables (moved to instances.json)', () => {
                const forbiddenVars = Array.from(envConfig.variables.keys()).filter((key) => key.startsWith('EMULATOR_'));
                expect(forbiddenVars).toEqual([]);
            });
        });
    });

    describe('Cross-Environment Validation', () => {
        it('should not include deprecated emulator port variables in any environment file', () => {
            const offendingFiles = envFiles
                .map((file) => {
                    const envConfig = parseEnvFile(file);
                    const keys = Array.from(envConfig.variables.keys()).filter((key) => key.startsWith('EMULATOR_'));
                    return keys.length > 0 ? `${path.basename(file)}: ${keys.join(', ')}` : null;
                })
                .filter((entry): entry is string => entry !== null);

            expect(offendingFiles).toEqual([]);
        });
    });
});

function parseEnvFile(filePath: string): EnvConfig {
    const content = fs.readFileSync(filePath, 'utf8');
    const variables = new Map<string, EnvVariable>();

    const lines = content.split('\n');

    lines.forEach((line) => {
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
            return;
        }

        // Parse KEY=VALUE format
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) {
            const [, key, value] = match;

            // Determine if this is a required variable (not empty or placeholder in template)
            const isRequired = !value.startsWith('#') && value.trim() !== '';

            // Check if this looks like a placeholder value
            const placeholderPatterns = ['your-project-id', 'your-api-key', 'your-sender-id', 'your-app-id', 'your-measurement-id', 'placeholder'];
            const isPlaceholder = placeholderPatterns.some((pattern) => value.toLowerCase().includes(pattern.toLowerCase()));

            variables.set(key, {
                key,
                value: value.trim(),
                isRequired,
                isPlaceholder,
            });
        }
    });

    return {
        filePath,
        variables,
    };
}
