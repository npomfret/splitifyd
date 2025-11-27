import type { BrandingTokens, PooledTestUser } from '@billsplit-wl/shared';
import { toTenantAccentColor, toTenantAppName, toTenantFaviconUrl, toTenantLogoUrl, toTenantPrimaryColor, toTenantSecondaryColor, toTenantThemePaletteName } from '@billsplit-wl/shared';
import { ApiDriver, getFirebaseEmulatorConfig } from '@billsplit-wl/test-support';
import { AdminTenantRequestBuilder } from '@billsplit-wl/test-support';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirestoreCollections } from '../../../constants';
import { getFirestore } from '../../../firebase';

/**
 * Creates a complete, valid BrandingTokens object for testing.
 * This is test-only data - ALL production theming data comes from Firestore via TenantEditorModal.
 */
function createTestBrandingTokens(): BrandingTokens {
    return {
        version: 1,
        palette: {
            primary: '#3b82f6',
            primaryVariant: '#2563eb',
            secondary: '#8b5cf6',
            secondaryVariant: '#7c3aed',
            accent: '#f97316',
            neutral: '#ffffff',
            neutralVariant: '#f3f4f6',
            success: '#22c55e',
            warning: '#eab308',
            danger: '#ef4444',
            info: '#0ea5e9',
        },
        typography: {
            fontFamily: {
                sans: 'system-ui, sans-serif',
                serif: 'Georgia, serif',
                mono: 'monospace',
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
                tight: '-0.02rem',
                normal: '0rem',
                wide: '0.02rem',
            },
            semantics: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
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
            none: '0px',
            sm: '4px',
            md: '8px',
            lg: '12px',
            pill: '9999px',
            full: '9999px',
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
                    raised: '#f9fafb',
                    sunken: '#f3f4f6',
                    overlay: 'rgba(0, 0, 0, 0.5)',
                    warning: '#fef3c7',
                    muted: '#f3f4f6',
                },
                text: {
                    primary: '#111827',
                    secondary: '#4b5563',
                    muted: '#9ca3af',
                    inverted: '#ffffff',
                    accent: '#f97316',
                },
                interactive: {
                    primary: '#3b82f6',
                    primaryHover: '#2563eb',
                    primaryActive: '#1d4ed8',
                    primaryForeground: '#ffffff',
                    secondary: '#8b5cf6',
                    secondaryHover: '#7c3aed',
                    secondaryActive: '#6d28d9',
                    secondaryForeground: '#ffffff',
                    accent: '#f97316',
                    destructive: '#ef4444',
                    destructiveHover: '#dc2626',
                    destructiveActive: '#b91c1c',
                    destructiveForeground: '#ffffff',
                },
                border: {
                    subtle: '#e5e7eb',
                    default: '#d1d5db',
                    strong: '#9ca3af',
                    focus: '#3b82f6',
                    warning: '#eab308',
                },
                status: {
                    success: '#22c55e',
                    warning: '#eab308',
                    danger: '#ef4444',
                    info: '#0ea5e9',
                },
            },
            spacing: {
                pagePadding: '1.5rem',
                sectionGap: '2rem',
                cardPadding: '1.5rem',
                componentGap: '1rem',
            },
            typography: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
            },
        },
        motion: {
            duration: {
                instant: 50,
                fast: 150,
                base: 250,
                slow: 400,
                glacial: 600,
            },
            easing: {
                standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
                decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
                accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
                spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            },
        },
    };
}

const buildTenantPayload = (tenantId: string) => {
    const tokens = createTestBrandingTokens();
    return AdminTenantRequestBuilder
        .forTenant(tenantId)
        .withBranding({
            appName: toTenantAppName('Theming Test Tenant'),
            logoUrl: toTenantLogoUrl(tokens.assets.logoUrl),
            faviconUrl: toTenantFaviconUrl(tokens.assets.faviconUrl || 'https://example.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor(tokens.palette.primary),
            secondaryColor: toTenantSecondaryColor(tokens.palette.secondary),
            accentColor: toTenantAccentColor(tokens.palette.accent),
            themePalette: toTenantThemePaletteName('default'),
        })
        .withBrandingTokens({ tokens })
        .withDomains([`${tenantId}.local.test`])
        .build();
};

describe('Theme CSS delivery', () => {
    const apiDriver = new ApiDriver();
    let adminUser: PooledTestUser;

    beforeAll(async () => {
        adminUser = await apiDriver.getDefaultAdminUser();
    });

    it('serves published CSS for a tenant', async () => {
        const tenantId = `tenant_theme_${Date.now()}`;
        const payload = buildTenantPayload(tenantId);

        await apiDriver.adminUpsertTenant(payload, adminUser.token);
        const publishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);

        const tenantDoc = await getFirestore().collection(FirestoreCollections.TENANTS).doc(tenantId).get();
        expect(tenantDoc.data()?.brandingTokens?.artifact?.hash).toBe(publishResult.artifact.hash);

        let response;
        try {
            response = await apiDriver.fetchThemeCss({
                tenantId,
                version: publishResult.artifact.hash,
            });
        } catch (error: any) {
            console.error('theme-css-response-body', error.body);
            throw error;
        }

        expect(response.status).toBe(200);
        expect(response.css).toContain('--palette-primary');
        expect(response.headers.get('cache-control')).toContain('max-age=31536000');
        expect(response.headers.get('etag')).toContain(publishResult.artifact.hash);
    });

    it('serves CSS via the Firebase Hosting rewrite', async () => {
        const tenantId = `tenant_hosting_${Date.now()}`;
        const payload = buildTenantPayload(tenantId);

        await apiDriver.adminUpsertTenant(payload, adminUser.token);
        const publishResult = await apiDriver.publishTenantTheme({ tenantId }, adminUser.token);

        const emulatorConfig = getFirebaseEmulatorConfig();
        const hostingDriver = new ApiDriver();
        hostingDriver.overrideBaseUrl(`http://localhost:${emulatorConfig.hostingPort}/api`);

        const response = await hostingDriver.fetchThemeCss({
            tenantId,
            version: publishResult.artifact.hash,
        });

        expect(response.status).toBe(200);
        expect(response.css).toContain('--palette-primary');
        expect(response.headers.get('content-type')).toContain('text/css');
    });
});
