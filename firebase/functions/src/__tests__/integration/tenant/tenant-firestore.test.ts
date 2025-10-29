import {
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
} from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';
import type { TenantDocument } from '../../../schemas/tenant';
import { FirestoreReader } from '../../../services/firestore/FirestoreReader';
import type { TenantRegistryRecord } from '../../../services/firestore/IFirestoreReader';
import { createFirestoreDatabase } from '../../../firestore-wrapper';

describe('Tenant Firestore Integration', () => {
    const db = getFirestore();
    const firestoreReader = new FirestoreReader(createFirestoreDatabase(db));

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
                secondaryColor: toTenantSecondaryColor('#33FF57'),
            },
            features: {
                enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
                enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                enableCustomFields: toFeatureToggleCustomFields(true),
                maxGroupsPerUser: toTenantMaxGroupsPerUser(25),
                maxUsersPerGroup: toTenantMaxUsersPerGroup(50),
            },
            domains: {
                primary: toTenantDomainName('test.example.com'),
                aliases: [toTenantDomainName('test-alias.example.com')],
                normalized: [toTenantDomainName('test.example.com'), toTenantDomainName('test-alias.example.com')],
            },
            defaultTenant: toTenantDefaultFlag(false),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        await db.collection(FirestoreCollections.TENANTS).doc(testTenantId).set(testTenantDoc);

        // Create default tenant document
        const defaultTenantDoc: Omit<TenantDocument, 'id'> = {
            branding: {
                appName: toTenantAppName('Default App'),
                logoUrl: toTenantLogoUrl('https://default.example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://default.example.com/favicon.ico'),
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
            domains: {
                primary: toTenantDomainName('default.example.com'),
                aliases: [],
                normalized: [toTenantDomainName('default.example.com')],
            },
            defaultTenant: toTenantDefaultFlag(true),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
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
            expect(result?.tenant.features.enableAdvancedReporting).toBe(true);
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
                    secondaryColor: toTenantSecondaryColor('#FFFFFF'),
                },
                features: {
                    enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
                    enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                    enableCustomFields: toFeatureToggleCustomFields(false),
                    maxGroupsPerUser: toTenantMaxGroupsPerUser(10),
                    maxUsersPerGroup: toTenantMaxUsersPerGroup(10),
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
                updatedAt: Timestamp.now(),
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
                features: {
                    enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
                    enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                    enableCustomFields: toFeatureToggleCustomFields(false),
                    maxGroupsPerUser: toTenantMaxGroupsPerUser(5),
                    maxUsersPerGroup: toTenantMaxUsersPerGroup(5),
                },
                domains: {
                    primary: toTenantDomainName('minimal.example.com'),
                    aliases: [],
                    normalized: [toTenantDomainName('minimal.example.com')],
                },
                // No defaultTenant field (optional)
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
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
    expect(record.tenant).toHaveProperty('features');
    expect(record.tenant).toHaveProperty('createdAt');
    expect(record.tenant).toHaveProperty('updatedAt');

    expect(record.tenant.branding).toHaveProperty('appName');
    expect(record.tenant.branding).toHaveProperty('logoUrl');
    expect(record.tenant.branding).toHaveProperty('faviconUrl');
    expect(record.tenant.branding).toHaveProperty('primaryColor');
    expect(record.tenant.branding).toHaveProperty('secondaryColor');

    expect(record.tenant.features).toHaveProperty('enableAdvancedReporting');
    expect(record.tenant.features).toHaveProperty('enableMultiCurrency');
    expect(record.tenant.features).toHaveProperty('enableCustomFields');
    expect(record.tenant.features).toHaveProperty('maxGroupsPerUser');
    expect(record.tenant.features).toHaveProperty('maxUsersPerGroup');

    expect(Array.isArray(record.domains)).toBe(true);
    expect(typeof record.isDefault).toBe('boolean');
}
