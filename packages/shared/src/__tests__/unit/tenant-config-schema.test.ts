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
                .withMarketingFlags(
                    new MarketingFlagsBuilder()
                        .withShowLandingPage(true)
                        .withShowMarketingContent(true)
                        .withShowPricingPage(false)
                        .build(),
                )
                .build();

            const result = TenantConfigSchema.parse(tenantConfig);

            // Verify required fields
            expect(result.tenantId).toBe('test-tenant');
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();

            // Verify required branding fields (colors only)
            const { branding } = result;
            expect(branding.primaryColor).toBe('#0066CC');
            expect(branding.secondaryColor).toBe('#FF6600');

            // Verify optional branding fields are preserved (not stripped)
            expect(branding.accentColor).toBe('#EC4899');

            // Verify brandingTokens fields (appName, logoUrl, faviconUrl are here now)
            const { brandingTokens } = result;
            expect(brandingTokens.tokens.legal.appName).toBe('Test App');
            expect(brandingTokens.tokens.assets.logoUrl).toBe('https://example.com/logo.svg');
            expect(brandingTokens.tokens.assets.faviconUrl).toBe('https://example.com/favicon.ico');

            // Verify marketing flags (stored at top level, not under branding)
            expect(result.marketingFlags).toBeDefined();
            expect(result.marketingFlags?.showLandingPage).toBe(true);
            expect(result.marketingFlags?.showMarketingContent).toBe(true);
            expect(result.marketingFlags?.showPricingPage).toBe(false);
        });
    });
});
