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
import { AdminTenantRequestBuilder } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getAuth, getFirestore } from '../../../firebase';

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
            .withDomains([toTenantDomainName(`${tenantId}.example.com`)])
            .build();

        await apiDriver.adminUpsertTenant(tenantData, adminUser.token);
    };

    it('should reject request without tenant ID', async () => {
        try {
            await apiDriver.publishTenantTheme({} as any, adminUser.token);
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
            const result = await apiDriver.publishTenantTheme({ tenantId }, idToken);
            throw new Error(`Expected request to be rejected but it succeeded with result: ${JSON.stringify(result)}`);
        } catch (error: any) {
            // Should be rejected - accepting 401/403 status codes
            // The key is that a non-admin user cannot publish themes
            expect([401, 403]).toContain(error.status);
            expect(['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_TOKEN']).toContain(error.response.error.code);
        }
    });

    it('should preserve brandingTokens.artifact when upserting tenant', async () => {
        const tenantId = `tenant_preserve_artifact_${Date.now()}`;

        // Step 1: Create tenant with tokens
        await createTenantWithTokens(tenantId);

        // Step 2: Publish theme (adds brandingTokens.artifact)
        const publishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);
        expect(publishResult.artifact).toBeDefined();
        expect(publishResult.artifact.cssUrl).toBeDefined();
        expect(publishResult.artifact.hash).toBeDefined();

        const originalArtifact = publishResult.artifact;

        // Step 3: Upsert tenant again with different branding (simulating config update)
        const updatedTenantData = AdminTenantRequestBuilder
            .forTenant(tenantId)
            .withBranding({
                appName: toTenantAppName('Updated Theme Tenant'),
                logoUrl: toTenantLogoUrl('https://foo/branding/updated/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://foo/branding/updated/favicon.png'),
                primaryColor: toTenantPrimaryColor('#dc2626'),
                secondaryColor: toTenantSecondaryColor('#ea580c'),
                accentColor: toTenantAccentColor('#16a34a'),
                themePalette: toTenantThemePaletteName('default'),
            })
            .withBrandingTokens({ tokens: mockTokens })
            .withDomains([toTenantDomainName(`${tenantId}.example.com`)])
            .build();

        await apiDriver.adminUpsertTenant(updatedTenantData, adminUser.token);

        // Step 4: Read tenant from Firestore and verify artifact is preserved
        const tenantDoc = await db.collection(FirestoreCollections.TENANTS).doc(tenantId).get();
        const tenantData = tenantDoc.data();

        expect(tenantData).toBeDefined();
        expect(tenantData?.branding?.appName).toBe('Updated Theme Tenant');
        expect(tenantData?.brandingTokens?.artifact).toBeDefined();
        expect(tenantData?.brandingTokens?.artifact?.cssUrl).toBe(originalArtifact.cssUrl);
        expect(tenantData?.brandingTokens?.artifact?.hash).toBe(originalArtifact.hash);
        expect(tenantData?.brandingTokens?.artifact?.version).toBe(originalArtifact.version);
    });
});
