import { describe, expect, it } from 'vitest';
import {
    ActivityFeedItemSchema,
    ActivityFeedResponseSchema,
    AdminTenantItemSchema,
    AdminTenantsListResponseSchema,
    AdminUserProfileSchema,
    ApiErrorResponseSchema,
    AppConfigurationSchema,
    BalanceDisplaySchema,
    CurrencyBalanceDisplaySchema,
    ExpenseSplitSchema,
    ListAuthUsersResponseSchema,
    SimplifiedDebtSchema,
    TenantDomainsResponseSchema,
    TenantSettingsResponseSchema,
} from '../../index';
import type { TenantBranding } from '../../types/branding';

function createTestBrandingTokens(): TenantBranding {
    return {
        tokens: {
            version: 1,
            palette: {
                primary: '#3B82F6',
                primaryVariant: '#2563eb',
                secondary: '#8B5CF6',
                secondaryVariant: '#7c3aed',
                accent: '#EC4899',
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
                    serif: 'Georgia, serif',
                    mono: 'Menlo, monospace',
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
                    wide: '0.04rem',
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
                '2xs': '0.125rem',
                xs: '0.25rem',
                sm: '0.5rem',
                md: '0.75rem',
                lg: '1rem',
                xl: '1.5rem',
                '2xl': '2rem',
            },
            radii: {
                none: '0px',
                sm: '4px',
                md: '8px',
                lg: '16px',
                pill: '999px',
                full: '9999px',
            },
            shadows: {
                sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
                md: '0 4px 6px rgba(0, 0, 0, 0.1)',
                lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
            },
            assets: {
                logoUrl: '/logo.svg',
                faviconUrl: '/favicon.ico',
            },
            legal: {
                appName: 'Test App',
                companyName: 'Test Company',
                supportEmail: 'support@test.com',
            },
            semantics: {
                colors: {
                    surface: {
                        base: '#ffffff',
                        raised: '#fafafa',
                        sunken: '#f5f5f5',
                        overlay: 'rgba(0, 0, 0, 0.5)',
                        warning: '#fef3c7',
                    },
                    text: {
                        primary: '#0f172a',
                        secondary: '#475569',
                        muted: '#94a3b8',
                        inverted: '#ffffff',
                        accent: '#3B82F6',
                    },
                    interactive: {
                        primary: '#3B82F6',
                        primaryHover: '#2563eb',
                        primaryActive: '#1d4ed8',
                        primaryForeground: '#ffffff',
                        secondary: '#8B5CF6',
                        secondaryHover: '#7c3aed',
                        secondaryActive: '#6d28d9',
                        secondaryForeground: '#ffffff',
                        destructive: '#ef4444',
                        destructiveHover: '#dc2626',
                        destructiveActive: '#b91c1c',
                        destructiveForeground: '#ffffff',
                        accent: '#EC4899',
                    },
                    border: {
                        subtle: '#e2e8f0',
                        default: '#cbd5e1',
                        strong: '#94a3b8',
                        focus: '#3B82F6',
                        warning: '#fbbf24',
                    },
                    status: {
                        success: '#22c55e',
                        warning: '#eab308',
                        danger: '#ef4444',
                        info: '#38bdf8',
                    },
                },
                spacing: {
                    pagePadding: '1.5rem',
                    sectionGap: '2rem',
                    cardPadding: '1rem',
                    componentGap: '0.75rem',
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
                    glacial: 800,
                },
                easing: {
                    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
                    accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
                    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                },
                enableParallax: false,
                enableMagneticHover: false,
                enableScrollReveal: false,
            },
        },
    };
}

/**
 * API Schema Validation Tests
 *
 * These tests verify that the Zod schemas include ALL fields that the backend
 * returns and the UI expects. This catches bugs where:
 * - Backend stores and returns a field
 * - But the Zod schema doesn't include it
 * - So the field gets stripped during schema validation
 * - And the UI receives undefined
 *
 * Every schema exported from apiSchemas.ts must have comprehensive tests here.
 */

