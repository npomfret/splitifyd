import {
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toShowBlogPageFlag,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantBackgroundColor,
    toTenantHeaderBackgroundColor,
    toTenantCustomCss,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
} from '@splitifyd/shared';
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
    showBlogPage: z.boolean().transform(toShowBlogPageFlag).optional(),
});

const BrandingSchema = z.object({
    appName: z.string().min(1).transform(toTenantAppName),
    logoUrl: z.string().min(1).transform(toTenantLogoUrl),
    faviconUrl: z.string().min(1).transform(toTenantFaviconUrl),
    primaryColor: z.string().min(1).transform(toTenantPrimaryColor),
    secondaryColor: z.string().min(1).transform(toTenantSecondaryColor),
    backgroundColor: z.string().min(1).transform(toTenantBackgroundColor).optional(),
    headerBackgroundColor: z.string().min(1).transform(toTenantHeaderBackgroundColor).optional(),
    accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
    themePalette: z.string().min(1).transform(toTenantThemePaletteName).optional(),
    customCSS: z.string().transform(toTenantCustomCss).optional(),
    marketingFlags: BrandingMarketingFlagsSchema.optional(),
});

const FeatureSchema = z.object({
    enableAdvancedReporting: z.boolean().transform(toFeatureToggleAdvancedReporting),
    enableMultiCurrency: z.boolean().transform(toFeatureToggleMultiCurrency),
    enableCustomFields: z.boolean().transform(toFeatureToggleCustomFields),
    maxGroupsPerUser: z.number().int().min(0).transform(toTenantMaxGroupsPerUser),
    maxUsersPerGroup: z.number().int().min(0).transform(toTenantMaxUsersPerGroup),
});

const DomainSchema = z.object({
    primary: DomainStringSchema,
    aliases: z.array(DomainStringSchema).default([]),
    normalized: z.array(DomainStringSchema).default([]),
});

export const TenantDocumentSchema = z
    .object({
        id: z.string().min(1).transform(toTenantId),
        branding: BrandingSchema,
        features: FeatureSchema,
        domains: DomainSchema,
        defaultTenant: z.boolean().transform(toTenantDefaultFlag).optional(),
    })
    .merge(AuditFieldsSchema.pick({ createdAt: true, updatedAt: true }))
    .strict();

export type TenantDocument = z.infer<typeof TenantDocumentSchema>;

/**
 * Schema for updating tenant branding (partial update)
 * Used for PUT /settings/tenant/branding endpoint
 */
export const UpdateTenantBrandingRequestSchema = z.object({
    appName: z.string().min(1).transform(toTenantAppName).optional(),
    logoUrl: z.string().min(1).transform(toTenantLogoUrl).optional(),
    faviconUrl: z.string().min(1).transform(toTenantFaviconUrl).optional(),
    primaryColor: z.string().min(1).transform(toTenantPrimaryColor).optional(),
    secondaryColor: z.string().min(1).transform(toTenantSecondaryColor).optional(),
    backgroundColor: z.string().min(1).transform(toTenantBackgroundColor).optional(),
    headerBackgroundColor: z.string().min(1).transform(toTenantHeaderBackgroundColor).optional(),
    accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
    themePalette: z.string().min(1).transform(toTenantThemePaletteName).optional(),
    customCSS: z.string().transform(toTenantCustomCss).optional(),
    marketingFlags: BrandingMarketingFlagsSchema.partial().optional(),
}).strict();
