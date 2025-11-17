import {toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,} from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';
import type { TenantDocument } from '../../../schemas/tenant';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import type { TenantRegistryRecord } from '../../../services/firestore';
import { createFirestoreDatabase } from '../../../firestore-wrapper';

describe('Tenant Firestore Integration', () => {
    const db = getFirestore();
    const wrappedDb = createFirestoreDatabase(db);
    const firestoreReader = new FirestoreReader(wrappedDb);
    const firestoreWriter = new FirestoreWriter(wrappedDb);

    const testTenantId = `test-tenant-${Date.now()}`;
    const defaultTenantId = `default-tenant-${Date.now()}`;

    beforeAll(async () => {
        // Clean up any existing default tenants from Firestore for this test
        const existingDefaultSnapshot = await db
            .collection(FirestoreCollections.TENANTS)
            .where('defaultTenant', '==', true)
            .get();

        for (const doc of existingDefaultSnapshot.docs) {
            await doc.ref.delete();
        }

        // Create test tenant document
        const testTenantDoc: Omit<TenantDocument, 'id'> = {
            branding: {
                appName: toTenantAppName('Test Tenant App'),
                logoUrl: toTenantLogoUrl('https://test.example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://test.example.com/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#FF5733'),
                secondaryColor: toTenantSecondaryColor('#33FF57')
},
            domains: {
                primary: toTenantDomainName('test.example.com'),
                aliases: [toTenantDomainName('test-alias.example.com')],
                normalized: [toTenantDomainName('test.example.com'), toTenantDomainName('test-alias.example.com')]
},
            defaultTenant: toTenantDefaultFlag(false),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
};

        await db.collection(FirestoreCollections.TENANTS).doc(testTenantId).set(testTenantDoc);

        // Create default tenant document
        const defaultTenantDoc: Omit<TenantDocument, 'id'> = {
            branding: {
                appName: toTenantAppName('Default App'),
                logoUrl: toTenantLogoUrl('https://default.example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://default.example.com/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#1a73e8'),
                secondaryColor: toTenantSecondaryColor('#34a853')
},
            domains: {
                primary: toTenantDomainName('default.example.com'),
                aliases: [],
                normalized: [toTenantDomainName('default.example.com')]
},
            defaultTenant: toTenantDefaultFlag(true),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
};

        await db.collection(FirestoreCollections.TENANTS).doc(defaultTenantId).set(defaultTenantDoc);
    });

    afterAll(async () => {
        // Clean up test data
        await db.collection(FirestoreCollections.TENANTS).doc(testTenantId).delete();
        await db.collection(FirestoreCollections.TENANTS).doc(defaultTenantId).delete();
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
            expect(result?.domains).toContain(toTenantDomainName('test.example.com'));
            expect(result?.domains).toContain(toTenantDomainName('test-alias.example.com'));
            expect(result?.primaryDomain).toBe(toTenantDomainName('test.example.com'));
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
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName('test.example.com'));

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(testTenantId);
            expect(result?.primaryDomain).toBe(toTenantDomainName('test.example.com'));
        });

        it('should retrieve tenant by alias domain', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName('test-alias.example.com'));

            expect(result).not.toBeNull();
            expect(result?.tenant.tenantId).toBe(testTenantId);
        });

        it('should return null for unknown domain', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName('unknown.example.com'));

            expect(result).toBeNull();
        });

        it('should handle normalized domain lookups', async () => {
            const result = await firestoreReader.getTenantByDomain(toTenantDomainName('test.example.com'));

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

    describe('domain deduplication', () => {
        it('should deduplicate domains in normalized array', async () => {
            const tenantWithDupes = `tenant-with-dupes-${Date.now()}`;

            const dupeDoc: Omit<TenantDocument, 'id'> = {
                branding: {
                    appName: toTenantAppName('Dupe Test'),
                    logoUrl: toTenantLogoUrl('https://dupe.example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://dupe.example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#FFFFFF')
},
                domains: {
                    primary: toTenantDomainName('dupe.example.com'),
                    aliases: [toTenantDomainName('dupe.example.com')], // Duplicate!
                    normalized: [
                        toTenantDomainName('dupe.example.com'),
                        toTenantDomainName('dupe.example.com'),
                        toTenantDomainName('dupe.example.com'),
                    ], // Triplicates!
                },
                defaultTenant: toTenantDefaultFlag(false),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
};

            await db.collection(FirestoreCollections.TENANTS).doc(tenantWithDupes).set(dupeDoc);

            const result = await firestoreReader.getTenantById(toTenantId(tenantWithDupes));

            expect(result).not.toBeNull();
            expect(result?.domains).toHaveLength(1); // Should deduplicate to single domain
            expect(result?.domains[0]).toBe(toTenantDomainName('dupe.example.com'));

            // Cleanup
            await db.collection(FirestoreCollections.TENANTS).doc(tenantWithDupes).delete();
        });
    });

    describe('optional fields', () => {
        it('should handle tenant without optional branding fields', async () => {
            const minimalTenantId = `minimal-tenant-${Date.now()}`;

            const minimalDoc: Omit<TenantDocument, 'id'> = {
                branding: {
                    appName: toTenantAppName('Minimal App'),
                    logoUrl: toTenantLogoUrl('https://minimal.example.com/logo.svg'),
                    faviconUrl: toTenantFaviconUrl('https://minimal.example.com/favicon.ico'),
                    primaryColor: toTenantPrimaryColor('#000000'),
                    secondaryColor: toTenantSecondaryColor('#FFFFFF'),
                    // No accentColor, themePalette, customCSS, marketingFlags
                },
                domains: {
                    primary: toTenantDomainName('minimal.example.com'),
                    aliases: [],
                    normalized: [toTenantDomainName('minimal.example.com')]
},
                // No defaultTenant field (optional)
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
};

            await db.collection(FirestoreCollections.TENANTS).doc(minimalTenantId).set(minimalDoc);

            const result = await firestoreReader.getTenantById(toTenantId(minimalTenantId));

            expect(result).not.toBeNull();
            expect(result?.tenant.branding.appName).toBe('Minimal App');
            expect(result?.tenant.branding.accentColor).toBeUndefined();
            expect(result?.isDefault).toBe(false); // Should default to false

            // Cleanup
            await db.collection(FirestoreCollections.TENANTS).doc(minimalTenantId).delete();
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
    const db = getFirestore();
    const wrappedDb = createFirestoreDatabase(db);
    const firestoreReader = new FirestoreReader(wrappedDb);
    const firestoreWriter = new FirestoreWriter(wrappedDb);

    const updateTestTenantId = `update-test-tenant-${Date.now()}`;

    beforeAll(async () => {
        // Create a test tenant for branding updates
        const tenantDoc: Omit<TenantDocument, 'id'> = {
            branding: {
                appName: toTenantAppName('Original App Name'),
                logoUrl: toTenantLogoUrl('https://original.example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://original.example.com/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#000000'),
                secondaryColor: toTenantSecondaryColor('#FFFFFF')
},
            domains: {
                primary: toTenantDomainName('update-test.example.com'),
                aliases: [],
                normalized: [toTenantDomainName('update-test.example.com')]
},
            defaultTenant: toTenantDefaultFlag(false),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
};

        await db.collection(FirestoreCollections.TENANTS).doc(updateTestTenantId).set(tenantDoc);
    });

    afterAll(async () => {
        // Clean up test tenant
        await db.collection(FirestoreCollections.TENANTS).doc(updateTestTenantId).delete();
    });

    it('should update single branding field', async () => {
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            appName: toTenantAppName('Updated App Name')
});

        expect(result.success).toBe(true);

        // Verify the update persisted
        const tenant = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        expect(tenant?.tenant.branding.appName).toBe('Updated App Name');
        expect(tenant?.tenant.branding.logoUrl).toBe('https://original.example.com/logo.svg'); // Unchanged
    });

    it('should update multiple branding fields', async () => {
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            primaryColor: toTenantPrimaryColor('#FF0000'),
            secondaryColor: toTenantSecondaryColor('#00FF00')
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
                showPricingPage: toShowPricingPageFlag(false)
}
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
                showPricingPage: toShowPricingPageFlag(true)
}
});

        // Then update only one flag
        const result = await firestoreWriter.updateTenantBranding(updateTestTenantId, {
            marketingFlags: {
                showLandingPage: toShowLandingPageFlag(false)
}
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
            appName: toTenantAppName('Timestamp Test')
});

        const afterUpdate = await firestoreReader.getTenantById(toTenantId(updateTestTenantId));
        const afterTimestamp = afterUpdate?.tenant.updatedAt;

        expect(afterTimestamp).not.toBe(beforeTimestamp);
    });

    it('should handle non-existent tenant gracefully', async () => {
        const result = await firestoreWriter.updateTenantBranding('non-existent-tenant', {
            appName: toTenantAppName('Should Fail')
});

        // updateTenantBranding will return success=false on error
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
