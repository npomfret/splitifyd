import {
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@splitifyd/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getFirestore } from '../../../firebase';
import { createFirestoreDatabase } from '../../../firestore-wrapper';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import type { TenantRegistryRecord } from '../../../services/firestore';

describe('Tenant Firestore Integration', () => {
    const wrappedDb = createFirestoreDatabase(getFirestore());
    const firestoreReader = new FirestoreReader(wrappedDb);
    const firestoreWriter = new FirestoreWriter(wrappedDb);

    const timestamp = Date.now();
    const testTenantId = `test-tenant-${timestamp}`;
    const defaultTenantId = `default-tenant-${timestamp}`;
    const testDomain = `test-${timestamp}.example.com`;
    const testAliasDomain = `test-alias-${timestamp}.example.com`;
    const defaultDomain = `default-${timestamp}.example.com`;

    beforeAll(async () => {
        // Create test tenant using FirestoreWriter API (not direct DB access)
        await firestoreWriter.upsertTenant(testTenantId, {
            branding: {
                appName: toTenantAppName('Test Tenant App'),
                logoUrl: toTenantLogoUrl(`https://${testDomain}/logo.svg`),
                faviconUrl: toTenantFaviconUrl(`https://${testDomain}/favicon.ico`),
                primaryColor: toTenantPrimaryColor('#FF5733'),
                secondaryColor: toTenantSecondaryColor('#33FF57'),
            },
            domains: {
                primary: toTenantDomainName(testDomain),
                aliases: [toTenantDomainName(testAliasDomain)],
                normalized: [toTenantDomainName(testDomain), toTenantDomainName(testAliasDomain)],
            },
            defaultTenant: toTenantDefaultFlag(false),
        });

        // Create a second default tenant for testing default transfer
        // This will automatically transfer default flag from existing default tenant
        await firestoreWriter.upsertTenant(defaultTenantId, {
            branding: {
                appName: toTenantAppName('Default App'),
                logoUrl: toTenantLogoUrl(`https://${defaultDomain}/logo.svg`),
                faviconUrl: toTenantFaviconUrl(`https://${defaultDomain}/favicon.ico`),
                primaryColor: toTenantPrimaryColor('#1a73e8'),
                secondaryColor: toTenantSecondaryColor('#34a853'),
            },
            domains: {
                primary: toTenantDomainName(defaultDomain),
                aliases: [],
                normalized: [toTenantDomainName(defaultDomain)],
            },
            defaultTenant: toTenantDefaultFlag(true),
        });
    });

    afterAll(async () => {
        // Transfer default flag back to the real default tenant
        // This ensures subsequent tests have a proper default tenant
        // No direct database deletes - if we can't delete tenants in production, we shouldn't in tests
        await firestoreWriter.upsertTenant('default-tenant', {
            branding: {
                appName: toTenantAppName('Splitifyd'),
                logoUrl: toTenantLogoUrl('/logo.svg'),
                faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#3B82F6'),
                secondaryColor: toTenantSecondaryColor('#8B5CF6'),
            },
            domains: {
                primary: toTenantDomainName('localhost'),
                aliases: [],
                normalized: [toTenantDomainName('localhost')],
            },
            defaultTenant: toTenantDefaultFlag(true),
        });

        // Test tenants remain in the emulator - they use timestamped IDs so won't conflict
        // This matches production reality: tenants are never deleted, only deactivated
    });

    describe('getTenantById', () => {
        it('should retrieve tenant by ID', async () => {
            const result = await firestoreReader.getTenantById(toTenantId(testTenantId));

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(testTenantId);
            expect(result?.tenant.branding.appName).toBe('Test Tenant App');
        });

        it('should return null for non-existent tenant', async () => {
            const result = await firestoreReader.getTenantById(toTenantId('nonexistent-tenant'));

            expect(result).toBeNull();
        });

        it('should parse domain arrays correctly', async () => {
            const result = await firestoreReader.getTenantById(toTenantId(testTenantId));

            expect(result).not.toBeNull();
            expect(result?.domains).toContain(toTenantDomainName(testDomain));
            expect(result?.domains).toContain(toTenantDomainName(testAliasDomain));
            expect(result?.primaryDomain).toBe(toTenantDomainName(testDomain));
        });

        it('should convert Timestamps to ISO strings in config', async () => {
            const result = await firestoreReader.getTenantById(toTenantId(testTenantId));

            expect(result).not.toBeNull();
            expect(typeof result?.tenant.createdAt).toBe('string');
            expect(typeof result?.tenant.updatedAt).toBe('string');
            expect(result?.tenant.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('getTenantByDomain', () => {
        it('should retrieve tenant by primary domain', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName(testDomain));

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(testTenantId);
            expect(result?.primaryDomain).toBe(toTenantDomainName(testDomain));
        });

        it('should retrieve tenant by alias domain', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName(testAliasDomain));

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(testTenantId);
        });

        it('should return null for unknown domain', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName(`unknown-${timestamp}.example.com`));

            expect(result).toBeNull();
        });

        it('should handle normalized domain lookups', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName(testDomain));

            expect(result).not.toBeNull();
            expect(result?.domains).toHaveLength(2);
        });
    });

    describe('getDefaultTenant', () => {
        it('should retrieve the default tenant', async () => {
            const result = await firestoreReader.getDefaultTenant();

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(defaultTenantId);
            expect(result?.isDefault).toBe(true);
            expect(result?.tenant.branding.appName).toBe('Default App');
        });

        it('should return tenant with correct structure', async () => {
            const result = await firestoreReader.getDefaultTenant();

            expect(result).not.toBeNull();
            assertTenantRegistryRecordStructure(result!);
        });
    });
});

