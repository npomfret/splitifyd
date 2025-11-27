import { TenantConfigBuilder, toTenantDomainName, toTenantId } from '@billsplit-wl/shared';
import type { TenantDomainName, TenantSettingsResponse } from '@billsplit-wl/shared';

export class TenantSettingsResponseBuilder {
    private response: Partial<TenantSettingsResponse> = {};

    constructor(tenantId?: string) {
        this.response.tenantId = toTenantId(tenantId || 'test-tenant');
        this.response.config = new TenantConfigBuilder(tenantId).build();
        this.response.domains = [toTenantDomainName('localhost')];
    }

    withTenantId(tenantId: string): this {
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

    build(): TenantSettingsResponse {
        return this.response as TenantSettingsResponse;
    }
}
