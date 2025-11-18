
import { toTenantId, toTenantDomainName } from '@billsplit-wl/shared';
import type { TenantId, TenantDomainName } from '@billsplit-wl/shared';
import type { TenantSettingsResponse } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from './TenantConfigBuilder';

export class TenantSettingsResponseBuilder {
    private response: Partial<TenantSettingsResponse> = {};

    constructor(tenantId?: string) {
        this.response.tenantId = toTenantId(tenantId || 'test-tenant');
        this.response.config = new TenantConfigBuilder(tenantId).build();
        this.response.domains = [toTenantDomainName('localhost')];
        this.response.primaryDomain = toTenantDomainName('localhost');
    }

    withTenantId(tenantId: TenantId | string): this {
        this.response.tenantId = toTenantId(tenantId);
        return this;
    }

    withConfig(config: TenantConfigBuilder): this {
        this.response.config = config.build();
        return this;
    }

    withDomains(domains: Array<TenantDomainName | string>): this {
        this.response.domains = domains.map(d => toTenantDomainName(d));
        return this;
    }

    withPrimaryDomain(domain: TenantDomainName | string): this {
        this.response.primaryDomain = toTenantDomainName(domain);
        return this;
    }

    build(): TenantSettingsResponse {
        return this.response as TenantSettingsResponse;
    }
}