// Helper function to assert TenantRegistryRecord structure
function assertTenantRegistryRecordStructure(record: TenantRegistryRecord): void {
    expect(record).toHaveProperty('tenant');
    expect(record).toHaveProperty('primaryDomain');
    expect(record).toHaveProperty('domains');
    expect(record).toHaveProperty('isDefault');

    expect(record.tenant).toHaveProperty('tenantId');
    expect(record.tenant).toHaveProperty('branding');
    expect(record.tenant).toHaveProperty('createdAt');
    expect(record.tenant).toHaveProperty('updatedAt');

    expect(record.tenant.branding).toHaveProperty('appName');
    expect(record.tenant.branding).toHaveProperty('logoUrl');
    expect(record.tenant.branding).toHaveProperty('faviconUrl');
    expect(record.tenant.branding).toHaveProperty('primaryColor');
    expect(record.tenant.branding).toHaveProperty('secondaryColor');

    expect(Array.isArray(record.domains)).toBe(true);
    expect(typeof record.isDefault).toBe('boolean');
}

describe('Tenant Branding Updates', () => {
    const wrappedDb = createFirestoreDatabase(getFirestore());
    const firestoreReader = new FirestoreReader(wrappedDb);
    const firestoreWriter = new FirestoreWriter(wrappedDb);

    const timestamp = Date.now();
    const updateTestTenantId = `update-test-tenant-${timestamp}`;
    const updateTestDomain = `update-test-${timestamp}.example.com`;

    beforeAll(async () => {
        // Create a test tenant for branding updates using API
        await firestoreWriter.upsertTenant(updateTestTenantId, {
            branding: {
                appName: toTenantAppName('Original App Name'),
                logoUrl: toTenantLogoUrl(`https://${updateTestDomain}/logo.svg`),
                faviconUrl: toTenantFaviconUrl(`https://${updateTestDomain}/favicon.ico`),
                primaryColor: toTenantPrimaryColor('#000000'),
                secondaryColor: toTenantSecondaryColor('#FFFFFF'),
            },
            domains: {
                primary: toTenantDomainName(updateTestDomain),
                aliases: [],
                normalized: [toTenantDomainName(updateTestDomain)],
            },
            defaultTenant: toTenantDefaultFlag(false),
        });
    });

    afterAll(async () => {
        // No cleanup - tenant remains in emulator (matches production reality)
    });

    it('should update single branding field', async () => {
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            appName: toTenantAppName('Updated App Name'),
        });

        expect(result.success).toBe(true);

        // Verify the update persisted
        const tenant = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        expect(tenant?.tenant.branding.appName).toBe('Updated App Name');
        expect(tenant?.tenant.branding.logoUrl).toBe(`https://${updateTestDomain}/logo.svg`); // Unchanged
    });

    it('should update multiple branding fields', async () => {
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            primaryColor: toTenantPrimaryColor('#FF0000'),
            secondaryColor: toTenantSecondaryColor('#00FF00'),
        });

        expect(result.success).toBe(true);

        // Verify the updates persisted
        const tenant = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        expect(tenant?.tenant.branding.primaryColor).toBe('#FF0000');
        expect(tenant?.tenant.branding.secondaryColor).toBe('#00FF00');
    });

    it('should update marketing flags', async () => {
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            marketingFlags: {
                showLandingPage: toShowLandingPageFlag(true),
                showPricingPage: toShowPricingPageFlag(false),
            },
        });

        expect(result.success).toBe(true);

        // Verify the updates persisted
        const tenant = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        expect(tenant?.tenant.branding.marketingFlags?.showLandingPage).toBe(true);
        expect(tenant?.tenant.branding.marketingFlags?.showPricingPage).toBe(false);
    });

    it('should update partial marketing flags without affecting other flags', async () => {
        // First set all flags
        await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            marketingFlags: {
                showLandingPage: toShowLandingPageFlag(true),
                showMarketingContent: toShowMarketingContentFlag(true),
                showPricingPage: toShowPricingPageFlag(true),
            },
        });

        // Then update only one flag
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            marketingFlags: {
                showLandingPage: toShowLandingPageFlag(false),
            },
        });

        expect(result.success).toBe(true);

        // Verify only the specified flag changed
        const tenant = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        expect(tenant?.tenant.branding.marketingFlags?.showLandingPage).toBe(false);
        expect(tenant?.tenant.branding.marketingFlags?.showMarketingContent).toBe(true); // Unchanged
        expect(tenant?.tenant.branding.marketingFlags?.showPricingPage).toBe(true); // Unchanged
    });

    it('should update updatedAt timestamp', async () => {
        const beforeUpdate = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        const beforeTimestamp = beforeUpdate?.tenant.updatedAt;

        // Wait a bit to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            appName: toTenantAppName('Timestamp Test'),
        });

        const afterUpdate = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        const afterTimestamp = afterUpdate?.tenant.updatedAt;

        expect(afterTimestamp).not.toBe(beforeTimestamp);
    });

    it('should handle non-existent tenant gracefully', async () => {
        const result = await firestoreWriter.updateTenantBranding('non-existent-tenant', {
            appName: toTenantAppName('Should Fail'),
        });

        // updateTenantBranding will return success=false on error
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
