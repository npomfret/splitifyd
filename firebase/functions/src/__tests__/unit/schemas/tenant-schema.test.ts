import { BrandingTokensBuilder } from '@billsplit-wl/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { TenantDocumentSchema, UpdateTenantBrandingRequestSchema } from '../../../schemas/tenant';

describe('TenantDocumentSchema', () => {
    const validBrandingTokens = new BrandingTokensBuilder()
        .withPrimaryColor('#FF5733')
        .withSecondaryColor('#33FF57')
        .withLogoUrl('https://acme.com/logo.svg')
        .build();
    // Override legal.appName for test
    validBrandingTokens.legal.appName = 'Acme App';
    validBrandingTokens.assets.faviconUrl = 'https://acme.com/favicon.ico';

    const validTenantData = {
        id: 'test-tenant-123',
        branding: {
            primaryColor: '#FF5733',
            secondaryColor: '#33FF57',
        },
        brandingTokens: {
            tokens: validBrandingTokens,
        },
        domains: ['app.acme.com', 'acme.com', 'www.acme.com'],
        defaultTenant: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    describe('valid documents', () => {
        it('should validate a complete tenant document', () => {
            const result = TenantDocumentSchema.parse(validTenantData);

            expect(result.id).toBe('test-tenant-123');
            expect(result.brandingTokens.tokens.legal.appName).toBe('Acme App');
        });

        it('should apply branded type transformers', () => {
            const result = TenantDocumentSchema.parse(validTenantData);

            expect(result.id).toBe('test-tenant-123');
            expect(result.domains[0]).toBe('app.acme.com');
            expect(result.defaultTenant).toBe(false);
        });

        it('should normalize domains', () => {
            const dataWithMixedCase = {
                ...validTenantData,
                domains: ['APP.ACME.COM', 'ACME.COM'],
            };

            const result = TenantDocumentSchema.parse(dataWithMixedCase);

            expect(result.domains[0]).toBe('app.acme.com');
            expect(result.domains).toContain('acme.com');
        });

        it('should strip ports from domains', () => {
            const dataWithPorts = {
                ...validTenantData,
                domains: ['app.acme.com:8080', 'acme.com:443'],
            };

            const result = TenantDocumentSchema.parse(dataWithPorts);

            expect(result.domains[0]).toBe('app.acme.com');
            expect(result.domains[1]).toBe('acme.com');
        });

        it('should handle forwarded host format', () => {
            const dataWithForwarded = {
                ...validTenantData,
                domains: ['app.acme.com, proxy.internal'],
            };

            const result = TenantDocumentSchema.parse(dataWithForwarded);

            expect(result.domains[0]).toBe('app.acme.com');
        });
    });

    describe('optional fields', () => {
        it('should accept tenant without optional branding fields', () => {
            const minimalBrandingTokens = new BrandingTokensBuilder()
                .withPrimaryColor('#000000')
                .withSecondaryColor('#FFFFFF')
                .build();
            minimalBrandingTokens.legal.appName = 'Minimal App';

            const minimalData = {
                id: 'minimal-tenant',
                branding: {
                    primaryColor: '#000000',
                    secondaryColor: '#FFFFFF',
                    // No accentColor
                },
                brandingTokens: {
                    tokens: minimalBrandingTokens,
                },
                domains: ['minimal.com'],
                // No defaultTenant or marketingFlags
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const result = TenantDocumentSchema.parse(minimalData);

            expect(result.branding.accentColor).toBeUndefined();
            expect(result.marketingFlags).toBeUndefined();
            expect(result.defaultTenant).toBeUndefined();
        });

        it('should accept optional marketing flags at top level', () => {
            const dataWithFlags = {
                ...validTenantData,
                marketingFlags: {
                    showMarketingContent: true,
                    showPricingPage: false,
                },
            };

            const result = TenantDocumentSchema.parse(dataWithFlags);

            expect(result.marketingFlags?.showMarketingContent).toBe(true);
            expect(result.marketingFlags?.showPricingPage).toBe(false);
        });

        it('should accept single domain', () => {
            const dataWithSingleDomain = {
                ...validTenantData,
                domains: ['solo.com'],
            };

            const result = TenantDocumentSchema.parse(dataWithSingleDomain);

            expect(result.domains).toEqual(['solo.com']);
            expect(result.domains.length).toBe(1);
        });
    });

    describe('required field validation', () => {
        it('should reject tenant without id', () => {
            const { id, ...dataWithoutId } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutId)).toThrow();
        });

        it('should reject tenant with empty id', () => {
            const dataWithEmptyId = {
                ...validTenantData,
                id: '',
            };

            expect(() => TenantDocumentSchema.parse(dataWithEmptyId)).toThrow();
        });

        it('should reject tenant without branding', () => {
            const { branding, ...dataWithoutBranding } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutBranding)).toThrow();
        });

        it('should reject branding without required color fields', () => {
            const { primaryColor, ...brandingWithoutPrimary } = validTenantData.branding;
            const dataWithIncompleteBranding = {
                ...validTenantData,
                branding: brandingWithoutPrimary,
            };

            expect(() => TenantDocumentSchema.parse(dataWithIncompleteBranding)).toThrow();
        });

        it('should reject tenant without domains', () => {
            const { domains, ...dataWithoutDomains } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutDomains)).toThrow();
        });

        it('should reject tenant with empty domains array', () => {
            const dataWithEmptyDomains = {
                ...validTenantData,
                domains: [],
            };

            expect(() => TenantDocumentSchema.parse(dataWithEmptyDomains)).toThrow();
        });
    });

    describe('type validation', () => {
        it('should reject non-array domains', () => {
            const dataWithInvalidDomains = {
                ...validTenantData,
                domains: 'not-an-array',
            };

            expect(() => TenantDocumentSchema.parse(dataWithInvalidDomains)).toThrow();
        });

        it('should reject empty string colors', () => {
            const dataWithEmptyColor = {
                ...validTenantData,
                branding: {
                    ...validTenantData.branding,
                    primaryColor: '',
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithEmptyColor)).toThrow();
        });
    });

    describe('strict mode', () => {
        it('should reject documents with extra fields at top level', () => {
            const dataWithExtraFields = {
                ...validTenantData,
                unexpectedField: 'should fail',
            };

            expect(() => TenantDocumentSchema.parse(dataWithExtraFields)).toThrow();
        });
    });

    describe('audit fields', () => {
        it('should require createdAt and updatedAt', () => {
            const { createdAt, ...dataWithoutCreatedAt } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutCreatedAt)).toThrow();

            const { updatedAt, ...dataWithoutUpdatedAt } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutUpdatedAt)).toThrow();
        });

        it('should accept Timestamp objects for audit fields', () => {
            const dataWithTimestamps = {
                ...validTenantData,
                createdAt: Timestamp.fromDate(new Date('2025-01-01T00:00:00.000Z')),
                updatedAt: Timestamp.fromDate(new Date('2025-01-15T12:00:00.000Z')),
            };

            const result = TenantDocumentSchema.parse(dataWithTimestamps);

            expect(result.createdAt).toBeInstanceOf(Timestamp);
            expect(result.updatedAt).toBeInstanceOf(Timestamp);
        });
    });
});

