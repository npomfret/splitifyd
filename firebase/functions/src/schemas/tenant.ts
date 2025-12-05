import {
    TenantBrandingSchema,
    toISOString,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantId,
    toTenantImageId,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toUserId,
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
    primaryColor: z.string().min(1).transform(toTenantPrimaryColor),
    secondaryColor: z.string().min(1).transform(toTenantSecondaryColor),
    accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
    showAppNameInHeader: z.boolean().optional(), // Show app name text next to logo (default: true)
});

const DomainSchema = z.array(DomainStringSchema).min(1, 'At least one domain is required');

export const TenantDocumentSchema = z
    .object({
        id: z.string().min(1).transform(toTenantId),
        branding: BrandingSchema,
        brandingTokens: TenantBrandingSchema, // Required - appName, logoUrl, faviconUrl are in tokens
        marketingFlags: BrandingMarketingFlagsSchema.optional(), // Feature flags (separate from branding)
        domains: DomainSchema,
        defaultTenant: z.boolean().transform(toTenantDefaultFlag).optional(),
    })
    .merge(AuditFieldsSchema.pick({ createdAt: true, updatedAt: true }))
    .strict();

export type TenantDocument = z.infer<typeof TenantDocumentSchema>;

export const AdminUpsertTenantRequestSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    branding: BrandingSchema,
    brandingTokens: TenantBrandingSchema, // Required - no auto-generation
    marketingFlags: BrandingMarketingFlagsSchema.optional(), // Feature flags (separate from branding)
    domains: DomainSchema,
    defaultTenant: z.boolean().transform(toTenantDefaultFlag).optional(),
});

export type AdminUpsertTenantRequest = z.infer<typeof AdminUpsertTenantRequestSchema>;

export const PublishTenantThemeRequestSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
});

export const UploadTenantAssetParamsSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    assetType: z.enum(['logo', 'favicon']),
});

export type UploadTenantAssetParams = z.infer<typeof UploadTenantAssetParamsSchema>;

/**
 * Schema for updating tenant branding (partial update)
 * Used for PUT /settings/tenant/branding endpoint
 *
 * appName, logoUrl, faviconUrl are written to brandingTokens.tokens.* by the handler.
 */
export const UpdateTenantBrandingRequestSchema = z
    .object({
        appName: z.string().min(1).optional(),
        logoUrl: z.string().min(1).optional(),
        faviconUrl: z.string().min(1).optional(),
        primaryColor: z.string().min(1).transform(toTenantPrimaryColor).optional(),
        secondaryColor: z.string().min(1).transform(toTenantSecondaryColor).optional(),
        accentColor: z.string().min(1).transform(toTenantAccentColor).optional(),
        marketingFlags: BrandingMarketingFlagsSchema.partial().optional(),
        showAppNameInHeader: z.boolean().optional(),
    })
    .strict();

// ========================================================================
// Tenant Image Library Schemas
// ========================================================================

/**
 * Tenant image document stored in tenants/{tenantId}/images subcollection
 */
export const TenantImageDocumentSchema = z.object({
    id: z.string().min(1).transform(toTenantImageId),
    name: z.string().min(1).max(100),
    url: z.string().url(),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    uploadedAt: z.string().datetime().transform(toISOString),
    uploadedBy: z.string().min(1).transform(toUserId),
});

export type TenantImageDocument = z.infer<typeof TenantImageDocumentSchema>;

/**
 * Request to upload a new image to the library
 */
export const UploadTenantLibraryImageRequestSchema = z.object({
    name: z.string().min(1).max(100).transform((v) => v.trim()),
});

/**
 * Request to rename an image in the library
 */
export const RenameTenantImageRequestSchema = z.object({
    name: z.string().min(1).max(100).transform((v) => v.trim()),
});

/**
 * Params for tenant image operations
 */
export const TenantImageParamsSchema = z.object({
    tenantId: z.string().min(1).transform(toTenantId),
    imageId: z.string().min(1).transform(toTenantImageId),
});
