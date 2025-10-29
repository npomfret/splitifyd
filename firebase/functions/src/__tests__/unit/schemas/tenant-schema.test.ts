import { toTenantDefaultFlag, toTenantDomainName } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { TenantDocumentSchema } from '../../../schemas/tenant';

describe('TenantDocumentSchema', () => {
    const validTenantData = {
        id: 'test-tenant-123',
        branding: {
            appName: 'Acme App',
            logoUrl: 'https://acme.com/logo.svg',
            faviconUrl: 'https://acme.com/favicon.ico',
            primaryColor: '#FF5733',
            secondaryColor: '#33FF57',
        },
        features: {
            enableAdvancedReporting: true,
            enableMultiCurrency: false,
            enableCustomFields: true,
            maxGroupsPerUser: 50,
            maxUsersPerGroup: 100,
        },
        domains: {
            primary: 'app.acme.com',
            aliases: ['acme.com', 'www.acme.com'],
            normalized: ['app.acme.com', 'acme.com', 'www.acme.com'],
        },
        defaultTenant: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    describe('valid documents', () => {
        it('should validate a complete tenant document', () => {
            const result = TenantDocumentSchema.parse(validTenantData);

            expect(result.id).toBe('test-tenant-123');
            expect(result.branding.appName).toBe('Acme App');
            expect(result.features.enableAdvancedReporting).toBe(true);
        });

        it('should apply branded type transformers', () => {
            const result = TenantDocumentSchema.parse(validTenantData);

            expect(result.id).toBe('test-tenant-123');
            expect(result.domains.primary).toBe('app.acme.com');
            expect(result.defaultTenant).toBe(false);
        });

        it('should normalize domains', () => {
            const dataWithMixedCase = {
                ...validTenantData,
                domains: {
                    primary: 'APP.ACME.COM',
                    aliases: ['ACME.COM'],
                    normalized: ['APP.ACME.COM', 'ACME.COM'],
                },
            };

            const result = TenantDocumentSchema.parse(dataWithMixedCase);

            expect(result.domains.primary).toBe('app.acme.com');
            expect(result.domains.aliases).toContain('acme.com');
        });

        it('should strip ports from domains', () => {
            const dataWithPorts = {
                ...validTenantData,
                domains: {
                    primary: 'app.acme.com:8080',
                    aliases: ['acme.com:443'],
                    normalized: ['app.acme.com:8080', 'acme.com:443'],
                },
            };

            const result = TenantDocumentSchema.parse(dataWithPorts);

            expect(result.domains.primary).toBe('app.acme.com');
            expect(result.domains.aliases[0]).toBe('acme.com');
        });

        it('should handle forwarded host format', () => {
            const dataWithForwarded = {
                ...validTenantData,
                domains: {
                    primary: 'app.acme.com, proxy.internal',
                    aliases: [],
                    normalized: ['app.acme.com'],
                },
            };

            const result = TenantDocumentSchema.parse(dataWithForwarded);

            expect(result.domains.primary).toBe('app.acme.com');
        });
    });

    describe('optional fields', () => {
        it('should accept tenant without optional branding fields', () => {
            const minimalData = {
                id: 'minimal-tenant',
                branding: {
                    appName: 'Minimal App',
                    logoUrl: 'https://minimal.com/logo.svg',
                    faviconUrl: 'https://minimal.com/favicon.ico',
                    primaryColor: '#000000',
                    secondaryColor: '#FFFFFF',
                    // No accentColor, themePalette, customCSS, marketingFlags
                },
                features: {
                    enableAdvancedReporting: false,
                    enableMultiCurrency: false,
                    enableCustomFields: false,
                    maxGroupsPerUser: 10,
                    maxUsersPerGroup: 20,
                },
                domains: {
                    primary: 'minimal.com',
                    aliases: [],
                    normalized: ['minimal.com'],
                },
                // No defaultTenant
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const result = TenantDocumentSchema.parse(minimalData);

            expect(result.branding.accentColor).toBeUndefined();
            expect(result.branding.themePalette).toBeUndefined();
            expect(result.branding.customCSS).toBeUndefined();
            expect(result.branding.marketingFlags).toBeUndefined();
            expect(result.defaultTenant).toBeUndefined();
        });

        it('should accept optional marketing flags', () => {
            const dataWithFlags = {
                ...validTenantData,
                branding: {
                    ...validTenantData.branding,
                    marketingFlags: {
                        showLandingPage: true,
                        showPricingPage: false,
                        showBlogPage: true,
                    },
                },
            };

            const result = TenantDocumentSchema.parse(dataWithFlags);

            expect(result.branding.marketingFlags?.showLandingPage).toBe(true);
            expect(result.branding.marketingFlags?.showPricingPage).toBe(false);
            expect(result.branding.marketingFlags?.showBlogPage).toBe(true);
        });

        it('should accept empty domain arrays', () => {
            const dataWithEmptyArrays = {
                ...validTenantData,
                domains: {
                    primary: 'solo.com',
                    aliases: [],
                    normalized: [],
                },
            };

            const result = TenantDocumentSchema.parse(dataWithEmptyArrays);

            expect(result.domains.aliases).toEqual([]);
            expect(result.domains.normalized).toEqual([]);
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

        it('should reject tenant without features', () => {
            const { features, ...dataWithoutFeatures } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutFeatures)).toThrow();
        });

        it('should reject tenant without domains', () => {
            const { domains, ...dataWithoutDomains } = validTenantData;

            expect(() => TenantDocumentSchema.parse(dataWithoutDomains)).toThrow();
        });

        it('should reject tenant without primary domain', () => {
            const { primary, ...domainsWithoutPrimary } = validTenantData.domains;
            const dataWithIncompleteDomains = {
                ...validTenantData,
                domains: domainsWithoutPrimary,
            };

            expect(() => TenantDocumentSchema.parse(dataWithIncompleteDomains)).toThrow();
        });
    });

    describe('type validation', () => {
        it('should reject non-boolean feature flags', () => {
            const dataWithInvalidFlag = {
                ...validTenantData,
                features: {
                    ...validTenantData.features,
                    enableAdvancedReporting: 'yes', // Should be boolean
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithInvalidFlag)).toThrow();
        });

        it('should reject non-numeric feature limits', () => {
            const dataWithInvalidLimit = {
                ...validTenantData,
                features: {
                    ...validTenantData.features,
                    maxGroupsPerUser: '50', // Should be number
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithInvalidLimit)).toThrow();
        });

        it('should reject negative feature limits', () => {
            const dataWithNegativeLimit = {
                ...validTenantData,
                features: {
                    ...validTenantData.features,
                    maxGroupsPerUser: -10,
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithNegativeLimit)).toThrow();
        });

        it('should reject non-array domain aliases', () => {
            const dataWithInvalidAliases = {
                ...validTenantData,
                domains: {
                    ...validTenantData.domains,
                    aliases: 'not-an-array',
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithInvalidAliases)).toThrow();
        });

        it('should reject empty string URLs', () => {
            const dataWithEmptyUrl = {
                ...validTenantData,
                branding: {
                    ...validTenantData.branding,
                    logoUrl: '',
                },
            };

            expect(() => TenantDocumentSchema.parse(dataWithEmptyUrl)).toThrow();
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
