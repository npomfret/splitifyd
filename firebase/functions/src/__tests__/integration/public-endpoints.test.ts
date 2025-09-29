import { describe, expect, test } from 'vitest';
import { ApiDriver } from '@splitifyd/test-support';

describe('Public Endpoints Tests', () => {
    const apiDriver = new ApiDriver();

    describe('Health Check Endpoint', () => {
        const healthUrl = `${apiDriver.getBaseUrl()}/health`;

        test('health load test', async () => {
            const arr = new Array(5).fill(0);
            const responses = await Promise.all(arr.map(() => fetch(healthUrl)));

            for (const response of responses) {
                expect(response.status).toBe(200);
            }
        });

        test('should return health status without authentication', async () => {
            const response = await fetch(healthUrl);

            expect(response.status).toBe(200);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('checks');
            expect(data.checks).toHaveProperty('firestore');
            expect(data.checks).toHaveProperty('auth');
            expect(data.checks.firestore.status).toBe('healthy');
            expect(data.checks.auth.status).toBe('healthy');
            expect(typeof data.checks.firestore.responseTime).toBe('number');
            expect(typeof data.checks.auth.responseTime).toBe('number');
        });

        test('should include proper headers', async () => {
            const response = await fetch(healthUrl);

            expect(response.headers.get('content-type')).toContain('application/json');
            expect(response.headers.get('x-content-type-options')).toBeDefined();
            expect(response.headers.get('x-frame-options')).toBeDefined();
        });

        test('should handle HEAD requests', async () => {
            const response = await fetch(healthUrl, { method: 'HEAD' });

            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
        });
    });

    describe('Status Endpoint', () => {
        test('should return system status without authentication', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/status`);

            expect(response.status).toBe(200);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('uptime');
            expect(data).toHaveProperty('memory');
            expect(data).toHaveProperty('version');
            expect(data).toHaveProperty('nodeVersion');
            expect(data).toHaveProperty('environment');

            // Validate memory structure
            expect(data.memory).toHaveProperty('rss');
            expect(data.memory).toHaveProperty('heapUsed');
            expect(data.memory).toHaveProperty('heapTotal');
            expect(data.memory).toHaveProperty('external');

            // Validate data types
            expect(typeof data.uptime).toBe('number');
            expect(typeof data.version).toBe('string');
            expect(typeof data.nodeVersion).toBe('string');
            expect(typeof data.environment).toBe('string');
        });

        test('should not expose sensitive information', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/status`);
            const data = await response.json();

            // Should not contain sensitive keys, tokens, or internal paths
            const jsonString = JSON.stringify(data);
            expect(jsonString).not.toMatch(/password|secret|key|token|api_key/i);
            expect(jsonString).not.toMatch(/\/home|\/usr|C:\\\\|firebase\/functions/i);
            expect(jsonString).not.toMatch(/process\.env/i);
        });
    });

    describe('Config Endpoint', () => {
        test('should return Firebase configuration without authentication', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/config`);

            expect(response.status).toBe(200);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('firebase');
            expect(data.firebase).toHaveProperty('apiKey');
            expect(data.firebase).toHaveProperty('authDomain');
            expect(data.firebase).toHaveProperty('projectId');

            // Should include emulator configuration in development
            if (data.environment === 'development') {
                expect(data).toHaveProperty('emulators');
                expect(data.emulators).toHaveProperty('auth');
                expect(data.emulators).toHaveProperty('firestore');
                expect(data.emulators).toHaveProperty('functions');
            }
        });

        test('should include proper cache headers', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/config`);

            expect(response.headers.get('cache-control')).toBeDefined();
            expect(response.headers.get('cache-control')).toMatch(/max-age=\d+/);
        });

        test('should not expose sensitive configuration', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/config`);
            const data = (await response.json()) as any;

            const jsonString = JSON.stringify(data);
            // Should not contain sensitive keys or internal configuration
            expect(jsonString).not.toMatch(/serviceAccount|privateKey|clientSecret/i);
            // Should not expose production secrets or keys
            expect(jsonString).not.toMatch(/secret.*key|admin.*key/i);

            // In development environments, formDefaults.password is allowed for testing convenience
            // but should not contain actual secrets (only test credentials)
            if (data.environment?.isDevelopment && data.formDefaults?.password) {
                // Allow test password in development, but ensure it's not a real secret
                expect(data.formDefaults.password).toMatch(/^[a-zA-Z0-9!@#$%^&*]+$/);
                expect(data.formDefaults.password.length).toBeLessThan(50); // Reasonable test password length
            }
        });
    });

    describe('CSP Violation Report Endpoint', () => {
        test('should accept CSP violation reports', async () => {
            const violationReport = {
                'csp-report': {
                    'document-uri': 'https://example.com/page',
                    referrer: '',
                    'violated-directive': 'script-src',
                    'effective-directive': 'script-src',
                    'original-policy': "default-src 'self'; script-src 'self'",
                    disposition: 'enforce',
                    'blocked-uri': 'https://evil.example.com/script.js',
                    'status-code': 200,
                    'script-sample': '',
                },
            };

            const response = await fetch(`${apiDriver.getBaseUrl()}/csp-violation-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(violationReport),
            });

            expect(response.status).toBe(204);
            expect(await response.text()).toBe('');
        });

        test('should handle malformed CSP reports gracefully', async () => {
            const malformedReport = {
                'not-a-csp-report': 'invalid data',
            };

            const response = await fetch(`${apiDriver.getBaseUrl()}/csp-violation-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(malformedReport),
            });

            // Should accept but log the issue
            expect(response.status).toBe(204);
        });

        test('should handle invalid JSON gracefully', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/csp-violation-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: 'invalid json',
            });

            expect([400, 500]).toContain(response.status); // Either is acceptable for invalid JSON
        });

        test('should reject non-POST methods', async () => {
            const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

            for (const method of methods) {
                const response = await fetch(`${apiDriver.getBaseUrl()}/csp-violation-report`, {
                    method,
                });

                expect(response.status).toBe(404);
            }
        });
    });

    describe('Metrics Endpoint', () => {
        test('should return performance metrics without authentication', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/metrics`);

            expect(response.status).toBe(200);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('samplingRate');
            expect(data).toHaveProperty('bufferSize');
            expect(data).toHaveProperty('metrics');
            expect(data).toHaveProperty('rawCounts');

            // Validate metrics structure
            expect(data.metrics).toHaveProperty('api');
            expect(data.metrics).toHaveProperty('db');
            expect(data.metrics).toHaveProperty('trigger');

            // Validate raw counts structure
            expect(data.rawCounts).toHaveProperty('api');
            expect(data.rawCounts).toHaveProperty('db');
            expect(data.rawCounts).toHaveProperty('trigger');
            expect(data.rawCounts).toHaveProperty('total');

            // Validate data types
            expect(typeof data.timestamp).toBe('string');
            expect(typeof data.samplingRate).toBe('string');
            expect(typeof data.bufferSize).toBe('number');
            expect(typeof data.rawCounts.total).toBe('number');
        });

        test('should not expose sensitive performance data', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/metrics`);
            const data = await response.json();

            const jsonString = JSON.stringify(data);
            // Should not contain sensitive keys, user data, or internal paths
            expect(jsonString).not.toMatch(/password|secret|key|token|api_key|email|uid/i);
            expect(jsonString).not.toMatch(/\/home|\/usr|C:\\\\|firebase\/functions/i);
        });
    });

    describe('Environment Endpoint', () => {
        test('should return environment information without authentication', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/env`);

            expect(response.status).toBe(200);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('env');
            expect(data).toHaveProperty('build');
            expect(data).toHaveProperty('runtime');
            expect(data).toHaveProperty('memory');
            expect(data).toHaveProperty('filesystem');

            // Validate build structure
            expect(data.build).toHaveProperty('timestamp');
            expect(data.build).toHaveProperty('date');
            expect(data.build).toHaveProperty('version');

            // Validate runtime structure
            expect(data.runtime).toHaveProperty('startTime');
            expect(data.runtime).toHaveProperty('uptime');
            expect(data.runtime).toHaveProperty('uptimeHuman');

            // Validate memory structure
            expect(data.memory).toHaveProperty('rss');
            expect(data.memory).toHaveProperty('heapTotal');
            expect(data.memory).toHaveProperty('heapUsed');
            expect(data.memory).toHaveProperty('external');

            // Validate filesystem structure
            expect(data.filesystem).toHaveProperty('currentDirectory');
            expect(data.filesystem).toHaveProperty('files');
            expect(Array.isArray(data.filesystem.files)).toBe(true);
        });

        test('should handle filesystem access errors gracefully', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/env`);
            const data = await response.json();

            // If filesystem access fails, should still return valid structure
            expect(data.filesystem).toBeDefined();
            expect(data.filesystem.files).toBeDefined();
            expect(Array.isArray(data.filesystem.files)).toBe(true);
        });
    });

    describe('Policy Endpoints', () => {
        test('should return specific current policy without authentication', async () => {
            // Use a known seeded policy ID
            const response = await fetch(`${apiDriver.getBaseUrl()}/policies/terms-of-service/current`);

            expect(response.status).toBe(200);

            const policy = await response.json();
            expect(policy).toHaveProperty('id');
            expect(policy).toHaveProperty('policyName');
            expect(policy).toHaveProperty('currentVersionHash');
            expect(policy).toHaveProperty('text');
            expect(policy).toHaveProperty('createdAt');
        });

        test('should return 404 for non-existent policy', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/policies/non-existent-policy-id/current`);

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
        });
    });

    describe('Registration Endpoint', () => {
        test('should require valid registration data', async () => {
            const invalidData = {
                // Missing required fields
            };

            const response = await fetch(`${apiDriver.getBaseUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invalidData),
            });

            expect([400, 422]).toContain(response.status); // Either validation error is acceptable
        });

        test('should reject registration with invalid email format', async () => {
            const invalidData = {
                email: 'invalid-email-format',
                password: 'validPassword123!',
                displayName: 'Test User',
            };

            const response = await fetch(`${apiDriver.getBaseUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invalidData),
            });

            expect([400, 422]).toContain(response.status);
        });

        test('should reject registration with weak password', async () => {
            const invalidData = {
                email: 'test@example.com',
                password: '123', // Too weak
                displayName: 'Test User',
            };

            const response = await fetch(`${apiDriver.getBaseUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invalidData),
            });

            expect([400, 422]).toContain(response.status);
        });

        test('should handle malformed JSON gracefully', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: 'invalid json',
            });

            expect([400, 500]).toContain(response.status); // Either is acceptable for invalid JSON
        });

        test('should reject non-POST methods', async () => {
            const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

            for (const method of methods) {
                const response = await fetch(`${apiDriver.getBaseUrl()}/register`, {
                    method,
                });

                expect([404, 405]).toContain(response.status); // Either is acceptable
            }
        });
    });

    describe('CORS Headers', () => {
        test('should return proper CORS headers for OPTIONS requests', async () => {
            const testOrigin = 'http://localhost:3000';
            const response = await fetch(`${apiDriver.getBaseUrl()}/health`, {
                method: 'OPTIONS',
                headers: {
                    Origin: testOrigin,
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization',
                },
            });

            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
            expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
            expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
        });

        test('should include CORS headers in actual requests', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/health`, {
                headers: {
                    Origin: 'http://localhost:3000',
                },
            });

            expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
        });
    });

    describe('Security Headers', () => {
        test('should include security headers in all responses', async () => {
            const endpoints = ['/health', '/status', '/config'];

            for (const endpoint of endpoints) {
                const response = await fetch(`${apiDriver.getBaseUrl()}${endpoint}`);

                expect(response.headers.get('X-Content-Type-Options')).toBeTruthy();
                expect(response.headers.get('X-Frame-Options')).toBeTruthy();
                expect(response.headers.get('X-XSS-Protection')).toBeTruthy();

                // Verify specific values
                expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
                expect(response.headers.get('X-Frame-Options')).toBe('DENY');
            }
        });
    });

    describe('Cache Control Headers', () => {
        test('should have strict no-cache headers for API endpoints', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/health`);

            expect(response.status).toBe(200);

            // Should have strict no-cache headers
            const cacheControl = response.headers.get('cache-control');
            expect(cacheControl).toContain('no-store');
            expect(cacheControl).toContain('no-cache');
            expect(cacheControl).toContain('must-revalidate');
            expect(response.headers.get('pragma')).toBe('no-cache');
            expect(response.headers.get('expires')).toBe('0');
            expect(response.headers.get('surrogate-control')).toBe('no-store');

            // Should NOT have ETags (disabled globally)
            expect(response.headers.get('etag')).toBeNull();
        });

        test('should prevent 304 Not Modified responses', async () => {
            // Make the same request twice to ensure no 304 responses
            const url = `${apiDriver.getBaseUrl()}/health`;

            const response1 = await fetch(url);
            const response2 = await fetch(url);

            // Neither response should be 304 Not Modified
            expect(response1.status).not.toBe(304);
            expect(response2.status).not.toBe(304);

            // Both should have the same strict cache headers
            expect(response1.headers.get('cache-control')).toContain('no-store');
            expect(response2.headers.get('cache-control')).toContain('no-store');
        });

        test('should ignore If-None-Match headers and not return 304', async () => {
            // Simulate browser sending If-None-Match header (which would trigger 304 with ETags)
            const response = await fetch(`${apiDriver.getBaseUrl()}/health`, {
                headers: {
                    'If-None-Match': 'W/"some-etag-value"',
                },
            });

            // Should not return 304 because ETags are disabled and cache headers prevent it
            expect(response.status).not.toBe(304);
            expect(response.headers.get('cache-control')).toContain('no-store');
            expect(response.headers.get('etag')).toBeNull();
        });
    });

    describe('Error Handling', () => {
        test('should return 404 for non-existent endpoints', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/non-existent-endpoint`);

            expect(response.status).toBe(404);

            const data = (await response.json()) as any;
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.error.code).toBe('NOT_FOUND');
        });

        test('should handle invalid HTTP methods gracefully', async () => {
            const response = await fetch(`${apiDriver.getBaseUrl()}/health`, {
                method: 'INVALID',
            });

            // Should either return 405 Method Not Allowed or 400 Bad Request
            expect([400, 405]).toContain(response.status);
        });
    });
});
