import type { TenantConfig, TenantDefaultFlag, TenantDomainName, TenantId } from '@splitifyd/shared';

export type TenantResolutionSource = 'domain' | 'override' | 'default';

export interface TenantRequestContext {
    tenantId: TenantId;
    config: TenantConfig;
    domains: TenantDomainName[];
    primaryDomain: TenantDomainName | null;
    isDefault: TenantDefaultFlag;
    source: TenantResolutionSource;
}

declare global {
    namespace Express {
        interface Request {
            tenant?: TenantRequestContext;
        }
    }
}

export {};
