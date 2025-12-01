import type { ClientAppConfiguration, FirebaseConfig, FormDefaults, TenantConfig, ThemeConfig } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/shared';

export type TenantBrandingFlagsOverrides = Partial<TenantConfig['branding']['marketingFlags']>;
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
        this.config.warningBanner = "warningBanner";
        this.config.formDefaults = {};
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
        const { branding, ...otherOverrides } = overrides;
        this.config.tenant = {
            ...this.config.tenant,
            ...otherOverrides,
            branding: {
                ...this.config.tenant.branding,
                ...(branding && {
                    // Only merge individual fields if branding is provided
                    ...(branding.appName !== undefined && { appName: branding.appName }),
                    ...(branding.logoUrl !== undefined && { logoUrl: branding.logoUrl }),
                    ...(branding.faviconUrl !== undefined && { faviconUrl: branding.faviconUrl }),
                    ...(branding.primaryColor !== undefined && { primaryColor: branding.primaryColor }),
                    ...(branding.secondaryColor !== undefined && { secondaryColor: branding.secondaryColor }),
                    ...(branding.accentColor !== undefined && { accentColor: branding.accentColor }),
                    ...(branding.themePalette !== undefined && { themePalette: branding.themePalette }),
                    ...(branding.customCSS !== undefined && { customCSS: branding.customCSS }),
                    marketingFlags: {
                        ...this.config.tenant.branding.marketingFlags,
                        ...branding.marketingFlags,
                    },
                }),
            },
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
