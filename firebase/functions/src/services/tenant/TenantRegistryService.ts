import {
    TenantConfig,
    TenantDomainName,
    TenantId,
    TenantDefaultFlag,
    toTenantDomainName,
    toTenantId,
    toTenantAppName,
    toTenantLogoUrl,
    toTenantFaviconUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toFeatureToggleAdvancedReporting,
    toFeatureToggleMultiCurrency,
    toFeatureToggleCustomFields,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
    toTenantDefaultFlag,
    toISOString,
} from '@splitifyd/shared';
import { HTTP_STATUS } from '../../constants';
import { logger } from '../../logger';
import { ApiError } from '../../utils/errors';
import type { TenantRegistryRecord } from '../firestore';
import type { IFirestoreReader } from '../firestore';
import type { TenantRequestContext } from '../../types/tenant';

export interface TenantResolutionOptions {
    host?: string | null;
    overrideTenantId?: string | null;
    allowOverride: boolean;
    allowDefaultFallback: boolean;
}

interface CacheEntry {
    record: TenantRegistryRecord;
    expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_KEY = '__default__';

/**
 * Hardcoded fallback tenant that is always available.
 * This ensures the application can always run even if no tenants are configured in Firestore.
 * Used for development, testing, and as a safety fallback.
 */
export const HARDCODED_FALLBACK_TENANT: TenantRegistryRecord = {
    tenant: {
        tenantId: toTenantId('system-fallback-tenant'),
        branding: {
            appName: toTenantAppName('Splitifyd'),
            logoUrl: toTenantLogoUrl('https://splitifyd.com/logo.svg'),
            faviconUrl: toTenantFaviconUrl('https://splitifyd.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor('#1a73e8'),
            secondaryColor: toTenantSecondaryColor('#34a853'),
        },
        features: {
            enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
            enableMultiCurrency: toFeatureToggleMultiCurrency(true),
            enableCustomFields: toFeatureToggleCustomFields(true),
            maxGroupsPerUser: toTenantMaxGroupsPerUser(100),
            maxUsersPerGroup: toTenantMaxUsersPerGroup(200),
        },
        createdAt: toISOString('2025-01-01T00:00:00.000Z'),
        updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
    },
    primaryDomain: toTenantDomainName('localhost'),
    domains: [toTenantDomainName('localhost'), toTenantDomainName('127.0.0.1')],
    isDefault: toTenantDefaultFlag(true),
};

export class TenantRegistryService {
    private readonly cacheByTenantId = new Map<string, CacheEntry>();
    private readonly cacheByDomain = new Map<string, CacheEntry>();

    constructor(private readonly firestoreReader: IFirestoreReader, private readonly cacheTtlMs: number = DEFAULT_CACHE_TTL_MS) {}

    async resolveTenant(options: TenantResolutionOptions): Promise<TenantRequestContext> {
        const { host, overrideTenantId, allowOverride, allowDefaultFallback } = options;

        if (overrideTenantId) {
            if (!allowOverride) {
                throw new ApiError(HTTP_STATUS.FORBIDDEN, 'TENANT_OVERRIDE_NOT_ALLOWED', 'Tenant override header is not permitted in this environment');
            }
            const tenantId = toTenantId(overrideTenantId);
            const record = await this.getByTenantId(tenantId);
            if (!record) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_OVERRIDE_NOT_FOUND', 'Specified tenant override does not exist');
            }
            return this.toResolution(record, 'override');
        }

        if (host) {
            const normalizedHost = this.normalizeHost(host);
            const record = await this.getByDomain(normalizedHost);
            if (record) {
                return this.toResolution(record, 'domain');
            }
        }

        if (allowDefaultFallback) {
            const record = await this.getDefaultTenant();
            if (record) {
                return this.toResolution(record, 'default');
            }
        }

        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Unable to resolve tenant for request');
    }

    clearCache(): void {
        this.cacheByTenantId.clear();
        this.cacheByDomain.clear();
    }

    private getByTenantId(tenantId: TenantId): Promise<TenantRegistryRecord | null> {
        const cacheKey = tenantId as unknown as string;
        const cached = this.getFromCache(this.cacheByTenantId, cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        return this.loadTenantById(cacheKey, tenantId);
    }

    private async loadTenantById(cacheKey: string, tenantId: TenantId): Promise<TenantRegistryRecord | null> {
        try {
            const record = await this.firestoreReader.getTenantById(tenantId);
            if (!record) {
                return null;
            }
            this.storeRecord(cacheKey, record);
            this.indexDomains(record);
            return record;
        } catch (error) {
            logger.error('tenant-registry:getByTenantId failed', error, { tenantId });
            throw error;
        }
    }

    private getByDomain(domain: TenantDomainName): Promise<TenantRegistryRecord | null> {
        const cacheKey = domain as unknown as string;
        const cached = this.getFromCache(this.cacheByDomain, cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        return this.loadTenantByDomain(cacheKey, domain);
    }

    private async loadTenantByDomain(cacheKey: string, domain: TenantDomainName): Promise<TenantRegistryRecord | null> {
        try {
            const record = await this.firestoreReader.getTenantByDomain(domain);
            if (!record) {
                return null;
            }
            this.storeRecord(record.tenant.tenantId as unknown as string, record);
            this.indexDomains(record);
            return record;
        } catch (error) {
            logger.error('tenant-registry:getByDomain failed', error, { domain });
            throw error;
        }
    }

    private async getDefaultTenant(): Promise<TenantRegistryRecord | null> {
        const cached = this.getFromCache(this.cacheByTenantId, DEFAULT_CACHE_KEY);
        if (cached) {
            return cached;
        }
        try {
            const record = await this.firestoreReader.getDefaultTenant();
            if (record) {
                this.storeRecord(DEFAULT_CACHE_KEY, record);
                this.indexDomains(record);
                return record;
            }

            // If no default tenant found in Firestore, use hardcoded fallback
            logger.info('No default tenant in Firestore, using hardcoded fallback');
            return HARDCODED_FALLBACK_TENANT;
        } catch (error) {
            logger.error('tenant-registry:getDefaultTenant failed, using hardcoded fallback', error);
            return HARDCODED_FALLBACK_TENANT;
        }
    }

    private getFromCache(map: Map<string, CacheEntry>, key: string): TenantRegistryRecord | null {
        const entry = map.get(key);
        if (!entry) {
            return null;
        }
        if (entry.expiresAt <= Date.now()) {
            map.delete(key);
            return null;
        }
        return entry.record;
    }

    private storeRecord(key: string, record: TenantRegistryRecord): void {
        const expiresAt = Date.now() + this.cacheTtlMs;
        this.cacheByTenantId.set(key, { record, expiresAt });
        const canonicalKey = record.tenant.tenantId as unknown as string;
        this.cacheByTenantId.set(canonicalKey, { record, expiresAt });
    }

    private indexDomains(record: TenantRegistryRecord): void {
        const expiresAt = Date.now() + this.cacheTtlMs;
        for (const domain of record.domains) {
            const cacheKey = domain as unknown as string;
            this.cacheByDomain.set(cacheKey, { record, expiresAt });
        }
    }

    private normalizeHost(host: string): TenantDomainName {
        const raw = host.trim().toLowerCase();
        const [first] = raw.split(','); // handle potential multiple forwarded hosts
        const withoutPort = first.trim().replace(/:\d+$/, '');
        return toTenantDomainName(withoutPort);
    }

    private toResolution(record: TenantRegistryRecord, source: 'domain' | 'override' | 'default'): TenantRequestContext {
        return {
            tenantId: record.tenant.tenantId,
            config: record.tenant,
            domains: record.domains,
            primaryDomain: record.primaryDomain,
            isDefault: record.isDefault,
            source,
        };
    }
}
