/**
 * @file Auth API Tests
 * Tests the /register, /login and /password-reset endpoints
 */

import { toEmail, toPassword, toUserId } from '@billsplit-wl/shared';
import { UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorDetail } from '../../../errors';
import { AppDriver } from '../AppDriver';

describe('auth endpoints', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        appDriver = new AppDriver();
    });

    describe('POST /register', () => {
        beforeEach(() => {
            // Registration requires a tenant with domain match for localhost
            appDriver.seedLocalhostTenant();
        });

        it('should successfully register a new user', async () => {
            const registration = new UserRegistrationBuilder()
                .withEmail('newuser@example.com')
                .withPassword('ValidPassword1234!')
                .withDisplayName('New User')
                .build();

            const result = await appDriver.register(registration);

            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.uid).toBeDefined();
            expect(result.user.displayName).toBe('New User');
        });

        it('should store signupTenantId on the user document', async () => {
            const registration = new UserRegistrationBuilder()
                .withEmail('tenant-tracked@example.com')
                .withPassword('ValidPassword1234!')
                .withDisplayName('Tenant Tracked User')
                .build();

            const result = await appDriver.register(registration);

            // Verify signupTenantId is stored on the user document
            const userDocument = await appDriver.getUserDocumentById(toUserId(result.user.uid));
            expect(userDocument.signupTenantId).toBe('localhost-tenant');
        });

        it('should reject registration when signupHostname does not match request host', async () => {
            const registration = new UserRegistrationBuilder()
                .withEmail('newuser@example.com')
                .withPassword('ValidPassword1234!')
                .withDisplayName('New User')
                .withSignupHostname('malicious.attacker.com') // Different from request host (localhost)
                .build();

            await expect(appDriver.register(registration))
                .rejects
                .toMatchObject({
                    statusCode: 400,
                    code: 'INVALID_REQUEST',
                    data: { detail: ErrorDetail.HOST_MISMATCH },
                });
        });

        it('should reject registration when host header conflicts with X-Forwarded-Host', async () => {
            const registration = new UserRegistrationBuilder()
                .withEmail('newuser@example.com')
                .withPassword('ValidPassword1234!')
                .withDisplayName('New User')
                .withSignupHostname('tenant-a.example.com')
                .build();

            await expect(
                appDriver.registerWithOptions(registration, {
                    headers: {
                        host: 'tenant-a.example.com',
                        'x-forwarded-host': 'tenant-b.example.com',
                    },
                    hostname: 'tenant-a.example.com',
                }),
            )
                .rejects
                .toMatchObject({
                    statusCode: 400,
                    code: 'INVALID_REQUEST',
                    data: { detail: ErrorDetail.HOST_MISMATCH },
                });
        });

        it('should allow registration from unknown host when default tenant exists', async () => {
            // The TenantRegistryService falls back to the default tenant for unknown hosts.
            // This is expected behavior for white-label apps - TENANT_NOT_FOUND only occurs
            // when no default tenant is configured (which is a misconfigured environment).
            const unknownHost = 'unknown-tenant.example.com';
            const registration = new UserRegistrationBuilder()
                .withEmail('newuser-unknown@example.com')
                .withPassword('ValidPassword1234!')
                .withDisplayName('Unknown Host User')
                .withSignupHostname(unknownHost)
                .build();

            const result = await appDriver.registerWithOptions(registration, {
                hostname: unknownHost,
            });

            expect(result.success).toBe(true);
            expect(result.user.displayName).toBe('Unknown Host User');
        });
    });

    describe('POST /login', () => {
        it('should return custom token for valid credentials', async () => {
            // Create a test user with known credentials
            const { emails, password } = await appDriver.createTestUsers({
                count: 1,
                includeAdmin: false,
            });

            // Login with those credentials
            const response = await appDriver.login({
                email: toEmail(emails[0]),
                password: toPassword(password),
            });

            expect(response.success).toBe(true);
            expect(response.customToken).toBeDefined();
            expect(typeof response.customToken).toBe('string');
            expect(response.customToken.length).toBeGreaterThan(0);
        });

        it('should return 401 for invalid password', async () => {
            // Create a test user with known credentials
            const { emails } = await appDriver.createTestUsers({
                count: 1,
                includeAdmin: false,
            });

            // Try to login with wrong password
            await expect(
                appDriver.login({
                    email: toEmail(emails[0]),
                    password: toPassword('WrongPassword123!'),
                }),
            )
                .rejects
                .toThrow();
        });

        it('should return 401 for non-existent email', async () => {
            const email = toEmail(`nonexistent-${Date.now()}@test.com`);

            await expect(
                appDriver.login({
                    email,
                    password: toPassword('password12345'),
                }),
            )
                .rejects
                .toThrow();
        });

        it('should return 400 for missing email', async () => {
            await expect(
                appDriver.login({
                    email: '' as any,
                    password: toPassword('password12345'),
                }),
            )
                .rejects
                .toThrow();
        });

        it('should return 400 for missing password', async () => {
            const email = toEmail(`test-${Date.now()}@test.com`);

            await expect(
                appDriver.login({
                    email,
                    password: '' as any,
                }),
            )
                .rejects
                .toThrow();
        });
    });

    describe('POST /password-reset', () => {
        beforeEach(() => {
            // Password reset requires a tenant with domain match for localhost
            appDriver.seedLocalhostTenant();
        });

        it('should return 204 for valid email (existing user)', async () => {
            // Create a test user with known email
            await appDriver.createTestUsers({
                count: 1,
                includeAdmin: false,
            });

            // Request password reset - should not throw
            await expect(
                appDriver.sendPasswordResetEmail({ email: toEmail('user1@example.com') }),
            )
                .resolves
                .toBeUndefined();
        });

        it('should return 204 even for non-existent email (prevents enumeration)', async () => {
            const email = toEmail(`nonexistent-reset-${Date.now()}@test.com`);

            // Should silently succeed (no enumeration attack possible)
            await expect(
                appDriver.sendPasswordResetEmail({ email }),
            )
                .resolves
                .toBeUndefined();
        });

        it('should return 400 for invalid email format', async () => {
            await expect(
                appDriver.sendPasswordResetEmail({ email: 'invalid-email' as any }),
            )
                .rejects
                .toThrow();
        });

        it('should reject host header mismatches', async () => {
            await expect(
                appDriver.sendPasswordResetEmailWithOptions(
                    { email: toEmail('user1@example.com') },
                    {
                        headers: {
                            host: 'tenant-a.example.com',
                            'x-forwarded-host': 'tenant-b.example.com',
                        },
                        hostname: 'tenant-a.example.com',
                    },
                ),
            )
                .rejects
                .toMatchObject({
                    statusCode: 400,
                    code: 'INVALID_REQUEST',
                    data: { detail: ErrorDetail.HOST_MISMATCH },
                });
        });
    });
});
