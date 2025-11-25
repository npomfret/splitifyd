import {
    toISOString,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantSurfaceColor,
    toTenantCustomCss,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantTextColor,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import type { ISOString, TenantAccentColor, TenantAppName, TenantSurfaceColor, TenantBranding, TenantBrowserRecord, TenantCustomCss, TenantDomainName, TenantFaviconUrl, TenantTextColor, TenantId, TenantLogoUrl, TenantPrimaryColor, TenantSecondaryColor, TenantThemePaletteName } from '@billsplit-wl/shared';

/**
 * Builder for TenantBrowserRecord - the tenant representation returned by /admin/browser/tenants
 *
 * This includes the full tenant config plus domain information and default status.
 * Use this for building test data for UI tests that consume the browser tenant API.
 */
export class TenantBrowserRecordBuilder {
    private record: TenantBrowserRecord;

    constructor() {
        this.record = {
            tenant: {
                tenantId: toTenantId('test-tenant'),
                branding: {
                    appName: toTenantAppName('Test App'),
                    logoUrl: toTenantLogoUrl('/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#3B82F6'),
                    secondaryColor: toTenantSecondaryColor('#8B5CF6'),
                    accentColor: toTenantAccentColor('#EC4899'),
                    surfaceColor: toTenantSurfaceColor('#ffffff'),
                    textColor: toTenantTextColor('#1F2937'),
                    themePalette: toTenantThemePaletteName('default'),
                    customCSS: toTenantCustomCss(''),
                    marketingFlags: {
                        showLandingPage: toShowLandingPageFlag(true),
                        showMarketingContent: toShowMarketingContentFlag(true),
                        showPricingPage: toShowPricingPageFlag(false),
                    },
                },
                createdAt: toISOString('2025-01-01T00:00:00.000Z'),
                updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
            },
            domains: [toTenantDomainName('localhost')],
            isDefault: toTenantDefaultFlag(false),
            brandingTokens: undefined,
        };
    }

    withTenantId(tenantId: TenantId | string): this {
        this.record.tenant.tenantId = toTenantId(tenantId);
        return this;
    }

    withAppName(appName: TenantAppName | string): this {
        this.record.tenant.branding.appName = toTenantAppName(appName);
        return this;
    }

    withLogoUrl(url: TenantLogoUrl | string): this {
        this.record.tenant.branding.logoUrl = toTenantLogoUrl(url);
        return this;
    }

    withFaviconUrl(url: TenantFaviconUrl | string): this {
        this.record.tenant.branding.faviconUrl = toTenantFaviconUrl(url);
        return this;
    }

    withPrimaryColor(color: TenantPrimaryColor | string): this {
        this.record.tenant.branding.primaryColor = toTenantPrimaryColor(color);
        return this;
    }

    withSecondaryColor(color: TenantSecondaryColor | string): this {
        this.record.tenant.branding.secondaryColor = toTenantSecondaryColor(color);
        return this;
    }

    withAccentColor(color: TenantAccentColor | string): this {
        this.record.tenant.branding.accentColor = toTenantAccentColor(color);
        return this;
    }

    withSurfaceColor(color: TenantSurfaceColor | string): this {
        this.record.tenant.branding.surfaceColor = toTenantSurfaceColor(color);
        return this;
    }

    withTextColor(color: TenantTextColor | string): this {
        this.record.tenant.branding.textColor = toTenantTextColor(color);
        return this;
    }

    withThemePalette(palette: TenantThemePaletteName | string): this {
        this.record.tenant.branding.themePalette = toTenantThemePaletteName(palette);
        return this;
    }

    withCustomCss(css: TenantCustomCss | string): this {
        this.record.tenant.branding.customCSS = toTenantCustomCss(css);
        return this;
    }

    withMarketingFlags(flags: { showLandingPage?: boolean; showMarketingContent?: boolean; showPricingPage?: boolean; }): this {
        this.record.tenant.branding.marketingFlags = {
            ...this.record.tenant.branding.marketingFlags,
            ...(flags.showLandingPage !== undefined ? { showLandingPage: toShowLandingPageFlag(flags.showLandingPage) } : {}),
            ...(flags.showMarketingContent !== undefined ? { showMarketingContent: toShowMarketingContentFlag(flags.showMarketingContent) } : {}),
            ...(flags.showPricingPage !== undefined ? { showPricingPage: toShowPricingPageFlag(flags.showPricingPage) } : {}),
        };
        return this;
    }

    withDomains(domains: Array<TenantDomainName | string>): this {
        this.record.domains = domains.map(d => typeof d === 'string' ? toTenantDomainName(d) : d);
        return this;
    }

    withIsDefault(isDefault: boolean): this {
        this.record.isDefault = toTenantDefaultFlag(isDefault);
        return this;
    }

    withCreatedAt(date: ISOString | string): this {
        this.record.tenant.createdAt = toISOString(date);
        return this;
    }

    withUpdatedAt(date: ISOString | string): this {
        this.record.tenant.updatedAt = toISOString(date);
        return this;
    }

    withBrandingTokens(tokens: TenantBranding | undefined): this {
        this.record.brandingTokens = tokens;
        return this;
    }

    build(): TenantBrowserRecord {
        // Deep clone to prevent mutations
        return {
            tenant: {
                tenantId: this.record.tenant.tenantId,
                branding: {
                    appName: this.record.tenant.branding.appName,
                    logoUrl: this.record.tenant.branding.logoUrl,
                    faviconUrl: this.record.tenant.branding.faviconUrl,
                    primaryColor: this.record.tenant.branding.primaryColor,
                    secondaryColor: this.record.tenant.branding.secondaryColor,
                    accentColor: this.record.tenant.branding.accentColor,
                    surfaceColor: this.record.tenant.branding.surfaceColor,
                    textColor: this.record.tenant.branding.textColor,
                    themePalette: this.record.tenant.branding.themePalette,
                    customCSS: this.record.tenant.branding.customCSS,
                    marketingFlags: {
                        ...this.record.tenant.branding.marketingFlags,
                    },
                },
                createdAt: this.record.tenant.createdAt,
                updatedAt: this.record.tenant.updatedAt,
            },
            domains: [...this.record.domains],
            isDefault: this.record.isDefault,
            brandingTokens: this.record.brandingTokens ? {
                tokens: this.record.brandingTokens.tokens,
                artifact: this.record.brandingTokens.artifact,
            } : undefined,
        };
    }
}
