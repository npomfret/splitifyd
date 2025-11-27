import { describe, expect, it } from 'vitest';
import { TenantConfigSchema } from '../../index';

/**
 * Tenant Response Validation Tests
 *
 * These tests verify that the Zod schemas include ALL fields that the backend
 * returns and the UI expects. This catches bugs where:
 * - Backend stores and returns a field
 * - But the Zod schema doesn't include it
 * - So the field gets stripped during schema validation
 * - And the UI receives undefined
 *
 * This was the root cause of the tenant editor bug where surfaceColor
 * and other fields were being stripped out.
 *
 * NOTE: This test uses inline test data instead of builders from test-support
 * to avoid circular dependencies (shared -> test-support -> shared).
 */
describe('Tenant API Response Validation', () => {
    describe('TenantConfigSchema', () => {
        it('should validate ALL branding fields including surfaceColor and textColor', () => {
            // Inline test data to avoid circular dependency with test-support
            const tenantConfig = {
                id: 'test-tenant',
                domains: ['test.example.com'],
                branding: {
                    appName: 'Test App',
                    logoUrl: '/logo.svg',
                    faviconUrl: '/favicon.ico',
                    primaryColor: '#3B82F6',
                    secondaryColor: '#8B5CF6',
                    accentColor: '#EC4899',
                    surfaceColor: '#ffffff',
                    textColor: '#1F2937',
                    themePalette: 'default',
                    customCSS: '/* test */',
                    marketingFlags: {
                        showLandingPage: true,
                        showMarketingContent: true,
                        showPricingPage: false,
                    },
                },
            };

            // Parse the tenant config with the schema - this simulates schema validation
            const result = TenantConfigSchema.parse(tenantConfig);

            // Verify ALL branding fields are preserved after schema validation
            const branding = result.branding;

            // Every field must be validated to prevent regression
            expect(branding.appName).toBe('Test App');
            expect(branding.logoUrl).toBe('/logo.svg');
            expect(branding.faviconUrl).toBe('/favicon.ico');
            expect(branding.primaryColor).toBe('#3B82F6');
            expect(branding.secondaryColor).toBe('#8B5CF6');
            expect(branding.accentColor).toBe('#EC4899');
            expect(branding.surfaceColor).toBe('#ffffff');
            expect(branding.textColor).toBe('#1F2937');
            expect(branding.themePalette).toBe('default');
            expect(branding.customCSS).toBe('/* test */');
            expect(branding.marketingFlags).toBeDefined();
            expect(branding.marketingFlags?.showLandingPage).toBe(true);
            expect(branding.marketingFlags?.showMarketingContent).toBe(true);
            expect(branding.marketingFlags?.showPricingPage).toBe(false);
        });
    });
});
