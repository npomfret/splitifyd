import type { ClientAppConfiguration, FirebaseConfig, FormDefaults, TenantConfig, ThemeConfig } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/shared';

export type TenantMarketingFlagsOverrides = Partial<TenantConfig['marketingFlags']>;
export type TenantBrandingOverrides = Partial<TenantConfig['branding']>;
export type TenantOverrides = Partial<Omit<TenantConfig, 'branding'>> & {
    branding?: TenantBrandingOverrides;
};

export class AppConfigurationBuilder {
    private config: Partial<ClientAppConfiguration> = {};

    constructor() {
        this.config.firebase = {
            apiKey: 'test',
            authDomain: 'test',
            projectId: 'test',
            storageBucket: 'test',
            messagingSenderId: 'test',
            appId: 'test',
        };
        this.config.warningBanner = 'warningBanner';
        this.config.formDefaults = {};
        this.config.tenant = new TenantConfigBuilder().build();
    }

    withFirebaseConfig(firebase: FirebaseConfig): this {
        this.config.firebase = firebase;
        return this;
    }

    withFormDefaults(formDefaults: FormDefaults): this {
        this.config.formDefaults = formDefaults;
        return this;
    }

    withTenantConfig(tenant: TenantConfig): this {
        this.config.tenant = tenant;
        return this;
    }

    withTenantOverrides(overrides: TenantOverrides): this {
        if (!this.config.tenant) {
            // Create a default tenant config if one doesn't exist
            this.config.tenant = new TenantConfigBuilder().build();
        }

        // Deep merge the overrides
        const { branding, marketingFlags, ...otherOverrides } = overrides;
        this.config.tenant = {
            ...this.config.tenant,
            ...otherOverrides,
            branding: {
                ...this.config.tenant.branding,
                ...(branding && {
                    // Only merge color fields - appName/logoUrl/faviconUrl are in brandingTokens
                    ...(branding.primaryColor !== undefined && { primaryColor: branding.primaryColor }),
                    ...(branding.secondaryColor !== undefined && { secondaryColor: branding.secondaryColor }),
                    ...(branding.accentColor !== undefined && { accentColor: branding.accentColor }),
                }),
            },
            ...(marketingFlags && {
                marketingFlags: {
                    ...this.config.tenant.marketingFlags,
                    ...marketingFlags,
                },
            }),
        };

        return this;
    }

    withThemeConfig(theme: ThemeConfig | null): this {
        this.config.theme = theme;
        return this;
    }

    build(): ClientAppConfiguration {
        return this.config as ClientAppConfiguration;
    }
}
