import type {
    BrandingMarketingFlags,
    TenantAccentColor,
    TenantAppName,
    TenantCustomCss,
    TenantFaviconUrl,
    TenantLogoUrl,
    TenantPrimaryColor,
    TenantSecondaryColor,
    TenantThemePaletteName,
    UpdateTenantBrandingRequest,
} from '@billsplit-wl/shared';
import {
    toShowLandingPageFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantCustomCss,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

export class TenantBrandingUpdateBuilder {
    private update: Partial<UpdateTenantBrandingRequest>;

    constructor(useDefaults: boolean = true) {
        if (useDefaults) {
            this.update = {
                appName: toTenantAppName(`Test App ${generateShortId()}`),
                primaryColor: toTenantPrimaryColor('#2563eb'),
            };
        } else {
            this.update = {};
        }
    }

    static empty(): TenantBrandingUpdateBuilder {
        return new TenantBrandingUpdateBuilder(false);
    }

    withAppName(appName: TenantAppName | string): this {
        this.update.appName = typeof appName === 'string' ? toTenantAppName(appName) : appName;
        return this;
    }

    withLogoUrl(logoUrl: TenantLogoUrl | string): this {
        this.update.logoUrl = typeof logoUrl === 'string' ? toTenantLogoUrl(logoUrl) : logoUrl;
        return this;
    }

    withFaviconUrl(faviconUrl: TenantFaviconUrl | string): this {
        this.update.faviconUrl = typeof faviconUrl === 'string' ? toTenantFaviconUrl(faviconUrl) : faviconUrl;
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

    withThemePalette(themePalette: TenantThemePaletteName | string): this {
        this.update.themePalette =
            typeof themePalette === 'string' ? toTenantThemePaletteName(themePalette) : themePalette;
        return this;
    }

    withCustomCSS(customCSS: TenantCustomCss | string): this {
        this.update.customCSS = typeof customCSS === 'string' ? toTenantCustomCss(customCSS) : customCSS;
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
        (this.update as any).appName = toTenantAppName(value);
        return this;
    }

    build(): Partial<UpdateTenantBrandingRequest> {
        return { ...this.update };
    }
}
