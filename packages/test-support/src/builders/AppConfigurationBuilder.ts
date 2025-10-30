import type {
    AppConfiguration,
    BrandingConfig,
    BrandingMarketingFlags,
    EnvironmentConfig,
    FeatureConfig,
    FirebaseConfig,
    FormDefaults,
    TenantConfig,
} from '@splitifyd/shared';
import {
    isoStringNow,
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toShowBlogPageFlag,
    toShowLandingPageFlag,
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
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
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
    showPricingPage?: boolean;
    showBlogPage?: boolean;
}

export interface TenantFeatureOverrides {
    enableAdvancedReporting?: boolean;
    enableMultiCurrency?: boolean;
    enableCustomFields?: boolean;
    maxGroupsPerUser?: number;
    maxUsersPerGroup?: number;
}

export interface TenantOverrides {
    tenantId?: string;
    branding?: TenantBrandingOverrides;
    features?: TenantFeatureOverrides;
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

        if (overrides.features) {
            this.applyFeatureOverrides(this.tenant.features, overrides.features);
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
                    showPricingPage: true,
                    showBlogPage: false,
                }),
            },
            features: {
                enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
                enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                enableCustomFields: toFeatureToggleCustomFields(true),
                maxGroupsPerUser: toTenantMaxGroupsPerUser(50),
                maxUsersPerGroup: toTenantMaxUsersPerGroup(100),
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

    private applyFeatureOverrides(features: FeatureConfig, overrides: TenantFeatureOverrides): void {
        if (overrides.enableAdvancedReporting !== undefined) {
            features.enableAdvancedReporting = toFeatureToggleAdvancedReporting(overrides.enableAdvancedReporting);
        }
        if (overrides.enableMultiCurrency !== undefined) {
            features.enableMultiCurrency = toFeatureToggleMultiCurrency(overrides.enableMultiCurrency);
        }
        if (overrides.enableCustomFields !== undefined) {
            features.enableCustomFields = toFeatureToggleCustomFields(overrides.enableCustomFields);
        }
        if (overrides.maxGroupsPerUser !== undefined) {
            features.maxGroupsPerUser = toTenantMaxGroupsPerUser(overrides.maxGroupsPerUser);
        }
        if (overrides.maxUsersPerGroup !== undefined) {
            features.maxUsersPerGroup = toTenantMaxUsersPerGroup(overrides.maxUsersPerGroup);
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

        if (overrides.showPricingPage !== undefined) {
            flags.showPricingPage = toShowPricingPageFlag(overrides.showPricingPage);
        }

        if (overrides.showBlogPage !== undefined) {
            flags.showBlogPage = toShowBlogPageFlag(overrides.showBlogPage);
        }

        return flags;
    }

    private createBrandingFlags(flags: TenantBrandingFlagsOverrides): BrandingMarketingFlags {
        const marketing: BrandingMarketingFlags = {};

        if (flags.showLandingPage !== undefined) {
            marketing.showLandingPage = toShowLandingPageFlag(flags.showLandingPage);
        }

        if (flags.showPricingPage !== undefined) {
            marketing.showPricingPage = toShowPricingPageFlag(flags.showPricingPage);
        }

        if (flags.showBlogPage !== undefined) {
            marketing.showBlogPage = toShowBlogPageFlag(flags.showBlogPage);
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
            features: { ...tenant.features },
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
        };
    }
}
