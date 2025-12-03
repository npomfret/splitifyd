import { ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, test } from 'vitest';

describe('Config Endpoint Integration Tests', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    describe('Marketing Flags', () => {
        test('should include marketing flags for default tenant', async () => {
            const config = await apiDriver.getConfig();

            expect(config.tenant).toBeDefined();
            expect(config.tenant!.branding).toBeDefined();
            expect(config.tenant!.branding.marketingFlags).toBeDefined();
            // The default tenant (brutalist theme at 127.0.0.1) has marketing disabled
            expect(config.tenant!.branding.marketingFlags!.showMarketingContent).toBe(false);
        });
    });

    describe('Response Structure', () => {
        test('should have all required top-level fields', async () => {
            const config = await apiDriver.getConfig();

            expect(config).toHaveProperty('firebase');
            expect(config).toHaveProperty('formDefaults');
        });

        test('should have valid firebase configuration', async () => {
            const config = await apiDriver.getConfig();

            expect(config.firebase).toHaveProperty('apiKey');
            expect(config.firebase).toHaveProperty('authDomain');
            expect(config.firebase).toHaveProperty('projectId');
            expect(config.firebase).toHaveProperty('storageBucket');
            expect(config.firebase).toHaveProperty('messagingSenderId');
            expect(config.firebase).toHaveProperty('appId');

            expect(typeof config.firebase.apiKey).toBe('string');
            expect(typeof config.firebase.authDomain).toBe('string');
            expect(typeof config.firebase.projectId).toBe('string');
            expect(typeof config.firebase.storageBucket).toBe('string');
            expect(typeof config.firebase.messagingSenderId).toBe('string');
            expect(typeof config.firebase.appId).toBe('string');

            expect(config.firebase.apiKey).not.toBe('');
            expect(config.firebase.projectId).not.toBe('');
        });

        test('should have valid firebaseAuthUrl in development', async () => {
            const config = await apiDriver.getConfig();

            if (config.firebaseAuthUrl) {
                expect(typeof config.firebaseAuthUrl).toBe('string');
                expect(() => new URL(config.firebaseAuthUrl!)).not.toThrow();
            }

            if (config.firebaseFirestoreUrl) {
                expect(typeof config.firebaseFirestoreUrl).toBe('string');
                expect(() => new URL(config.firebaseFirestoreUrl!)).not.toThrow();
            }
        });

        test('should have valid warningBanner if present', async () => {
            const config = await apiDriver.getConfig();

            if (config.warningBanner !== undefined) {
                expect(typeof config.warningBanner).toBe('string');
            }
        });

        test('should have valid formDefaults configuration', async () => {
            const config = await apiDriver.getConfig();

            expect(config.formDefaults).toHaveProperty('email');
            expect(config.formDefaults).toHaveProperty('password');

            expect(typeof config.formDefaults.email).toBe('string');
            expect(typeof config.formDefaults.password).toBe('string');
        });

        test('should have emulator URLs in development environment', async () => {
            const config = await apiDriver.getConfig();

            expect(config.firebaseAuthUrl).toBeDefined();
            expect(config.firebaseFirestoreUrl).toBeDefined();

            if (config.firebaseAuthUrl) {
                expect(config.firebaseAuthUrl).toMatch(/^http:\/\//);
            }
            if (config.firebaseFirestoreUrl) {
                expect(config.firebaseFirestoreUrl).toMatch(/^http:\/\//);
            }
        });

        test('should have firebase.measurementId as optional', async () => {
            const config = await apiDriver.getConfig();

            if (config.firebase.measurementId !== undefined) {
                expect(typeof config.firebase.measurementId).toBe('string');
            }
        });
    });

    describe('Security', () => {
        test('should not expose sensitive information', async () => {
            const config = await apiDriver.getConfig();
            const jsonString = JSON.stringify(config);

            expect(jsonString).not.toMatch(/private.*key/i);
            expect(jsonString).not.toMatch(/service.*account/i);
            expect(jsonString).not.toMatch(/clientSecret/i);
            expect(jsonString).not.toMatch(/admin.*key/i);
            expect(jsonString).not.toMatch(/secret.*key/i);
        });

        test('should not expose internal configuration paths', async () => {
            const config = await apiDriver.getConfig();
            const jsonString = JSON.stringify(config);

            expect(jsonString).not.toMatch(/\/home|\/usr|C:\\\\/);
            expect(jsonString).not.toMatch(/firebase\/functions/);
        });

        test('should not expose process environment details', async () => {
            const config = await apiDriver.getConfig();
            const jsonString = JSON.stringify(config);

            expect(jsonString).not.toMatch(/process\.env/);
            expect(jsonString).not.toMatch(/NODE_ENV/);
            expect(jsonString).not.toMatch(/INSTANCE_NAME/);
        });
    });

    describe('Response Consistency', () => {
        test('should return identical config on multiple requests', async () => {
            const config1 = await apiDriver.getConfig();
            const config2 = await apiDriver.getConfig();

            expect(config1.firebase).toEqual(config2.firebase);
            expect(config1.warningBanner).toEqual(config2.warningBanner);
            expect(config1.firebaseAuthUrl).toEqual(config2.firebaseAuthUrl);
        });

        test('should handle concurrent requests', async () => {
            const requests = Array.from({ length: 10 }, () => apiDriver.getConfig());
            const configs = await Promise.all(requests);

            for (const config of configs) {
                expect(config).toHaveProperty('firebase');
                expect(config).toHaveProperty('formDefaults');
            }

            for (let i = 1; i < configs.length; i++) {
                expect(configs[i].firebase.projectId).toEqual(configs[0].firebase.projectId);
            }
        });
    });

    describe('Performance', () => {
        test('should respond quickly', async () => {
            const startTime = Date.now();
            await apiDriver.getConfig();
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000);
        });
    });
});
