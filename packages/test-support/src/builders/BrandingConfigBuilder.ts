import {
    toTenantAccentColor,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import type { BrandingConfig } from '@billsplit-wl/shared';

export class BrandingConfigBuilder {
    private config: Partial<BrandingConfig> = {};

    constructor() {
        this.config.primaryColor = toTenantPrimaryColor('#0066CC');
        this.config.secondaryColor = toTenantSecondaryColor('#FF6600');
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