describe('API Schema Validation', () => {
    describe('AppConfigurationSchema', () => {
        it('should validate complete app configuration with all optional fields', () => {
            const config = {
                firebase: {
                    apiKey: 'test-api-key',
                    authDomain: 'test.firebaseapp.com',
                    projectId: 'test-project',
                    storageBucket: 'test.appspot.com',
                    messagingSenderId: '123456789',
                    appId: '1:123:web:abc',
                    measurementId: 'G-ABC123',
                },
                warningBanner: 'Test environment',
                formDefaults: {
                    displayName: 'Test User',
                    email: 'test@example.com',
                    password: 'testpass123',
                },
                firebaseAuthUrl: 'http://localhost:9099',
                firebaseFirestoreUrl: 'http://localhost:8080',
            };

            const result = AppConfigurationSchema.parse(config);

            expect(result.firebase.apiKey).toBe('test-api-key');
            expect(result.firebase.authDomain).toBe('test.firebaseapp.com');
            expect(result.firebase.projectId).toBe('test-project');
            expect(result.firebase.storageBucket).toBe('test.appspot.com');
            expect(result.firebase.messagingSenderId).toBe('123456789');
            expect(result.firebase.appId).toBe('1:123:web:abc');
            expect(result.firebase.measurementId).toBe('G-ABC123');
            expect(result.warningBanner).toBe('Test environment');
            expect(result.formDefaults.displayName).toBe('Test User');
            expect(result.formDefaults.email).toBe('test@example.com');
            expect(result.formDefaults.password).toBe('testpass123');
            expect(result.firebaseAuthUrl).toBe('http://localhost:9099');
            expect(result.firebaseFirestoreUrl).toBe('http://localhost:8080');
        });

        it('should validate minimal app configuration without optional fields', () => {
            const config = {
                firebase: {
                    apiKey: 'test-api-key',
                    authDomain: 'test.firebaseapp.com',
                    projectId: 'test-project',
                    storageBucket: 'test.appspot.com',
                    messagingSenderId: '123456789',
                    appId: '1:123:web:abc',
                },
                formDefaults: {},
            };

            const result = AppConfigurationSchema.parse(config);

            expect(result.firebase.apiKey).toBe('test-api-key');
            expect(result.warningBanner).toBeUndefined();
            expect(result.formDefaults.displayName).toBeUndefined();
        });
    });

    describe('ExpenseSplitSchema', () => {
        it('should validate expense split with all fields', () => {
            const split = {
                uid: 'user123',
                amount: '150.50',
                percentage: 33.33,
                userName: 'John Doe',
            };

            const result = ExpenseSplitSchema.parse(split);

            expect(result.uid).toBe('user123');
            expect(result.amount).toBe('150.50');
            expect(result.percentage).toBe(33.33);
            expect(result.userName).toBe('John Doe');
        });

        it('should validate expense split without optional fields', () => {
            const split = {
                uid: 'user123',
                amount: '150.50',
            };

            const result = ExpenseSplitSchema.parse(split);

            expect(result.uid).toBe('user123');
            expect(result.amount).toBe('150.50');
            expect(result.percentage).toBeUndefined();
            expect(result.userName).toBeUndefined();
        });
    });

    describe('SimplifiedDebtSchema', () => {
        it('should validate simplified debt with all required fields', () => {
            const debt = {
                from: { uid: 'user1' },
                to: { uid: 'user2' },
                amount: '50.00',
                currency: 'USD',
            };

            const result = SimplifiedDebtSchema.parse(debt);

            expect(result.from.uid).toBe('user1');
            expect(result.to.uid).toBe('user2');
            expect(result.amount).toBe('50.00');
            expect(result.currency).toBe('USD');
        });

        it('should reject invalid currency codes', () => {
            const debt = {
                from: { uid: 'user1' },
                to: { uid: 'user2' },
                amount: '50.00',
                currency: 'US', // Invalid - must be 3 chars
            };

            expect(() => SimplifiedDebtSchema.parse(debt)).toThrow();
        });
    });

    describe('ApiErrorResponseSchema', () => {
        it('should validate structured error format', () => {
            const error = {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input',
                    details: { field: 'email' },
                },
            };

            const result = ApiErrorResponseSchema.parse(error);

            expect(result).toBeDefined();
        });

        it('should reject simple error format (string instead of object)', () => {
            const error = {
                error: 'Something went wrong',
                field: 'email',
            };

            expect(() => ApiErrorResponseSchema.parse(error)).toThrow();
        });

        it('should reject error missing code field', () => {
            const error = {
                error: {
                    message: 'Something went wrong',
                },
            };

            expect(() => ApiErrorResponseSchema.parse(error)).toThrow();
        });
    });

    describe('AdminUserProfileSchema', () => {
        it('should validate complete admin user profile with all fields', () => {
            // Note: email is intentionally excluded for privacy
            const profile = {
                uid: 'user123',
                emailVerified: true,
                displayName: 'Admin User',
                photoURL: 'https://example.com/photo.jpg',
                role: 'system_admin' as const,
                disabled: false,
                metadata: {
                    creationTime: '2024-01-01T00:00:00.000Z',
                    lastSignInTime: '2024-01-15T10:30:00.000Z',
                },
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-15T10:30:00.000Z',
                preferredLanguage: 'en',
                acceptedPolicies: {
                    terms: { 'v1.0': '2024-01-01T00:00:00.000Z' },
                    privacy: { 'v1.0': '2024-01-01T00:00:00.000Z' },
                },
                signupTenantId: 'tenant-abc',
            };

            const result = AdminUserProfileSchema.parse(profile);

            expect(result.emailVerified).toBe(true);
            expect(result.displayName).toBe('Admin User');
            expect(result.photoURL).toBe('https://example.com/photo.jpg');
            expect(result.role).toBe('system_admin' as const);
            expect(result.disabled).toBe(false);
            expect(result.metadata.creationTime).toBe('2024-01-01T00:00:00.000Z');
            expect(result.metadata.lastSignInTime).toBe('2024-01-15T10:30:00.000Z');
            expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
            expect(result.updatedAt).toBe('2024-01-15T10:30:00.000Z');
            expect(result.preferredLanguage).toBe('en');
            expect(result.acceptedPolicies).toEqual({
                terms: { 'v1.0': '2024-01-01T00:00:00.000Z' },
                privacy: { 'v1.0': '2024-01-01T00:00:00.000Z' },
            });
            expect(result.signupTenantId).toBe('tenant-abc');
        });

        it('should validate minimal admin user profile without optional fields', () => {
            // Note: email is intentionally excluded for privacy
            const profile = {
                uid: 'user123',
                emailVerified: false,
                displayName: 'Admin User',
                photoURL: null,
                role: 'system_user' as const,
                disabled: false,
                metadata: {
                    creationTime: '2024-01-01T00:00:00.000Z',
                },
            };

            const result = AdminUserProfileSchema.parse(profile);

            expect(result.photoURL).toBeNull();
            expect(result.metadata.lastSignInTime).toBeUndefined();
            expect(result.createdAt).toBeUndefined();
            expect(result.signupTenantId).toBeUndefined();
        });
    });

    describe('ListAuthUsersResponseSchema', () => {
        it('should validate list of users with pagination', () => {
            // Note: email is intentionally excluded for privacy
            const response = {
                users: [
                    {
                        uid: 'user1',
                        emailVerified: true,
                        displayName: 'User One',
                        photoURL: null,
                        role: 'system_user' as const,
                        disabled: false,
                        metadata: {
                            creationTime: '2024-01-01T00:00:00.000Z',
                        },
                        signupTenantId: 'tenant-1',
                    },
                    {
                        uid: 'user2',
                        emailVerified: false,
                        displayName: 'User Two',
                        photoURL: 'https://example.com/photo.jpg',
                        role: 'system_admin' as const,
                        disabled: false,
                        metadata: {
                            creationTime: '2024-01-02T00:00:00.000Z',
                            lastSignInTime: '2024-01-15T12:00:00.000Z',
                        },
                        signupTenantId: 'tenant-2',
                    },
                ],
                nextPageToken: 'token123',
                hasMore: true,
            };

            const result = ListAuthUsersResponseSchema.parse(response);

            expect(result.users).toHaveLength(2);
            expect(result.users[0].displayName).toBe('User One');
            expect(result.users[0].signupTenantId).toBe('tenant-1');
            expect(result.users[1].displayName).toBe('User Two');
            expect(result.users[1].signupTenantId).toBe('tenant-2');
            expect(result.nextPageToken).toBe('token123');
            expect(result.hasMore).toBe(true);
        });

        it('should validate empty users list', () => {
            const response = {
                users: [],
                hasMore: false,
            };

            const result = ListAuthUsersResponseSchema.parse(response);

            expect(result.users).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextPageToken).toBeUndefined();
        });
    });

    describe('ActivityFeedItemSchema', () => {
        it('should validate activity feed item with all detail fields', () => {
            const item = {
                id: 'activity123',
                userId: 'user1',
                groupId: 'group1',
                groupName: 'Test Group',
                eventType: 'expense-created',
                action: 'create',
                actorId: 'user2',
                actorName: 'John Doe',
                timestamp: '2024-01-15T10:30:00.000Z',
                details: {
                    expenseId: 'expense1',
                    expenseDescription: 'Dinner',
                    commentId: 'comment1',
                    commentPreview: 'Great!',
                    settlementId: 'settlement1',
                    settlementDescription: 'Payment',
                    targetUserId: 'user3',
                    targetUserName: 'Jane Doe',
                    previousGroupName: 'Old Group Name',
                },
                createdAt: '2024-01-15T10:30:00.000Z',
            };

            const result = ActivityFeedItemSchema.parse(item);

            expect(result.id).toBe('activity123');
            expect(result.groupName).toBe('Test Group');
            expect(result.eventType).toBe('expense-created');
            expect(result.action).toBe('create');
            expect(result.actorName).toBe('John Doe');
            expect(result.timestamp).toBe('2024-01-15T10:30:00.000Z');
            expect(result.details.expenseId).toBe('expense1');
            expect(result.details.expenseDescription).toBe('Dinner');
            expect(result.details.commentId).toBe('comment1');
            expect(result.details.commentPreview).toBe('Great!');
            expect(result.details.settlementId).toBe('settlement1');
            expect(result.details.targetUserId).toBe('user3');
            expect(result.details.targetUserName).toBe('Jane Doe');
            expect(result.details.previousGroupName).toBe('Old Group Name');
            expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
        });

        it('should validate activity feed item with minimal details', () => {
            const item = {
                id: 'activity123',
                userId: 'user1',
                groupId: 'group1',
                groupName: 'Test Group',
                eventType: 'member-joined',
                action: 'join',
                actorId: 'user2',
                actorName: 'John Doe',
                timestamp: '2024-01-15T10:30:00.000Z',
                details: {},
            };

            const result = ActivityFeedItemSchema.parse(item);

            expect(result.id).toBe('activity123');
            expect(result.details.expenseId).toBeUndefined();
            expect(result.details.commentId).toBeUndefined();
            expect(result.createdAt).toBeUndefined();
        });
    });

    describe('ActivityFeedResponseSchema', () => {
        it('should validate activity feed response with items and pagination', () => {
            const response = {
                items: [
                    {
                        id: 'activity1',
                        userId: 'user1',
                        groupId: 'group1',
                        groupName: 'Group 1',
                        eventType: 'expense-created',
                        action: 'create',
                        actorId: 'user2',
                        actorName: 'John',
                        timestamp: '2024-01-15T10:30:00.000Z',
                        details: {},
                    },
                    {
                        id: 'activity2',
                        userId: 'user1',
                        groupId: 'group2',
                        groupName: 'Group 2',
                        eventType: 'member-joined',
                        action: 'join',
                        actorId: 'user3',
                        actorName: 'Jane',
                        timestamp: '2024-01-14T10:30:00.000Z',
                        details: {},
                    },
                ],
                hasMore: true,
                nextCursor: 'cursor123',
            };

            const result = ActivityFeedResponseSchema.parse(response);

            expect(result.items).toHaveLength(2);
            expect(result.items[0].id).toBe('activity1');
            expect(result.items[1].id).toBe('activity2');
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('cursor123');
        });

        it('should validate empty activity feed', () => {
            const response = {
                items: [],
                hasMore: false,
            };

            const result = ActivityFeedResponseSchema.parse(response);

            expect(result.items).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();
        });
    });

    describe('TenantSettingsResponseSchema', () => {
        it('should validate tenant settings response with all fields', () => {
            const response = {
                tenantId: 'tenant123',
                config: {
                    tenantId: 'tenant123',
                    branding: {
                        primaryColor: '#3B82F6',
                        secondaryColor: '#8B5CF6',
                        accentColor: '#EC4899',
                    },
                    brandingTokens: createTestBrandingTokens(),
                    marketingFlags: {
                        showMarketingContent: false,
                        showPricingPage: true,
                    },
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-15T10:30:00.000Z',
                },
                domains: ['example.com', 'test.example.com'],
            };

            const result = TenantSettingsResponseSchema.parse(response);

            expect(result.config.brandingTokens.tokens.legal.appName).toBe('Test App');
            expect(result.config.brandingTokens.tokens.assets.logoUrl).toBe('/logo.svg');
            expect(result.config.branding.primaryColor).toBe('#3B82F6');
            expect(result.config.branding.accentColor).toBe('#EC4899');
            expect(result.domains).toHaveLength(2);
        });
    });

    describe('TenantDomainsResponseSchema', () => {
        it('should validate tenant domains response', () => {
            const response = {
                domains: ['example.com', 'test.example.com', 'staging.example.com'],
            };

            const result = TenantDomainsResponseSchema.parse(response);

            expect(result.domains).toHaveLength(3);
            expect(result.domains).toContain('example.com');
            expect(result.domains).toContain('test.example.com');
        });
    });

    describe('AdminTenantItemSchema', () => {
        it('should validate admin tenant item with all fields', () => {
            const item = {
                tenant: {
                    tenantId: 'tenant1',
                    branding: {
                        primaryColor: '#3B82F6',
                        secondaryColor: '#8B5CF6',
                    },
                    brandingTokens: createTestBrandingTokens(),
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-15T10:30:00.000Z',
                },
                domains: ['tenant1.example.com', 'www.tenant1.example.com'],
                isDefault: false,
            };

            const result = AdminTenantItemSchema.parse(item);

            expect(result.tenant.brandingTokens.tokens.legal.appName).toBe('Test App');
            expect(result.domains).toHaveLength(2);
            expect(result.isDefault).toBe(false);
        });

        it('should validate admin tenant item with empty domains', () => {
            const item = {
                tenant: {
                    tenantId: 'tenant1',
                    branding: {
                        primaryColor: '#3B82F6',
                        secondaryColor: '#8B5CF6',
                    },
                    brandingTokens: createTestBrandingTokens(),
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-15T10:30:00.000Z',
                },
                domains: [],
                isDefault: true,
            };

            const result = AdminTenantItemSchema.parse(item);

            expect(result.domains).toHaveLength(0);
            expect(result.isDefault).toBe(true);
        });
    });

    describe('AdminTenantsListResponseSchema', () => {
        it('should validate tenants list response with multiple tenants', () => {
            const tenant1Tokens = createTestBrandingTokens();
            tenant1Tokens.tokens.legal.appName = 'Tenant 1';
            const tenant2Tokens = createTestBrandingTokens();
            tenant2Tokens.tokens.legal.appName = 'Tenant 2';

            const response = {
                tenants: [
                    {
                        tenant: {
                            tenantId: 'tenant1',
                            branding: {
                                primaryColor: '#3B82F6',
                                secondaryColor: '#8B5CF6',
                            },
                            brandingTokens: tenant1Tokens,
                            createdAt: '2024-01-01T00:00:00.000Z',
                            updatedAt: '2024-01-15T10:30:00.000Z',
                        },
                        domains: ['tenant1.example.com'],
                        isDefault: false,
                    },
                    {
                        tenant: {
                            tenantId: 'tenant2',
                            branding: {
                                primaryColor: '#EC4899',
                                secondaryColor: '#10B981',
                            },
                            brandingTokens: tenant2Tokens,
                            createdAt: '2024-01-02T00:00:00.000Z',
                            updatedAt: '2024-01-16T10:30:00.000Z',
                        },
                        domains: [],
                        isDefault: true,
                    },
                ],
                count: 2,
            };

            const result = AdminTenantsListResponseSchema.parse(response);

            expect(result.tenants).toHaveLength(2);
            expect(result.tenants[0].tenant.brandingTokens.tokens.legal.appName).toBe('Tenant 1');
            expect(result.tenants[1].tenant.brandingTokens.tokens.legal.appName).toBe('Tenant 2');
            expect(result.count).toBe(2);
        });

        it('should validate empty tenants list', () => {
            const response = {
                tenants: [],
                count: 0,
            };

            const result = AdminTenantsListResponseSchema.parse(response);

            expect(result.tenants).toHaveLength(0);
            expect(result.count).toBe(0);
        });
    });

    describe('CurrencyBalanceDisplaySchema', () => {
        it('should validate currency balance with all fields', () => {
            const balance = {
                currency: 'USD',
                netBalance: '150.50',
                totalOwed: '200.00',
                totalOwing: '49.50',
            };

            const result = CurrencyBalanceDisplaySchema.parse(balance);

            expect(result.currency).toBe('USD');
            expect(result.netBalance).toBe('150.50');
            expect(result.totalOwed).toBe('200.00');
            expect(result.totalOwing).toBe('49.50');
        });
    });

    describe('BalanceDisplaySchema', () => {
        it('should validate balance display with multiple currencies', () => {
            const balance = {
                balancesByCurrency: {
                    USD: {
                        currency: 'USD',
                        netBalance: '150.50',
                        totalOwed: '200.00',
                        totalOwing: '49.50',
                    },
                    EUR: {
                        currency: 'EUR',
                        netBalance: '-25.00',
                        totalOwed: '50.00',
                        totalOwing: '75.00',
                    },
                },
            };

            const result = BalanceDisplaySchema.parse(balance);

            expect(Object.keys(result.balancesByCurrency)).toHaveLength(2);
            expect(result.balancesByCurrency.USD.currency).toBe('USD');
            expect(result.balancesByCurrency.USD.netBalance).toBe('150.50');
            expect(result.balancesByCurrency.EUR.currency).toBe('EUR');
            expect(result.balancesByCurrency.EUR.netBalance).toBe('-25.00');
        });

        it('should validate empty balance display', () => {
            const balance = {
                balancesByCurrency: {},
            };

            const result = BalanceDisplaySchema.parse(balance);

            expect(Object.keys(result.balancesByCurrency)).toHaveLength(0);
        });
    });
});
