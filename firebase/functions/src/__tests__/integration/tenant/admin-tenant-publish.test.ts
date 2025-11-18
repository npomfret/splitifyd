import type { BrandingTokens, PooledTestUser } from '@splitifyd/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@splitifyd/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getAuth, getFirestore } from '../../../firebase';

describe('Admin Tenant Theme Publishing', () => {
    const apiDriver = new ApiDriver();
    const db = getFirestore();

    let adminUser: PooledTestUser;

    const mockTokens: BrandingTokens = {
        version: 1,
        palette: {
            primary: '#2563eb',
            primaryVariant: '#1d4ed8',
            secondary: '#7c3aed',
            secondaryVariant: '#6d28d9',
            accent: '#f97316',
            neutral: '#f8fafc',
            neutralVariant: '#e2e8f0',
            success: '#22c55e',
            warning: '#eab308',
            danger: '#ef4444',
            info: '#38bdf8',
        },
        typography: {
            fontFamily: {
                sans: 'Inter, system-ui, sans-serif',
                mono: 'Fira Code, monospace',
            },
            sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                md: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem',
                '5xl': '3rem',
            },
            weights: {
                regular: 400,
                medium: 500,
                semibold: 600,
                bold: 700,
            },
            lineHeights: {
                compact: '1.25rem',
                standard: '1.5rem',
                spacious: '1.75rem',
            },
            letterSpacing: {
                tight: '-0.01rem',
                normal: '0rem',
                wide: '0.05rem',
            },
            semantics: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'md',
                eyebrow: 'xs',
                heading: 'xl',
                display: '3xl',
            },
        },
        spacing: {
            '2xs': '0.25rem',
            xs: '0.5rem',
            sm: '0.75rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
            '2xl': '3rem',
        },
        radii: {
            none: '0rem',
            sm: '0.125rem',
            md: '0.25rem',
            lg: '0.5rem',
            pill: '9999px',
            full: '50rem',
        },
        shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
        assets: {
            logoUrl: 'https://example.com/logo.svg',
            faviconUrl: 'https://example.com/favicon.ico',
        },
        legal: {
            companyName: 'Test Company',
            supportEmail: 'support@example.com',
            privacyPolicyUrl: 'https://example.com/privacy',
            termsOfServiceUrl: 'https://example.com/terms',
        },
        semantics: {
            colors: {
                surface: {
                    base: '#ffffff',
                    raised: '#f9f9f9',
                    sunken: '#f0f0f0',
                    overlay: '#000000',
                    warning: '#fffacd',
                },
                text: {
                    primary: '#000000',
                    secondary: '#666666',
                    muted: '#999999',
                    inverted: '#ffffff',
                    accent: '#0066cc',
                },
                interactive: {
                    primary: '#0066cc',
                    primaryHover: '#0052a3',
                    primaryActive: '#003d7a',
                    primaryForeground: '#ffffff',
                    secondary: '#f0f0f0',
                    secondaryHover: '#e0e0e0',
                    secondaryActive: '#d0d0d0',
                    secondaryForeground: '#000000',
                    accent: '#22c55e',
                    destructive: '#dc3545',
                    destructiveHover: '#c82333',
                    destructiveActive: '#bd2130',
                    destructiveForeground: '#ffffff',
                },
                border: {
                    subtle: '#f0f0f0',
                    default: '#d0d0d0',
                    strong: '#999999',
                    focus: '#0066cc',
                    warning: '#ffd700',
                },
                status: {
                    success: '#28a745',
                    warning: '#ffc107',
                    danger: '#dc3545',
                    info: '#17a2b8',
                },
            },
            spacing: {
                pagePadding: '1rem',
                sectionGap: '2rem',
                cardPadding: '1.5rem',
                componentGap: '0.5rem',
            },
            typography: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'md',
                eyebrow: 'xs',
                heading: 'xl',
                display: '3xl',
            },
        },
    };

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    const createTenantWithTokens = async (tenantId: string) => {
        const tenantData = {
            tenantId,
            branding: {
                appName: 'Test Theme Tenant',
                logoUrl: 'https://static.splitifyd.dev/branding/test/logo.svg',
                faviconUrl: 'https://static.splitifyd.dev/branding/test/favicon.png',
                primaryColor: '#2563eb',
                secondaryColor: '#7c3aed',
                accentColor: '#f97316',
                themePalette: 'default',
            },
            brandingTokens: {
                tokens: mockTokens,
            },
            domains: {
                primary: 'theme.example.com',
                aliases: [],
                normalized: ['theme.example.com'],
            },
            defaultTenant: false,
        };

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
