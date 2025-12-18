/**
 * @file Login and Password Reset API Tests
 * Tests the /login and /password-reset endpoints
 */

import { toEmail, toPassword } from '@billsplit-wl/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorDetail } from '../../../errors';
import { AppDriver } from '../AppDriver';

describe('auth endpoints', () => {
    let appDriver: AppDriver;

    beforeEach(async () => {
        appDriver = new AppDriver();
    });

    describe('POST /login', () => {
        it('should return custom token for valid credentials', async () => {
            // Create a test user with known credentials
            await appDriver.createTestUsers({
                count: 1,
                includeAdmin: false,
            });
            // createTestUsers creates user1@example.com with password 'password12345'

            // Login with those credentials
            const response = await appDriver.login({
                email: toEmail('user1@example.com'),
                password: toPassword('password12345'),
            });

            expect(response.success).toBe(true);
            expect(response.customToken).toBeDefined();
            expect(typeof response.customToken).toBe('string');
            expect(response.customToken.length).toBeGreaterThan(0);
        });

        it('should return 401 for invalid password', async () => {
            // Create a test user with known credentials
            await appDriver.createTestUsers({
                count: 1,
                includeAdmin: false,
            });

            // Try to login with wrong password
            await expect(
                appDriver.login({
                    email: toEmail('user1@example.com'),
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
