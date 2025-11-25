import { TenantConfigSchema } from '@billsplit-wl/shared';
import { TenantBrowserRecordBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';

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
 * This was the root cause of the tenant editor bug where backgroundColor
 * and other fields were being stripped out.
 */
describe('Tenant API Response Validation', () => {
    describe('TenantConfigSchema', () => {
        it('should validate ALL branding fields including backgroundColor and headerBackgroundColor', () => {
            // Use builder to create test data with ALL fields
            const tenantRecord = new TenantBrowserRecordBuilder()
                .withTenantId('test-tenant')
                .withAppName('Test App')
                .withLogoUrl('/logo.svg')
                .withFaviconUrl('/favicon.ico')
                .withPrimaryColor('#3B82F6')
                .withSecondaryColor('#8B5CF6')
                .withAccentColor('#EC4899')
                .withBackgroundColor('#ffffff')
                .withHeaderBackgroundColor('#1F2937')
                .withThemePalette('default')
                .withCustomCss('/* test */')
                .withMarketingFlags({
                    showLandingPage: true,
                    showMarketingContent: true,
                    showPricingPage: false,
                })
                .build();

            // Parse the tenant config with the schema - this simulates schema validation
            const result = TenantConfigSchema.parse(tenantRecord.tenant);

            // Verify ALL branding fields are preserved after schema validation
            const branding = result.branding;

            // Every field must be validated to prevent regression
            expect(branding.appName).toBe('Test App');
            expect(branding.logoUrl).toBe('/logo.svg');
            expect(branding.faviconUrl).toBe('/favicon.ico');
            expect(branding.primaryColor).toBe('#3B82F6');
            expect(branding.secondaryColor).toBe('#8B5CF6');
            expect(branding.accentColor).toBe('#EC4899');
            expect(branding.backgroundColor).toBe('#ffffff');
            expect(branding.headerBackgroundColor).toBe('#1F2937');
            expect(branding.themePalette).toBe('default');
            expect(branding.customCSS).toBe('/* test */');
            expect(branding.marketingFlags).toBeDefined();
            expect(branding.marketingFlags?.showLandingPage).toBe(true);
            expect(branding.marketingFlags?.showMarketingContent).toBe(true);
            expect(branding.marketingFlags?.showPricingPage).toBe(false);
        });
    });
});
