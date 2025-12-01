import type { BrandingArtifactMetadata, TenantConfig, TenantDefaultFlag, TenantDomainName, TenantId } from '@billsplit-wl/shared';
import { TenantConfigBuilder, toTenantDefaultFlag, toTenantDomainName, toTenantId } from '@billsplit-wl/shared';

type TenantResolutionSource = 'domain' | 'default';

export interface TenantRequestContext {
    tenantId: TenantId;
    config: TenantConfig;
    domains: TenantDomainName[];
    isDefault: TenantDefaultFlag;
    source: TenantResolutionSource;
    themeArtifact?: BrandingArtifactMetadata | null;
}

export class TenantRequestContextBuilder {
    private context: TenantRequestContext;

    constructor() {
        const config = new TenantConfigBuilder().build();
        this.context = {
            tenantId: config.tenantId,
            config,
            domains: [],
            isDefault: toTenantDefaultFlag(false),
            source: 'domain',
        };
    }

    withTenantId(tenantId: TenantId | string): this {
        this.context.tenantId = toTenantId(tenantId);
        return this;
    }

    withConfig(config: TenantConfig): this {
        this.context.config = config;
        this.context.tenantId = config.tenantId;
        return this;
    }

    withDomains(domains: (TenantDomainName | string)[]): this {
        this.context.domains = domains.map((d) => toTenantDomainName(d));
        return this;
    }

    withIsDefault(isDefault: boolean): this {
        this.context.isDefault = toTenantDefaultFlag(isDefault);
        return this;
    }

    withSource(source: TenantResolutionSource): this {
        this.context.source = source;
        return this;
    }

    withThemeArtifact(artifact: BrandingArtifactMetadata | null): this {
        this.context.themeArtifact = artifact;
        return this;
    }

    build(): TenantRequestContext {
        return { ...this.context };
    }
}
