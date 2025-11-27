import {
    toISOString,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantCustomCss,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantSurfaceColor,
    toTenantTextColor,
    toTenantThemePaletteName,
} from '../shared-types';
import type { BrandingMarketingFlags, ISOString, TenantConfig, TenantId } from '../shared-types';

export class TenantConfigBuilder {
    private config: Partial<TenantConfig> = {};

    constructor(tenantId?: string) {
        this.config.tenantId = toTenantId(tenantId || 'test-tenant');
        this.config.branding = {
            appName: toTenantAppName('Test App'),
            logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
            faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor('#0066CC'),
            secondaryColor: toTenantSecondaryColor('#FF6600'),
        };
        this.config.createdAt = toISOString('2025-01-15T10:00:00.000Z');
        this.config.updatedAt = toISOString('2025-01-20T14:30:00.000Z');
    }

    withTenantId(tenantId: TenantId | string): this {
        this.config.tenantId = toTenantId(tenantId);
        return this;
    }

    withAppName(appName: string): this {
        this.config.branding!.appName = toTenantAppName(appName);
        return this;
    }

    withLogoUrl(url: string): this {
        this.config.branding!.logoUrl = toTenantLogoUrl(url);
        return this;
    }

    withFaviconUrl(url: string): this {
        this.config.branding!.faviconUrl = toTenantFaviconUrl(url);
        return this;
    }

    withPrimaryColor(color: string): this {
        this.config.branding!.primaryColor = toTenantPrimaryColor(color);
        return this;
    }

    withSecondaryColor(color: string): this {
        this.config.branding!.secondaryColor = toTenantSecondaryColor(color);
        return this;
    }

    withAccentColor(color: string): this {
        this.config.branding!.accentColor = toTenantAccentColor(color);
        return this;
    }

    withSurfaceColor(color: string): this {
        this.config.branding!.surfaceColor = toTenantSurfaceColor(color);
        return this;
    }

    withTextColor(color: string): this {
        this.config.branding!.textColor = toTenantTextColor(color);
        return this;
    }

    withThemePalette(palette: string): this {
        this.config.branding!.themePalette = toTenantThemePaletteName(palette);
        return this;
    }

    withCustomCSS(css: string): this {
        this.config.branding!.customCSS = toTenantCustomCss(css);
        return this;
    }

    withMarketingFlags(flags: { showLandingPage?: boolean; showMarketingContent?: boolean; showPricingPage?: boolean; }): this {
        const brandedFlags: BrandingMarketingFlags = {};
        if (flags.showLandingPage !== undefined) {
            brandedFlags.showLandingPage = toShowLandingPageFlag(flags.showLandingPage);
        }
        if (flags.showMarketingContent !== undefined) {
            brandedFlags.showMarketingContent = toShowMarketingContentFlag(flags.showMarketingContent);
        }
        if (flags.showPricingPage !== undefined) {
            brandedFlags.showPricingPage = toShowPricingPageFlag(flags.showPricingPage);
        }
        this.config.branding!.marketingFlags = brandedFlags;
        return this;
    }

    withCreatedAt(date: ISOString | string): this {
        this.config.createdAt = toISOString(date);
        return this;
    }

    withUpdatedAt(date: ISOString | string): this {
        this.config.updatedAt = toISOString(date);
        return this;
    }

    build(): TenantConfig {
        return this.config as TenantConfig;
    }
}
