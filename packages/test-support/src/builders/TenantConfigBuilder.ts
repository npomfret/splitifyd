
import {
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toISOString,
} from '@billsplit-wl/shared';
import type { ISOString, TenantConfig, TenantId } from '@billsplit-wl/shared';

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
