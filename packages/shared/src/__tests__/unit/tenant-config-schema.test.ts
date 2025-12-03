import { describe, expect, it } from 'vitest';
import { MarketingFlagsBuilder, TenantConfigBuilder, TenantConfigSchema } from '../../index';

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
 */
describe('Tenant API Response Validation', () => {
    describe('TenantConfigSchema', () => {
        it('should preserve ALL branding fields including optional ones after schema validation', () => {
            const tenantConfig = new TenantConfigBuilder()
                .withAccentColor('#EC4899')
                .withSurfaceColor('#ffffff')
                .withTextColor('#1F2937')
                .withThemePalette('default')
                .withCustomCSS('/* test */')
                .withMarketingFlags(
                    new MarketingFlagsBuilder()
                        .withShowLandingPage(true)
                        .withShowMarketingContent(true)
                        .withShowPricingPage(false)
                        .build()
                )
                .build();

            const result = TenantConfigSchema.parse(tenantConfig);

            // Verify required fields
            expect(result.tenantId).toBe('test-tenant');
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();

            // Verify required branding fields
            const { branding } = result;
            expect(branding.appName).toBe('Test App');
            expect(branding.logoUrl).toBe('https://example.com/logo.svg');
            expect(branding.faviconUrl).toBe('https://example.com/favicon.ico');
            expect(branding.primaryColor).toBe('#0066CC');
            expect(branding.secondaryColor).toBe('#FF6600');

            // Verify optional branding fields are preserved (not stripped)
            expect(branding.accentColor).toBe('#EC4899');
            expect(branding.surfaceColor).toBe('#ffffff');
            expect(branding.textColor).toBe('#1F2937');
            expect(branding.themePalette).toBe('default');
            expect(branding.customCSS).toBe('/* test */');

            // Verify marketing flags
            expect(branding.marketingFlags).toBeDefined();
            expect(branding.marketingFlags?.showLandingPage).toBe(true);
            expect(branding.marketingFlags?.showMarketingContent).toBe(true);
            expect(branding.marketingFlags?.showPricingPage).toBe(false);
        });
    });
});
