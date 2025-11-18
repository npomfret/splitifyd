import type { AppConfiguration, BrandingConfig, BrandingMarketingFlags, EnvironmentConfig, FirebaseConfig, FormDefaults, TenantConfig, ThemeConfig } from '@splitifyd/shared';
import {
    isoStringNow,
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
    toTenantThemePaletteName,
} from '@splitifyd/shared';
import { convertToISOString } from '../test-helpers';

export interface TenantBrandingOverrides {
    appName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string | null;
    themePalette?: string | null;
    customCSS?: string | null;
    marketingFlags?: TenantBrandingFlagsOverrides;
}

export interface TenantBrandingFlagsOverrides {
    showLandingPage?: boolean;
    showMarketingContent?: boolean;
    showPricingPage?: boolean;
}

export interface TenantOverrides {
    tenantId?: string;
    branding?: TenantBrandingOverrides;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}

/**
 * Builder for composing AppConfiguration objects used in tests.
 *
 * Provides ergonomic helpers for tweaking Firebase client config,
 * tenant metadata, and other runtime fields without repeating the
 * branded conversions at every call site.
 */
export class AppConfigurationBuilder {
    private firebase: FirebaseConfig;
    private environment: EnvironmentConfig;
    private formDefaults: FormDefaults;
    private tenant?: TenantConfig;
    private theme?: ThemeConfig | null;

    constructor() {
        this.firebase = {
            apiKey: 'test-api-key',
            authDomain: 'test.firebaseapp.com',
            projectId: 'test-project',
            storageBucket: 'test.firebasestorage.app',
            messagingSenderId: '1234567890',
            appId: '1:1234567890:web:abcdef123456',
            measurementId: 'G-TEST1234',
        };

        this.environment = {};

        this.formDefaults = {
            displayName: '',
            email: '',
            password: '',
        };

        this.tenant = this.createDefaultTenant();
        this.theme = null;
    }

    withFirebaseConfig(overrides: Partial<FirebaseConfig>): this {
        this.firebase = {
            ...this.firebase,
            ...overrides,
        };
        return this;
    }

    withEnvironmentConfig(overrides: Partial<EnvironmentConfig>): this {
        this.environment = {
            ...this.environment,
            ...overrides,
        };
        return this;
    }

    withFormDefaults(overrides: Partial<FormDefaults>): this {
        this.formDefaults = {
            ...this.formDefaults,
            ...overrides,
        };
        return this;
    }

    withTenantConfig(tenant: TenantConfig | null | undefined): this {
        this.tenant = tenant ? this.cloneTenant(tenant) : undefined;
        return this;
    }

    withThemeConfig(theme: ThemeConfig | null | undefined): this {
        this.theme = theme ? { ...theme } : null;
        return this;
    }

    withTenantOverrides(overrides: TenantOverrides = {}): this {
        if (!this.tenant) {
            this.tenant = this.createDefaultTenant();
        }

        if (overrides.tenantId) {
            this.tenant.tenantId = toTenantId(overrides.tenantId);
        }

        if (overrides.branding) {
            this.applyBrandingOverrides(this.tenant.branding, overrides.branding);
        }

        if (overrides.createdAt) {
            this.tenant.createdAt = convertToISOString(overrides.createdAt);
        }

        if (overrides.updatedAt) {
            this.tenant.updatedAt = convertToISOString(overrides.updatedAt);
        }

        return this;
    }

    withoutTenant(): this {
        this.tenant = undefined;
        return this;
    }

    build(): AppConfiguration {
        return {
            firebase: { ...this.firebase },
            environment: { ...this.environment },
            formDefaults: { ...this.formDefaults },
            tenant: this.tenant ? this.cloneTenant(this.tenant) : undefined,
            theme: this.theme ? { ...this.theme } : undefined,
        };
    }

    private createDefaultTenant(): TenantConfig {
        const now = isoStringNow();
        return {
            tenantId: toTenantId('acme-demo'),
            branding: {
                appName: toTenantAppName('Acme Splitter'),
                logoUrl: toTenantLogoUrl('https://example.com/branding/acme-logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://example.com/branding/acme-favicon.ico'),
                primaryColor: toTenantPrimaryColor('#123456'),
                secondaryColor: toTenantSecondaryColor('#654321'),
                marketingFlags: this.createBrandingFlags({
                    showLandingPage: true,
                    showMarketingContent: true,
                    showPricingPage: true,
                }),
            },
            createdAt: now,
            updatedAt: now,
        };
    }

    private applyBrandingOverrides(branding: BrandingConfig, overrides: TenantBrandingOverrides): void {
        if (overrides.appName !== undefined) {
            branding.appName = toTenantAppName(overrides.appName);
        }
        if (overrides.logoUrl !== undefined) {
            branding.logoUrl = toTenantLogoUrl(overrides.logoUrl);
        }
        if (overrides.faviconUrl !== undefined) {
            branding.faviconUrl = toTenantFaviconUrl(overrides.faviconUrl);
        }
        if (overrides.primaryColor !== undefined) {
            branding.primaryColor = toTenantPrimaryColor(overrides.primaryColor);
        }
        if (overrides.secondaryColor !== undefined) {
            branding.secondaryColor = toTenantSecondaryColor(overrides.secondaryColor);
        }
        if (overrides.accentColor !== undefined) {
            branding.accentColor = overrides.accentColor === null ? undefined : toTenantAccentColor(overrides.accentColor);
        }
        if (overrides.themePalette !== undefined) {
            branding.themePalette = overrides.themePalette === null ? undefined : toTenantThemePaletteName(overrides.themePalette);
        }
        if (overrides.customCSS !== undefined) {
            branding.customCSS = overrides.customCSS === null ? undefined : toTenantCustomCss(overrides.customCSS);
        }
        if (overrides.marketingFlags) {
            branding.marketingFlags = this.mergeBrandingFlags(branding.marketingFlags, overrides.marketingFlags);
        }
    }

    private mergeBrandingFlags(
        current: BrandingMarketingFlags | undefined,
        overrides: TenantBrandingFlagsOverrides,
    ): BrandingMarketingFlags {
        const flags: BrandingMarketingFlags = { ...(current ?? {}) };

        if (overrides.showLandingPage !== undefined) {
            flags.showLandingPage = toShowLandingPageFlag(overrides.showLandingPage);
        }

        if (overrides.showMarketingContent !== undefined) {
            flags.showMarketingContent = toShowMarketingContentFlag(overrides.showMarketingContent);
        }

        if (overrides.showPricingPage !== undefined) {
            flags.showPricingPage = toShowPricingPageFlag(overrides.showPricingPage);
        }

        return flags;
    }

    private createBrandingFlags(flags: TenantBrandingFlagsOverrides): BrandingMarketingFlags {
        const marketing: BrandingMarketingFlags = {};

        if (flags.showLandingPage !== undefined) {
            marketing.showLandingPage = toShowLandingPageFlag(flags.showLandingPage);
        }

        if (flags.showMarketingContent !== undefined) {
            marketing.showMarketingContent = toShowMarketingContentFlag(flags.showMarketingContent);
        }

        if (flags.showPricingPage !== undefined) {
            marketing.showPricingPage = toShowPricingPageFlag(flags.showPricingPage);
        }

        return marketing;
    }

    private cloneTenant(tenant: TenantConfig): TenantConfig {
        return {
            tenantId: tenant.tenantId,
            branding: {
                ...tenant.branding,
                marketingFlags: tenant.branding.marketingFlags ? { ...tenant.branding.marketingFlags } : undefined,
            },
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
        };
    }
}
