
import type { AdminUpsertTenantRequest } from '@billsplit-wl/shared';
import {
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';

export class AdminUpsertTenantRequestBuilder {
    private payload: Partial<AdminUpsertTenantRequest> = {};

    constructor() {
        // tenantId is passed as a separate parameter to upsertTenant(), not in the request body
    }

    withBranding(branding: Partial<AdminUpsertTenantRequest['branding']>): this {
        this.payload.branding = {
            appName: toTenantAppName('Test App'),
            logoUrl: toTenantLogoUrl(''),
            primaryColor: toTenantPrimaryColor(''),
            secondaryColor: toTenantSecondaryColor(''),
            ...this.payload.branding,
            ...branding,
        };
        return this;
    }

    withDomains(domains: Partial<AdminUpsertTenantRequest['domains']>): this {
        this.payload.domains = {
            primary: toTenantDomainName(''),
            aliases: [],
            normalized: [],
            ...this.payload.domains,
            ...domains,
        };
        return this;
    }

    withDefaultTenant(isDefault: boolean): this {
        this.payload.defaultTenant = toTenantDefaultFlag(isDefault);
        return this;
    }

    build(): AdminUpsertTenantRequest {
        return this.payload as AdminUpsertTenantRequest;
    }
}
