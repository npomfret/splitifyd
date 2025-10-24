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

        // Discover all .env.xxx files (excluding production files)
        envFiles = fs
            .readdirSync(envDir)
            .filter((file) => file.match(/^\.env\.(instance\d+|[a-zA-Z]+)$/))
            .filter((file) => !file.includes('prod')) // Exclude production files
            .map((file) => path.join(envDir, file));
    });

    describe('Template File Validation', () => {
        it('should have a valid .env.devinstance.example template file', () => {
            expect(fs.existsSync(templateFile)).toBe(true);
            expect(templateConfig.variables.size).toBeGreaterThan(0);
        });

        it('should contain all expected core environment variables', () => {
            const expectedVars = ['INSTANCE_MODE', 'LOG_LEVEL', 'EMULATOR_UI_PORT', 'EMULATOR_AUTH_PORT', 'EMULATOR_FUNCTIONS_PORT', 'EMULATOR_FIRESTORE_PORT', 'EMULATOR_HOSTING_PORT'];

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
                const emailVar = envConfig.variables.get('DEV_FORM_EMAIL');
                if (emailVar && emailVar.value && emailVar.value.trim() !== '') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    expect(emailRegex.test(emailVar.value)).toBe(true);
                }
            });

            it('should have numeric values for port variables', () => {
                const portVars = ['EMULATOR_UI_PORT', 'EMULATOR_AUTH_PORT', 'EMULATOR_FUNCTIONS_PORT', 'EMULATOR_FIRESTORE_PORT', 'EMULATOR_HOSTING_PORT'];
                const invalidPorts: string[] = [];

                portVars.forEach((varName) => {
                    const envVar = envConfig.variables.get(varName);
                    if (envVar && envVar.value) {
                        const port = parseInt(envVar.value, 10);
                        if (isNaN(port) || port < 1000 || port > 65535) {
                            invalidPorts.push(`${varName}=${envVar.value}`);
                        }
                    }
                });

                expect(invalidPorts).toEqual([]);
            });
        });
    });

    describe('Cross-Environment Validation', () => {
        it('should have unique emulator ports across all instances', () => {
            const portMapping = new Map<string, string[]>();
            const portVars = ['EMULATOR_UI_PORT', 'EMULATOR_AUTH_PORT', 'EMULATOR_FUNCTIONS_PORT', 'EMULATOR_FIRESTORE_PORT', 'EMULATOR_HOSTING_PORT'];

            // Only check actual instance files, not the template
            const instanceFiles = envFiles.filter((file) => !file.includes('.env.example'));

            instanceFiles.forEach((envFile) => {
                const envConfig = parseEnvFile(envFile);
                const fileName = path.basename(envFile);

                portVars.forEach((portVar) => {
                    const envVar = envConfig.variables.get(portVar);
                    if (envVar && envVar.value) {
                        const port = envVar.value;
                        if (!portMapping.has(port)) {
                            portMapping.set(port, []);
                        }
                        portMapping.get(port)!.push(`${fileName}:${portVar}`);
                    }
                });
            });

            const duplicatePorts: string[] = [];
            portMapping.forEach((instances, port) => {
                if (instances.length > 1) {
                    duplicatePorts.push(`Port ${port} used by: ${instances.join(', ')}`);
                }
            });

            expect(duplicatePorts).toEqual([]);
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
