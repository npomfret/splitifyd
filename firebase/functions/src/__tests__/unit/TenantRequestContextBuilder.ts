import { toTenantDefaultFlag, toTenantDomainName, toTenantId } from '@billsplit-wl/shared';
import type { TenantDomainName, TenantId } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/test-support';
import type { TenantRequestContext } from '../../types/tenant';

export class TenantRequestContextBuilder {
    private context: Partial<TenantRequestContext> = {};

    constructor(tenantId?: string) {
        this.context.tenantId = toTenantId(tenantId || 'test-tenant');
        this.context.config = new TenantConfigBuilder(tenantId).build();
        this.context.domains = [toTenantDomainName('app.example.com')];
        this.context.isDefault = toTenantDefaultFlag(false);
        this.context.source = 'domain';
    }

    withTenantId(tenantId: TenantId | string): this {
        this.context.tenantId = toTenantId(tenantId);
        return this;
    }

    withConfig(config: TenantConfigBuilder): this {
        this.context.config = config.build();
        return this;
    }

    withDomains(domains: Array<TenantDomainName | string>): this {
        this.context.domains = domains.map(d => toTenantDomainName(d));
        return this;
    }

    asDefault(): this {
        this.context.isDefault = toTenantDefaultFlag(true);
        return this;
    }

    withSource(source: 'domain' | 'override' | 'default'): this {
        this.context.source = source;
        return this;
    }

    build(): TenantRequestContext {
        return this.context as TenantRequestContext;
    }
}
