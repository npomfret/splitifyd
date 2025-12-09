import { toPolicyId } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Public endpoints', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    it('GET /health responds with service status', async () => {
        const health = await apiDriver.getHealth();

        expect(health).toHaveProperty('timestamp');
        expect(health).toHaveProperty('checks');
        expect(health.status).toBe('healthy');
    });

    it('GET /config returns localhost-tenant for localhost host', async () => {
        const localhostDriver = apiDriver.withHost('localhost');
        const config = await localhostDriver.getConfig();

        expect(config).toHaveProperty('firebase');
        expect(config).toHaveProperty('tenant');
        expect(config.tenant).toHaveProperty('tenantId', 'localhost-tenant');
    });

    it('GET /config returns default-tenant for 127.0.0.1 host', async () => {
        const driver127 = apiDriver.withHost('127.0.0.1');
        const config = await driver127.getConfig();

        expect(config).toHaveProperty('firebase');
        expect(config).toHaveProperty('tenant');
        expect(config.tenant).toHaveProperty('tenantId', 'default-tenant');
    });

    it('GET /policies/:id/current is accessible without authentication', async () => {
        // This tests that the policy endpoint is publicly accessible
        // It may return 200 (if policy exists) or 404 (if not seeded)
        try {
            const policy = await apiDriver.getCurrentPolicy(toPolicyId('terms-of-service'));
            expect(policy).toHaveProperty('id');
        } catch (error: any) {
            // 404 is acceptable if policy isn't seeded
            expect(error.status).toBe(404);
        }
    });

    it('GET /policies/privacy-policy/text returns plain text', async () => {
        // Tests that the privacy policy text endpoint returns text content
        try {
            const text = await apiDriver.getPrivacyPolicy();
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
        } catch (error: any) {
            // 404 is acceptable if policy isn't seeded
            expect(error.status).toBe(404);
        }
    });

    it('GET /policies/terms-of-service/text returns plain text', async () => {
        // Tests that the terms of service text endpoint returns text content
        try {
            const text = await apiDriver.getTermsOfService();
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
        } catch (error: any) {
            // 404 is acceptable if policy isn't seeded
            expect(error.status).toBe(404);
        }
    });

    it('GET /policies/cookie-policy/text returns plain text', async () => {
        // Tests that the cookie policy text endpoint returns text content
        try {
            const text = await apiDriver.getCookiePolicy();
            expect(typeof text).toBe('string');
            expect(text.length).toBeGreaterThan(0);
        } catch (error: any) {
            // 404 is acceptable if policy isn't seeded
            expect(error.status).toBe(404);
        }
    });
});
