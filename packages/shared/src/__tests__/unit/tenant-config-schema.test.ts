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
 */
describe('Tenant API Response Validation', () => {
    describe('TenantConfigSchema', () => {
        it('should preserve ALL branding fields including optional ones after schema validation', () => {
            const tenantConfig = new TenantConfigBuilder()
                .withAccentColor('#EC4899')
                .withAppName('My Test App')
                .withLogoUrl('https://example.com/logo.svg')
                .withFaviconUrl('https://example.com/favicon.ico')
                .withMarketingFlags(
                    new MarketingFlagsBuilder()
                        .withShowMarketingContent(true)
                        .withShowPricingPage(false)
                        .build(),
                )
                .build();

            const result = TenantConfigSchema.parse(tenantConfig);

            // Verify optional branding fields are preserved (not stripped by schema)
            expect(result.branding.accentColor).toBe('#EC4899');

            // Verify brandingTokens fields are preserved
            expect(result.brandingTokens.tokens.legal.appName).toBe('My Test App');
            expect(result.brandingTokens.tokens.assets.logoUrl).toBe('https://example.com/logo.svg');
            expect(result.brandingTokens.tokens.assets.faviconUrl).toBe('https://example.com/favicon.ico');

            // Verify marketing flags are preserved
            expect(result.marketingFlags?.showMarketingContent).toBe(true);
            expect(result.marketingFlags?.showPricingPage).toBe(false);
        });
    });
});