describe('UpdateTenantBrandingRequestSchema', () => {
    describe('valid updates', () => {
        it('should validate complete branding update with all fields', () => {
            const updateData = {
                appName: 'Updated App',
                logoUrl: 'https://updated.com/logo.svg',
                faviconUrl: 'https://updated.com/favicon.ico',
                primaryColor: '#112233',
                secondaryColor: '#445566',
                accentColor: '#778899',
                marketingFlags: {
                    showMarketingContent: true,
                    showPricingPage: false,
                },
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            expect(result.appName).toBe('Updated App');
            expect(result.primaryColor).toBe('#112233');
            expect(result.marketingFlags?.showMarketingContent).toBe(true);
        });

        it('should validate partial branding update with single field', () => {
            const updateData = {
                appName: 'New Name',
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            expect(result.appName).toBe('New Name');
            expect(result.logoUrl).toBeUndefined();
            expect(result.primaryColor).toBeUndefined();
        });

        it('should validate partial branding update with colors only', () => {
            const updateData = {
                primaryColor: '#FF0000',
                secondaryColor: '#00FF00',
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            expect(result.primaryColor).toBe('#FF0000');
            expect(result.secondaryColor).toBe('#00FF00');
            expect(result.appName).toBeUndefined();
        });

        it('should validate partial marketing flags update', () => {
            const updateData = {
                marketingFlags: {
                    showPricingPage: true,
                },
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            expect(result.marketingFlags?.showPricingPage).toBe(true);
            expect(result.marketingFlags?.showMarketingContent).toBeUndefined();
        });

        it('should validate empty object (no updates)', () => {
            const updateData = {};

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            expect(Object.keys(result).length).toBe(0);
        });
    });

    describe('validation errors', () => {
        it('should reject empty string for required fields when provided', () => {
            const updateData = {
                appName: '',
            };

            expect(() => UpdateTenantBrandingRequestSchema.parse(updateData)).toThrow();
        });

        it('should reject empty string for URLs', () => {
            const updateData = {
                logoUrl: '',
            };

            expect(() => UpdateTenantBrandingRequestSchema.parse(updateData)).toThrow();
        });

        it('should reject empty string for colors', () => {
            const updateData = {
                primaryColor: '',
            };

            expect(() => UpdateTenantBrandingRequestSchema.parse(updateData)).toThrow();
        });

        it('should reject non-boolean marketing flags', () => {
            const updateData = {
                marketingFlags: {
                    showPricingPage: 'yes',
                },
            };

            expect(() => UpdateTenantBrandingRequestSchema.parse(updateData as any)).toThrow();
        });

        it('should reject extra fields in strict mode', () => {
            const updateData = {
                appName: 'Valid',
                unexpectedField: 'should fail',
            };

            expect(() => UpdateTenantBrandingRequestSchema.parse(updateData)).toThrow();
        });

        it('should allow partial marketing flags (partial schema)', () => {
            // Marketing flags use .partial() so all fields are optional
            // This is intentional to allow incremental updates
            const updateData = {
                marketingFlags: {
                    showPricingPage: true,
                    // Other flags can be omitted
                },
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);
            expect(result.marketingFlags?.showPricingPage).toBe(true);
        });
    });

    describe('type transformations', () => {
        it('should apply branded type transformers to all fields', () => {
            const updateData = {
                appName: 'Branded App',
                logoUrl: 'https://brand.com/logo.svg',
                faviconUrl: 'https://brand.com/favicon.ico',
                primaryColor: '#AABBCC',
                secondaryColor: '#DDEEFF',
            };

            const result = UpdateTenantBrandingRequestSchema.parse(updateData);

            // Branded types should be applied (validated by transformer functions)
            expect(result.appName).toBe('Branded App');
            expect(result.logoUrl).toBe('https://brand.com/logo.svg');
            expect(result.primaryColor).toBe('#AABBCC');
        });
    });
});
