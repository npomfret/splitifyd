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
