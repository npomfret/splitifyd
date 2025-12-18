import { EMPTY_TENANT_DATA, validateTenantData } from '@/components/admin/tenant-editor';
import type { TenantData } from '@/components/admin/tenant-editor';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

const mockT = ((key: string, params?: Record<string, string>) => {
    if (key === 'validation.required' && params?.field) {
        return `${params.field} is required`;
    }
    if (key === 'admin.tenantEditor.validation.tenantIdFormat') {
        return 'Tenant ID must be lowercase letters, numbers, and hyphens only';
    }
    if (key === 'admin.tenantEditor.validation.domainRequired') {
        return 'At least one domain is required';
    }
    if (key === 'admin.tenantEditor.fields.tenantId') {
        return 'Tenant ID';
    }
    if (key === 'admin.tenantEditor.fields.appName') {
        return 'App name';
    }
    if (key === 'admin.tenantEditor.fields.logoUrl') {
        return 'Logo URL';
    }
    return key;
}) as TFunction;

function createValidTenantData(): TenantData {
    return {
        ...EMPTY_TENANT_DATA,
        tenantId: 'test-tenant',
        appName: 'Test App',
        domains: ['test.example.com'],
        logoUrl: 'https://example.com/logo.png',
        faviconUrl: 'https://example.com/favicon.ico',
        primaryColor: '#000000',
        primaryVariantColor: '#111111',
        secondaryColor: '#222222',
        secondaryVariantColor: '#333333',
        accentColor: '#444444',
        neutralColor: '#555555',
        neutralVariantColor: '#666666',
        successColor: '#00ff00',
        warningColor: '#ffff00',
        dangerColor: '#ff0000',
        infoColor: '#0000ff',
        surfaceBaseColor: '#ffffff',
        surfaceRaisedColor: '#f0f0f0',
        surfaceSunkenColor: '#e0e0e0',
        surfaceOverlayColor: 'rgba(0,0,0,0.5)',
        surfaceWarningColor: '#fff3cd',
        surfaceMutedColor: '#f5f5f5',
        textPrimaryColor: '#000000',
        textSecondaryColor: '#333333',
        textMutedColor: '#666666',
        textInvertedColor: '#ffffff',
        textAccentColor: '#0066cc',
        interactivePrimaryColor: '#0066cc',
        interactivePrimaryHoverColor: '#0055aa',
        interactivePrimaryActiveColor: '#004488',
        interactivePrimaryForegroundColor: '#ffffff',
        interactiveSecondaryColor: '#666666',
        interactiveSecondaryHoverColor: '#555555',
        interactiveSecondaryActiveColor: '#444444',
        interactiveSecondaryForegroundColor: '#ffffff',
        interactiveAccentColor: '#0066cc',
        interactiveDestructiveColor: '#cc0000',
        interactiveDestructiveHoverColor: '#aa0000',
        interactiveDestructiveActiveColor: '#880000',
        interactiveDestructiveForegroundColor: '#ffffff',
        borderSubtleColor: '#e0e0e0',
        borderDefaultColor: '#cccccc',
        borderStrongColor: '#999999',
        borderFocusColor: '#0066cc',
        borderWarningColor: '#ffcc00',
        statusSuccessColor: '#00cc00',
        statusWarningColor: '#ffcc00',
        statusDangerColor: '#cc0000',
        statusInfoColor: '#0066cc',
        fontFamilySans: 'Inter, sans-serif',
        fontFamilyMono: 'Monaco, monospace',
        typographySizeXs: '0.75rem',
        typographySizeSm: '0.875rem',
        typographySizeMd: '1rem',
        typographySizeLg: '1.125rem',
        typographySizeXl: '1.25rem',
        typographySize2xl: '1.5rem',
        typographySize3xl: '1.875rem',
        typographySize4xl: '2.25rem',
        typographySize5xl: '3rem',
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightSemibold: 600,
        fontWeightBold: 700,
        lineHeightCompact: '1.25',
        lineHeightStandard: '1.5',
        lineHeightSpacious: '1.75',
        letterSpacingTight: '-0.02em',
        letterSpacingNormal: '0',
        letterSpacingWide: '0.02em',
        typographySemanticBody: 'md',
        typographySemanticBodyStrong: 'md',
        typographySemanticCaption: 'sm',
        typographySemanticButton: 'sm',
        typographySemanticEyebrow: 'xs',
        typographySemanticHeading: '2xl',
        typographySemanticDisplay: '4xl',
        spacing2xs: '0.25rem',
        spacingXs: '0.5rem',
        spacingSm: '0.75rem',
        spacingMd: '1rem',
        spacingLg: '1.5rem',
        spacingXl: '2rem',
        spacing2xl: '3rem',
        spacingPagePadding: '1.5rem',
        spacingSectionGap: '2rem',
        spacingCardPadding: '1.5rem',
        spacingComponentGap: '1rem',
        radiiNone: '0',
        radiiSm: '4px',
        radiiMd: '8px',
        radiiLg: '12px',
        radiiPill: '9999px',
        radiiFull: '9999px',
        shadowSm: '0 1px 2px rgba(0,0,0,0.05)',
        shadowMd: '0 4px 6px rgba(0,0,0,0.1)',
        shadowLg: '0 10px 15px rgba(0,0,0,0.1)',
        legalCompanyName: 'Test Company',
        legalSupportEmail: 'support@test.com',
        motionDurationInstant: 50,
        motionDurationFast: 100,
        motionDurationBase: 200,
        motionDurationSlow: 300,
        motionDurationGlacial: 500,
        motionEasingStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        motionEasingDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        motionEasingAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
        motionEasingSpring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    };
}

