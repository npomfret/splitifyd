import { toTenantDefaultFlag, toTenantDomainName } from '@billsplit-wl/shared';
import type { TenantDomainName, TenantFullRecord } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/test-support';

export class TenantFullRecordBuilder {
    private record: Partial<TenantFullRecord> = {};

    constructor(tenantId?: string) {
        this.record.tenant = new TenantConfigBuilder(tenantId).build();
        this.record.domains = [toTenantDomainName('app.example.com'), toTenantDomainName('example.com')];
        this.record.isDefault = toTenantDefaultFlag(false);
    }

    withTenantConfig(config: TenantConfigBuilder): this {
        this.record.tenant = config.build();
        return this;
    }

    withDomains(domains: Array<TenantDomainName | string>): this {
        this.record.domains = domains.map(d => toTenantDomainName(d));
        return this;
    }

    asDefault(): this {
        this.record.isDefault = toTenantDefaultFlag(true);
        return this;
    }

    asNonDefault(): this {
        this.record.isDefault = toTenantDefaultFlag(false);
        return this;
    }

    build(): TenantFullRecord {
        return this.record as TenantFullRecord;
    }
}
