import { toTenantDefaultFlag, toTenantDomainName } from '@billsplit-wl/shared';
import type { TenantDomainName } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/test-support';
import type { TenantRegistryRecord } from '../../services/firestore';

export class TenantRegistryRecordBuilder {
    private record: Partial<TenantRegistryRecord> = {};

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

    build(): TenantRegistryRecord {
        return this.record as TenantRegistryRecord;
    }
}
