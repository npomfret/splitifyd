import { TenantDomainName, TenantFullRecord, TenantId, toTenantDomainName } from '@billsplit-wl/shared';
import { logger } from '../../logger';
import type { TenantRequestContext } from '../../types/tenant';
import { Errors } from '../../errors';
import { ErrorDetail } from '../../errors';
import type { IFirestoreReader } from '../firestore';

export interface TenantResolutionOptions {
    host?: string | null;
}

interface CacheEntry {
    record: TenantFullRecord;
    expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 1 * 1000; // 1 second for quick updates during development
const DEFAULT_CACHE_KEY = '__default__';

export class TenantRegistryService {
    private readonly cacheByTenantId = new Map<string, CacheEntry>();
    private readonly cacheByDomain = new Map<string, CacheEntry>();

    constructor(private readonly firestoreReader: IFirestoreReader, private readonly cacheTtlMs: number = DEFAULT_CACHE_TTL_MS) {}

    async resolveTenant(options: TenantResolutionOptions): Promise<TenantRequestContext> {
        const { host } = options;

        logger.info('TenantRegistryService.resolveTenant', { host });

        if (host) {
            const normalizedHost = this.normalizeHost(host);
            logger.info('Normalized host', { host, normalizedHost });
            const record = await this.getByDomain(normalizedHost);
            if (record) {
                logger.info('Resolved tenant by domain', { tenantId: record.tenant.tenantId, domain: normalizedHost });
                return this.toResolution(record, 'domain');
            }
            logger.info('No tenant found for domain', { domain: normalizedHost });
        }

        logger.info('Attempting to get default tenant');
        const record = await this.getDefaultTenant();
        if (record) {
            logger.info('Resolved to default tenant', { tenantId: record.tenant.tenantId });
            return this.toResolution(record, 'default');
        }

        throw Errors.notFound('Tenant', ErrorDetail.TENANT_NOT_FOUND);
    }

    async getTenantById(tenantId: TenantId): Promise<TenantRequestContext> {
        logger.info('TenantRegistryService.getTenantById', { tenantId });

        const record = await this.loadTenantByIdInternal(tenantId);
        if (record) {
            logger.info('Found tenant by ID', { tenantId: record.tenant.tenantId });
            return this.toResolution(record, 'domain');
        }

        throw Errors.notFound('Tenant', ErrorDetail.TENANT_NOT_FOUND, tenantId as unknown as string);
    }

    clearCache(): void {
        this.cacheByTenantId.clear();
        this.cacheByDomain.clear();
    }

    private loadTenantByIdInternal(tenantId: TenantId): Promise<TenantFullRecord | null> {
        const cacheKey = tenantId as unknown as string;
        const cached = this.getFromCache(this.cacheByTenantId, cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        return this.loadTenantByIdFromDb(cacheKey, tenantId);
    }

    private async loadTenantByIdFromDb(cacheKey: string, tenantId: TenantId): Promise<TenantFullRecord | null> {
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

    private getByDomain(domain: TenantDomainName): Promise<TenantFullRecord | null> {
        const cacheKey = domain as unknown as string;
        const cached = this.getFromCache(this.cacheByDomain, cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }
        return this.loadTenantByDomain(cacheKey, domain);
    }

    private async loadTenantByDomain(cacheKey: string, domain: TenantDomainName): Promise<TenantFullRecord | null> {
        try {
            logger.info('Loading tenant by domain from Firestore', { domain });
            const record = await this.firestoreReader.getTenantByDomain(domain);
            if (!record) {
                logger.info('No tenant found in Firestore for domain', { domain });
                return null;
            }
            logger.info('Found tenant in Firestore', { domain, tenantId: record.tenant.tenantId, domains: record.domains });
            this.storeRecord(record.tenant.tenantId as unknown as string, record);
            this.indexDomains(record);
            return record;
        } catch (error) {
            logger.error('tenant-registry:getByDomain failed', error, { domain });
            throw error;
        }
    }

    private async getDefaultTenant(): Promise<TenantFullRecord | null> {
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

            logger.warn('No default tenant configured in Firestore');
            return null;
        } catch (error) {
            logger.error('tenant-registry:getDefaultTenant failed', error);
            throw error;
        }
    }

    private getFromCache(map: Map<string, CacheEntry>, key: string): TenantFullRecord | null {
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

    private storeRecord(key: string, record: TenantFullRecord): void {
        const expiresAt = Date.now() + this.cacheTtlMs;
        this.cacheByTenantId.set(key, { record, expiresAt });
        const canonicalKey = record.tenant.tenantId as unknown as string;
        this.cacheByTenantId.set(canonicalKey, { record, expiresAt });
    }

    private indexDomains(record: TenantFullRecord): void {
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

    private toResolution(record: TenantFullRecord, source: 'domain' | 'default'): TenantRequestContext {
        return {
            tenantId: record.tenant.tenantId,
            config: record.tenant,
            domains: record.domains,
            isDefault: record.isDefault,
            source,
            themeArtifact: record.brandingTokens?.artifact ?? null,
        };
    }
}
