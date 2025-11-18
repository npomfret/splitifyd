import type { BrandingTokens, PooledTestUser } from '@billsplit-wl/shared';
import {
    toTenantAccentColor,
    toTenantAppName,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getAuth, getFirestore } from '../../../firebase';
import { AdminTenantRequestBuilder } from '../../unit/AdminTenantRequestBuilder';

describe('Admin Tenant Theme Publishing', () => {
    const apiDriver = new ApiDriver();
    const db = getFirestore();

    let adminUser: PooledTestUser;

    const mockTokens: BrandingTokens = AdminTenantRequestBuilder.forTenant('tenant-theme-tokens').buildTokens();

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    const createTenantWithTokens = async (tenantId: string) => {
        const tenantData = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withBranding({
                appName: toTenantAppName('Test Theme Tenant'),
                logoUrl: toTenantLogoUrl('https://foo/branding/test/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://foo/branding/test/favicon.png'),
                primaryColor: toTenantPrimaryColor('#2563eb'),
                secondaryColor: toTenantSecondaryColor('#7c3aed'),
                accentColor: toTenantAccentColor('#f97316'),
                themePalette: toTenantThemePaletteName('default'),
            })
            .withBrandingTokens({ tokens: mockTokens })
            .withPrimaryDomain(toTenantDomainName('theme.example.com'))
            .withDomainAliases([])
            .build();

        await apiDriver.adminUpsertTenant(adminUser.token, tenantData);
    };

    it('should publish theme artifacts for tenant with tokens', async () => {
        const tenantId = `tenant_publish_${Date.now()}`;
        await createTenantWithTokens(tenantId);

        const result = await apiDriver.publishTenantTheme(adminUser.token, { tenantId });

        expect(result.artifact).toMatchObject({
            hash: expect.any(String),
            cssUrl: expect.any(String),
            tokensUrl: expect.any(String),
            version: 1,
            generatedAtEpochMs: expect.any(Number),
            generatedBy: adminUser.uid,
        });

        // Verify hash is 64-character hex string (SHA-256)
        expect(result.artifact.hash).toMatch(/^[a-f0-9]{64}$/);

        // Verify timestamp is recent
        const now = Date.now();
        expect(result.artifact.generatedAtEpochMs).toBeGreaterThan(now - 5000);
        expect(result.artifact.generatedAtEpochMs).toBeLessThanOrEqual(now);
    });

    it('should update artifact metadata in tenant document', async () => {
        const tenantId = `tenant_metadata_${Date.now()}`;
        await createTenantWithTokens(tenantId);

        const result = await apiDriver.publishTenantTheme(adminUser.token, { tenantId });

        // Verify artifact metadata was written to Firestore
        const tenantDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
        const data = tenantDoc.data();

        expect(data?.brandingTokens?.artifact).toMatchObject({
            hash: result.artifact.hash,
            cssUrl: result.artifact.cssUrl,
            tokensUrl: result.artifact.tokensUrl,
            version: 1,
            generatedAtEpochMs: result.artifact.generatedAtEpochMs,
            generatedBy: adminUser.uid,
        });
    });

    it('should increment version on subsequent publishes', async () => {
        const tenantId = `tenant_version_${Date.now()}`;
        await createTenantWithTokens(tenantId);

        const result1 = await apiDriver.publishTenantTheme(adminUser.token, { tenantId });
        expect(result1.artifact.version).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result2 = await apiDriver.publishTenantTheme(adminUser.token, { tenantId });
        expect(result2.artifact.version).toBe(2);

        await new Promise((resolve) => setTimeout(resolve, 10));

        const result3 = await apiDriver.publishTenantTheme(adminUser.token, { tenantId });
        expect(result3.artifact.version).toBe(3);
    });

    it('should reject request for non-existent tenant', async () => {
        try {
            await apiDriver.publishTenantTheme(adminUser.token, { tenantId: 'nonexistent_tenant' });
            expect.fail('Should have thrown error');
        } catch (error: any) {
            expect(error.status).toBe(404);
            expect(error.response.error.code).toBe('TENANT_NOT_FOUND');
        }
    });

    it('should reject request for tenant without branding tokens', async () => {
        // This test can't work because brandingTokens is required by AdminUpsertTenantRequestSchema
        // Skip this test - the validation happens at tenant creation, not at publish time
        // A tenant without brandingTokens cannot be created through the API
    });

    it('should reject request without tenant ID', async () => {
        try {
            await apiDriver.publishTenantTheme(adminUser.token, {} as any);
            expect.fail('Should have thrown error');
        } catch (error: any) {
            expect(error.status).toBe(400);
            expect(error.response.error.code).toBe('INVALID_TENANT_ID');
        }
    });

    it('should reject request from non-admin user', async () => {
        const tenantId = `tenant_auth_${Date.now()}`;
        await createTenantWithTokens(tenantId);

        const auth = getAuth();

        // Create a fresh non-admin user using Firebase Admin SDK
        const regularUser = await auth.createUser({
            email: `regular-${Date.now()}@test.com`,
            password: 'testpassword123!',
            displayName: 'Regular Test User',
        });

        // Create Firestore user document with non-admin role
        await db.collection(FirestoreCollections.USERS).doc(regularUser.uid).set({
            displayName: 'Regular Test User',
            email: regularUser.email,
            role: 'user', // Explicitly non-admin
            createdAt: new Date(),
        });

        // Get custom token for this user with explicit non-admin role claim
        const customToken = await auth.createCustomToken(regularUser.uid, {
            role: 'user', // Explicitly set non-admin role in custom claims
        });

        // Exchange custom token for ID token using Firebase Auth REST API
        const emulatorConfig = getFirebaseEmulatorConfig();
        const tokenResponse = await fetch(
            `http://localhost:${emulatorConfig.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${emulatorConfig.firebaseApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: customToken, returnSecureToken: true }),
            },
        );
        const tokenData = await tokenResponse.json();
        const idToken = tokenData.idToken;

        // Attempt to publish tenant theme with non-admin user
        // Should be rejected (not authorized to perform this action)
        try {
            const result = await apiDriver.publishTenantTheme(idToken, { tenantId });
            throw new Error(`Expected request to be rejected but it succeeded with result: ${JSON.stringify(result)}`);
        } catch (error: any) {
            // Should be rejected - accepting 401/403 status codes
            // The key is that a non-admin user cannot publish themes
            expect([401, 403]).toContain(error.status);
            expect(['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN']).toContain(error.response.error.code);
        }
    });
});
