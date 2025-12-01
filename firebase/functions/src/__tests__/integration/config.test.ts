import { ApiSerializer } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import { afterEach, describe, expect, test } from 'vitest';

const deserializeConfig = async <T>(response: Response): Promise<T> => {
    const raw = await response.text();
    return ApiSerializer.deserialize<T>(raw);
};

describe('Config Endpoint Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const configUrl = `${apiDriver.getBaseUrl()}/config`;

    describe('Marketing Flags', () => {
        test('should include marketing flags for default tenant', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            expect(config.tenant).toBeDefined();
            expect(config.tenant.branding).toBeDefined();
            expect(config.tenant.branding.marketingFlags).toBeDefined();
            expect(config.tenant.branding.marketingFlags.showMarketingContent).toBe(true);
        });
    });

    describe('Basic Functionality', () => {
        test('should return 200 status code', async () => {
            const response = await fetch(configUrl);
            expect(response.status).toBe(200);
        });

        test('should return JSON content type', async () => {
            const response = await fetch(configUrl);
            expect(response.headers.get('content-type')).toContain('application/x-serialized-json');
        });

        test('should not require authentication', async () => {
            const response = await fetch(configUrl);
            expect(response.status).toBe(200);
            expect(response.headers.get('www-authenticate')).toBeNull();
        });

        test('should return valid JSON', async () => {
            const response = await fetch(configUrl);
            const data = await deserializeConfig<any>(response);
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        });
    });

    describe('Response Structure', () => {
        test('should have all required top-level fields', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            expect(config).toHaveProperty('firebase');
            expect(config).toHaveProperty('formDefaults');
            // warningBanner is optional at root level
            // firebaseAuthUrl and firebaseFirestoreUrl are only present in development
        });

        test('should have valid firebase configuration', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            expect(config.firebase).toHaveProperty('apiKey');
            expect(config.firebase).toHaveProperty('authDomain');
            expect(config.firebase).toHaveProperty('projectId');
            expect(config.firebase).toHaveProperty('storageBucket');
            expect(config.firebase).toHaveProperty('messagingSenderId');
            expect(config.firebase).toHaveProperty('appId');

            // Validate types
            expect(typeof config.firebase.apiKey).toBe('string');
            expect(typeof config.firebase.authDomain).toBe('string');
            expect(typeof config.firebase.projectId).toBe('string');
            expect(typeof config.firebase.storageBucket).toBe('string');
            expect(typeof config.firebase.messagingSenderId).toBe('string');
            expect(typeof config.firebase.appId).toBe('string');

            // Validate non-empty (apiKey and projectId must be non-empty even in dev)
            expect(config.firebase.apiKey).not.toBe('');
            expect(config.firebase.projectId).not.toBe('');
            // Note: in dev, authDomain, storageBucket, messagingSenderId, appId may be empty
        });

        test('should have valid firebaseAuthUrl in development', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            // In development, should have firebaseAuthUrl and firebaseFirestoreUrl
            if (config.firebaseAuthUrl) {
                expect(typeof config.firebaseAuthUrl).toBe('string');
                expect(() => new URL(config.firebaseAuthUrl)).not.toThrow();
            }

            if (config.firebaseFirestoreUrl) {
                expect(typeof config.firebaseFirestoreUrl).toBe('string');
                expect(() => new URL(config.firebaseFirestoreUrl)).not.toThrow();
            }
        });

        test('should have valid warningBanner if present', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            // warningBanner is optional at root level
            if (config.warningBanner !== undefined) {
                expect(typeof config.warningBanner).toBe('string');
            }
        });

        test('should have valid formDefaults configuration', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            expect(config.formDefaults).toHaveProperty('email');
            expect(config.formDefaults).toHaveProperty('password');

            // Validate types
            expect(typeof config.formDefaults.email).toBe('string');
            expect(typeof config.formDefaults.password).toBe('string');
        });

        test('should have emulator URLs in development environment', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            // This test is running in the emulator, so these should be present
            expect(config.firebaseAuthUrl).toBeDefined();
            expect(config.firebaseFirestoreUrl).toBeDefined();

            if (config.firebaseAuthUrl) {
                expect(config.firebaseAuthUrl).toMatch(/^http:\/\//);
            }
            if (config.firebaseFirestoreUrl) {
                expect(config.firebaseFirestoreUrl).toMatch(/^http:\/\//);
            }
        });
    });

    describe('Schema Validation', () => {
        test('should have valid config structure (development uses minimal values)', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            // In development, validation is skipped because we use minimal/empty values
            // Just verify the structure is correct
            expect(config).toHaveProperty('firebase');
            expect(config.firebase).toHaveProperty('projectId');
            expect(config.firebase.projectId).not.toBe('');
        });

        test('should have firebase.measurementId as optional', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);

            // measurementId is optional, but if present should be a string
            if (config.firebase.measurementId !== undefined) {
                expect(typeof config.firebase.measurementId).toBe('string');
            }
        });
    });

    describe('Security', () => {
        test('should not expose sensitive information', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);
            const jsonString = JSON.stringify(config);

            // Should not contain private keys or service account info
            expect(jsonString).not.toMatch(/private.*key/i);
            expect(jsonString).not.toMatch(/service.*account/i);
            expect(jsonString).not.toMatch(/clientSecret/i);

            // Should not expose admin keys
            expect(jsonString).not.toMatch(/admin.*key/i);
            expect(jsonString).not.toMatch(/secret.*key/i);
        });

        test('should not expose internal configuration paths', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);
            const jsonString = JSON.stringify(config);

            // Should not contain file system paths
            expect(jsonString).not.toMatch(/\/home|\/usr|C:\\\\/);
            expect(jsonString).not.toMatch(/firebase\/functions/);
        });

        test('should not expose process environment details', async () => {
            const response = await fetch(configUrl);
            const config = await deserializeConfig<any>(response);
            const jsonString = JSON.stringify(config);

            expect(jsonString).not.toMatch(/process\.env/);
            expect(jsonString).not.toMatch(/NODE_ENV/);
            expect(jsonString).not.toMatch(/INSTANCE_NAME/);
        });
    });

    describe('Caching', () => {
        test('should include cache-control headers', async () => {
            const response = await fetch(configUrl);

            const cacheControl = response.headers.get('cache-control');
            expect(cacheControl).toBeDefined();
            expect(cacheControl).toMatch(/max-age=\d+/);
        });

        test('should allow caching for reasonable duration', async () => {
            const response = await fetch(configUrl);

            const cacheControl = response.headers.get('cache-control');
            const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);

            if (maxAgeMatch) {
                const maxAge = parseInt(maxAgeMatch[1], 10);
                // Config cache: 60s in dev (for quick tenant branding updates), 300s in prod (for efficiency)
                // Integration tests run against emulator in dev mode, so expect 60s
                expect(maxAge).toBeGreaterThanOrEqual(60);
                expect(maxAge).toBeLessThanOrEqual(300);
            }
        });
    });

    describe('HTTP Methods', () => {
        test('should support GET method', async () => {
            const response = await fetch(configUrl, { method: 'GET' });
            expect(response.status).toBe(200);
        });

        test('should support HEAD method', async () => {
            const response = await fetch(configUrl, { method: 'HEAD' });
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/x-serialized-json');
        });

        test('should reject POST method', async () => {
            const response = await fetch(configUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect([404, 405]).toContain(response.status);
        });

        test('should reject PUT method', async () => {
            const response = await fetch(configUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect([404, 405]).toContain(response.status);
        });

        test('should reject DELETE method', async () => {
            const response = await fetch(configUrl, { method: 'DELETE' });
            expect([404, 405]).toContain(response.status);
        });
    });

    describe('Response Consistency', () => {
        test('should return identical config on multiple requests', async () => {
            const response1 = await fetch(configUrl);
            const config1 = await deserializeConfig<any>(response1);

            const response2 = await fetch(configUrl);
            const config2 = await deserializeConfig<any>(response2);

            // Core config should be identical
            expect(config1.firebase).toEqual(config2.firebase);
            expect(config1.warningBanner).toEqual(config2.warningBanner);
            expect(config1.firebaseAuthUrl).toEqual(config2.firebaseAuthUrl);
        });

        test('should handle concurrent requests', async () => {
            const requests = Array.from({ length: 10 }, () => fetch(configUrl));
            const responses = await Promise.all(requests);

            // All should succeed
            for (const response of responses) {
                expect(response.status).toBe(200);
            }

            // All should return valid JSON
            const configs = await Promise.all(responses.map((r) => deserializeConfig<any>(r)));
            for (const config of configs) {
                expect(config).toHaveProperty('firebase');
                expect(config).toHaveProperty('formDefaults');
            }

            // All should have the same firebase projectId (core identifier)
            for (let i = 1; i < configs.length; i++) {
                expect(configs[i].firebase.projectId).toEqual(configs[0].firebase.projectId);
            }
        });
    });

    describe('CORS', () => {
        test('should include CORS headers', async () => {
            const response = await fetch(configUrl, {
                headers: {
                    Origin: 'http://localhost:3000',
                },
            });

            expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
        });

        test('should handle OPTIONS preflight request', async () => {
            const response = await fetch(configUrl, {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET',
                },
            });

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
            expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
        });
    });

    describe('Performance', () => {
        test('should respond quickly', async () => {
            const startTime = Date.now();
            const response = await fetch(configUrl);
            const endTime = Date.now();

            expect(response.status).toBe(200);
            // Should respond in under 1 second
            expect(endTime - startTime).toBeLessThan(1000);
        });
    });
});
