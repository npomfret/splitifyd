import {
    toTenantAccentColor,
    toTenantAppName,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import type { BrandingConfig } from '@billsplit-wl/shared';

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

    build(): BrandingConfig {
        return this.config as BrandingConfig;
    }
}
