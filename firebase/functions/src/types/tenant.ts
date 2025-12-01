import type { BrandingArtifactMetadata, TenantConfig, TenantDefaultFlag, TenantDomainName, TenantId } from '@billsplit-wl/shared';

type TenantResolutionSource = 'domain' | 'default';

export interface TenantRequestContext {
    tenantId: TenantId;
    config: TenantConfig;
    domains: TenantDomainName[];
    isDefault: TenantDefaultFlag;
    source: TenantResolutionSource;
    themeArtifact?: BrandingArtifactMetadata | null;
}

declare global {
    namespace Express {
        interface Request {
            tenant?: TenantRequestContext;
        }
    }
}

export {};
