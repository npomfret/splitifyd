import type {
    TenantAccentColor,
    TenantPrimaryColor,
    TenantSecondaryColor,
    UpdateTenantBrandingRequest,
} from '@billsplit-wl/shared';
import {
    toShowLandingPageFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

export class TenantBrandingUpdateBuilder {
    private update: Partial<UpdateTenantBrandingRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            this.update = {
                appName: `Test App ${generateShortId()}`,
                primaryColor: toTenantPrimaryColor('#2563eb'),
            };
        } else {
            this.update = {};
        }
    }

    static empty(): TenantBrandingUpdateBuilder {
        return new TenantBrandingUpdateBuilder(false);
    }

    withAppName(appName: string): this {
        this.update.appName = appName;
        return this;
    }

    withLogoUrl(logoUrl: string): this {
        this.update.logoUrl = logoUrl;
        return this;
    }

    withFaviconUrl(faviconUrl: string): this {
        this.update.faviconUrl = faviconUrl;
        return this;
    }

    withPrimaryColor(primaryColor: TenantPrimaryColor | string): this {
        this.update.primaryColor = typeof primaryColor === 'string' ? toTenantPrimaryColor(primaryColor) : primaryColor;
        return this;
    }

    withSecondaryColor(secondaryColor: TenantSecondaryColor | string): this {
        this.update.secondaryColor =
            typeof secondaryColor === 'string' ? toTenantSecondaryColor(secondaryColor) : secondaryColor;
        return this;
    }

    withAccentColor(accentColor: TenantAccentColor | string): this {
        this.update.accentColor = typeof accentColor === 'string' ? toTenantAccentColor(accentColor) : accentColor;
        return this;
    }

    withMarketingFlags(flags: { showLandingPage?: boolean; showPricingPage?: boolean }): this {
        this.update.marketingFlags = {
            ...(flags.showLandingPage !== undefined && { showLandingPage: toShowLandingPageFlag(flags.showLandingPage) }),
            ...(flags.showPricingPage !== undefined && { showPricingPage: toShowPricingPageFlag(flags.showPricingPage) }),
        };
        return this;
    }

    /** For testing validation - adds an invalid extra field */
    withExtraField(fieldName: string, value: unknown): this {
        (this.update as Record<string, unknown>)[fieldName] = value;
        return this;
    }

    /** For testing validation - sets appName to empty string */
    withInvalidAppName(value: string): this {
        this.update.appName = value;
        return this;
    }

    build(): Partial<UpdateTenantBrandingRequest> {
        return { ...this.update };
    }
}
