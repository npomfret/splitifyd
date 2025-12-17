import { toPolicyId } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Public endpoints', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    describe('Shareable pages (OG tags)', () => {
        it('GET /join returns HTML with OG meta tags', async () => {
            const { html, headers } = await apiDriver.getShareablePage('/join');

            // Should return HTML
            expect(headers.get('content-type')).toContain('text/html');

            // Should have OG tags
            expect(html).toContain('og:title');
            expect(html).toContain('og:description');
            expect(html).toContain('og:image');
            expect(html).toContain('og:url');
            expect(html).toContain('og:type');
            expect(html).toContain('og:site_name');

            // Should have Twitter Card tags
            expect(html).toContain('twitter:card');
            expect(html).toContain('twitter:title');
            expect(html).toContain('twitter:description');
            expect(html).toContain('twitter:image');
        });

        it('GET /join sets Vary: Host header for CDN caching', async () => {
            const { headers } = await apiDriver.getShareablePage('/join');

            expect(headers.get('vary')).toContain('Host');
        });

        it('GET /join sets Cache-Control header', async () => {
            const { headers } = await apiDriver.getShareablePage('/join');

            expect(headers.get('cache-control')).toContain('public');
            expect(headers.get('cache-control')).toContain('max-age=');
        });

        it('GET /join includes translated description', async () => {
            const { html } = await apiDriver.getShareablePage('/join');

            // Should contain the translated description (or fallback)
            expect(html).toMatch(/og:description.*content="[^"]+"/);
        });

        it('GET /join includes join-specific title with appName', async () => {
            const { html } = await apiDriver.getShareablePage('/join');

            // Title should include "Join a group on" pattern
            expect(html).toMatch(/og:title.*content="Join a group on [^"]+"/);
        });

        it('GET /join works with query params', async () => {
            const { html } = await apiDriver.getShareablePage('/join?shareToken=test123');

            // Should still have OG tags
            expect(html).toContain('og:title');

            // URL should include query params
            expect(html).toContain('shareToken=test123');
        });

        it('GET /join with lang=de uses German translations', async () => {
            const { html } = await apiDriver.getShareablePage('/join?shareToken=test123&lang=de');

            // Should have German OG tags
            expect(html).toContain('Einer Gruppe auf');
            expect(html).toContain('Teilen Sie Ausgaben einfach mit Freunden und Familie');
        });

        it('GET /join with lang=es uses Spanish translations', async () => {
            const { html } = await apiDriver.getShareablePage('/join?shareToken=test123&lang=es');

            // Should have Spanish OG tags
            expect(html).toContain('Únete a un grupo en');
            expect(html).toContain('Divide gastos fácilmente con amigos y familiares');
        });

        it('GET /join with unsupported lang falls back to English', async () => {
            const { html } = await apiDriver.getShareablePage('/join?shareToken=test123&lang=xyz');

            // Should fall back to English OG tags
            expect(html).toContain('Join a group on');
            expect(html).toContain('Split expenses easily with friends and family');
        });
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
