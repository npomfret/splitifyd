
import {
    toTenantAppName,
    toTenantLogoUrl,
    toTenantFaviconUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantAccentColor,
    toTenantThemePaletteName,
    toTenantCustomCss,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
} from '@billsplit-wl/shared';
import type { BrandingConfig, BrandingMarketingFlags, TenantAccentColor, TenantAppName, TenantCustomCss, TenantFaviconUrl, TenantLogoUrl, TenantPrimaryColor, TenantSecondaryColor, TenantThemePaletteName } from '@billsplit-wl/shared';

export class BrandingConfigBuilder {
    private config: Partial<BrandingConfig> = {};

    constructor() {
        this.config.appName = toTenantAppName('Test App');
        this.config.logoUrl = toTenantLogoUrl('https://example.com/logo.svg');
        this.config.faviconUrl = toTenantFaviconUrl('https://example.com/favicon.ico');
        this.config.primaryColor = toTenantPrimaryColor('#0066CC');
        this.config.secondaryColor = toTenantSecondaryColor('#FF6600');
    }

    withAppName(appName: string): this {
        this.config.appName = toTenantAppName(appName);
        return this;
    }

    withLogoUrl(url: string): this {
        this.config.logoUrl = toTenantLogoUrl(url);
        return this;
    }

    withFaviconUrl(url: string): this {
        this.config.faviconUrl = toTenantFaviconUrl(url);
        return this;
    }

    withPrimaryColor(color: string): this {
        this.config.primaryColor = toTenantPrimaryColor(color);
        return this;
    }

    withSecondaryColor(color: string): this {
        this.config.secondaryColor = toTenantSecondaryColor(color);
        return this;
    }

    withAccentColor(color: string): this {
        this.config.accentColor = toTenantAccentColor(color);
        return this;
    }

    withThemePalette(palette: string): this {
        this.config.themePalette = toTenantThemePaletteName(palette);
        return this;
    }

    withCustomCSS(css: string): this {
        this.config.customCSS = toTenantCustomCss(css);
        return this;
    }

    withMarketingFlags(flags: Partial<BrandingMarketingFlags>): this {
        this.config.marketingFlags = {
            ...this.config.marketingFlags,
            ...flags,
        };
        return this;
    }

    build(): BrandingConfig {
        return this.config as BrandingConfig;
    }
}
