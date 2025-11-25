import {
    TenantBrandingSchema,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantSurfaceColor,
    toTenantCustomCss,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantTextColor,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema } from './common';

const normalizeDomain = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    const [host] = trimmed.split(',');
    const withoutPort = host.trim().replace(/:\d+$/, '');
    return withoutPort;
};

const DomainStringSchema = z
    .string()
    .min(1)
    .transform((value) => toTenantDomainName(normalizeDomain(value)));

const BrandingMarketingFlagsSchema = z.object({
    showLandingPage: z.boolean().transform(toShowLandingPageFlag).optional(),
    showMarketingContent: z.boolean().transform(toShowMarketingContentFlag).optional(),
    showPricingPage: z.boolean().transform(toShowPricingPageFlag).optional(),
});

const BrandingSchema = z.object({
    appName: z.string().min(1).transform(toTenantAppName),
    logoUrl: z.string().min(1).transform(toTenantLogoUrl),
    faviconUrl: z.string().min(1).transform(toTenantFaviconUrl).optional(), // Optional - falls back to logoUrl
    primaryColor: z.string().min(1).transform(toTenantPrimaryColor),
    secondaryColor: z.string().min(1).transform(toTenantSecondaryColor),
    surfaceColor: z.string().min(1).transform(toTenantSurfaceColor).optional(),
    textColor: z.string().min(1).transform(toTenantTextColor).optional(),
    accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
    themePalette: z.string().min(1).transform(toTenantThemePaletteName).optional(),
    customCSS: z.string().transform(toTenantCustomCss).optional(),
    marketingFlags: BrandingMarketingFlagsSchema.optional(),
});

const DomainSchema = z.array(DomainStringSchema).min(1, 'At least one domain is required');

export const TenantDocumentSchema = z
    .object({
        id: z.string().min(1).transform(toTenantId),
        branding: BrandingSchema,
        brandingTokens: TenantBrandingSchema.optional(),
        domains: DomainSchema,
        defaultTenant: z.boolean().transform(toTenantDefaultFlag).optional(),
    })
    .merge(AuditFieldsSchema.pick({ createdAt: true, updatedAt: true }))
    .strict();

export type TenantDocument = z.infer<typeof TenantDocumentSchema>;

export const AdminUpsertTenantRequestSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    branding: BrandingSchema,
    brandingTokens: TenantBrandingSchema.optional(),
    domains: DomainSchema,
    defaultTenant: z.boolean().transform(toTenantDefaultFlag).optional(),
});

export type AdminUpsertTenantRequest = z.infer<typeof AdminUpsertTenantRequestSchema>;

export const PublishTenantThemeRequestSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
});

/**
 * Schema for updating tenant branding (partial update)
 * Used for PUT /settings/tenant/branding endpoint
 */
export const UpdateTenantBrandingRequestSchema = z
    .object({
        appName: z.string().min(1).transform(toTenantAppName).optional(),
        logoUrl: z.string().min(1).transform(toTenantLogoUrl).optional(),
        faviconUrl: z.string().min(1).transform(toTenantFaviconUrl).optional(),
        primaryColor: z.string().min(1).transform(toTenantPrimaryColor).optional(),
        secondaryColor: z.string().min(1).transform(toTenantSecondaryColor).optional(),
        surfaceColor: z.string().min(1).transform(toTenantSurfaceColor).optional(),
        textColor: z.string().min(1).transform(toTenantTextColor).optional(),
        accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
        themePalette: z.string().min(1).transform(toTenantThemePaletteName).optional(),
        customCSS: z.string().transform(toTenantCustomCss).optional(),
        marketingFlags: BrandingMarketingFlagsSchema.partial().optional(),
    })
    .strict();