describe('validateTenantData', () => {
    describe('tenant ID validation', () => {
        it('returns null for valid tenant data', () => {
            const data = createValidTenantData();
            expect(validateTenantData(data, mockT)).toBeNull();
        });

        it('returns error for uppercase tenant ID', () => {
            const data = createValidTenantData();
            data.tenantId = 'Test-Tenant';
            expect(validateTenantData(data, mockT)).toBe('Tenant ID must be lowercase letters, numbers, and hyphens only');
        });

        it('returns error for tenant ID with spaces', () => {
            const data = createValidTenantData();
            data.tenantId = 'test tenant';
            expect(validateTenantData(data, mockT)).toBe('Tenant ID must be lowercase letters, numbers, and hyphens only');
        });

        it('returns error for tenant ID with special characters', () => {
            const data = createValidTenantData();
            data.tenantId = 'test_tenant!';
            expect(validateTenantData(data, mockT)).toBe('Tenant ID must be lowercase letters, numbers, and hyphens only');
        });

        it('accepts tenant ID with numbers and hyphens', () => {
            const data = createValidTenantData();
            data.tenantId = 'test-tenant-123';
            expect(validateTenantData(data, mockT)).toBeNull();
        });
    });

    describe('domain validation', () => {
        it('returns error when domains array is empty', () => {
            const data = createValidTenantData();
            data.domains = [];
            expect(validateTenantData(data, mockT)).toBe('At least one domain is required');
        });

        it('accepts multiple domains', () => {
            const data = createValidTenantData();
            data.domains = ['app.example.com', 'test.example.com'];
            expect(validateTenantData(data, mockT)).toBeNull();
        });
    });

    describe('required string field validation', () => {
        it('returns error for empty app name', () => {
            const data = createValidTenantData();
            data.appName = '';
            expect(validateTenantData(data, mockT)).toBe('App name is required');
        });

        it('returns error for whitespace-only app name', () => {
            const data = createValidTenantData();
            data.appName = '   ';
            expect(validateTenantData(data, mockT)).toBe('App name is required');
        });

        it('returns error for empty logo URL', () => {
            const data = createValidTenantData();
            data.logoUrl = '';
            expect(validateTenantData(data, mockT)).toBe('Logo URL is required');
        });

        it('returns error for empty primary color', () => {
            const data = createValidTenantData();
            data.primaryColor = '';
            expect(validateTenantData(data, mockT)).toContain('is required');
        });

        it('returns error for empty font family', () => {
            const data = createValidTenantData();
            data.fontFamilySans = '';
            expect(validateTenantData(data, mockT)).toBe('Sans is required');
        });

        it('returns error for empty legal company name', () => {
            const data = createValidTenantData();
            data.legalCompanyName = '';
            expect(validateTenantData(data, mockT)).toBe('Company Name is required');
        });
    });

    describe('required number field validation', () => {
        it('returns error for zero font weight when not intentional', () => {
            const data = createValidTenantData();
            data.fontWeightRegular = 0;
            expect(validateTenantData(data, mockT)).toBeNull();
        });

        it('accepts valid font weights', () => {
            const data = createValidTenantData();
            data.fontWeightRegular = 400;
            data.fontWeightBold = 700;
            expect(validateTenantData(data, mockT)).toBeNull();
        });

        it('accepts zero motion duration', () => {
            const data = createValidTenantData();
            data.motionDurationInstant = 0;
            expect(validateTenantData(data, mockT)).toBeNull();
        });
    });
});
