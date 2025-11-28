import type { AddTenantDomainRequest, TenantDomainName } from '@billsplit-wl/shared';
import { toTenantDomainName } from '@billsplit-wl/shared';
import { generateShortId } from '../test-helpers';

export class AddTenantDomainRequestBuilder {
    private request: AddTenantDomainRequest;

    constructor() {
        this.request = {
            domain: toTenantDomainName(`domain-${generateShortId()}.example.com`),
        };
    }

    withDomain(domain: TenantDomainName | string): this {
        this.request.domain = typeof domain === 'string' ? toTenantDomainName(domain) : domain;
        return this;
    }

    build(): AddTenantDomainRequest {
        return { ...this.request };
    }
}
