/**
 * Essential Authentication and Registration Integration Tests
 *
 * IMPORTANT: Most validation logic is now tested in unit tests:
 * - firebase/functions/src/__tests__/unit/auth/registration-validation.unit.test.ts
 *
 * This file now only contains essential Firebase-specific integration tests
 * that cannot be stubbed and require real Firebase Auth + HTTP API coordination.
 */

import { beforeEach, describe, expect, test } from 'vitest';

import { PooledTestUser, toEmail, toPassword } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers, generateTestEmail, TestUserBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';

describe('Authentication and Registration - Integration Tests (Essential Firebase Behavior Only)', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    afterEach(async () => {
    });

    describe('Basic Authentication', () => {
        let users: PooledTestUser[];

        beforeEach(async () => {
            users = await borrowTestUsers(2);
        });

        test('should be able to register a new user in the emulator', async () => {
            const userData = new TestUserBuilder()
                .build();
            const registeredUser = await apiDriver.register({
                ...userData,
                password: toPassword(userData.password),
                termsAccepted: true,
                cookiePolicyAccepted: true,
                privacyPolicyAccepted: true,
                adminEmailsAccepted: true,
                marketingEmailsAccepted: false,
            });

            expect(registeredUser).toHaveProperty('user');
            expect(registeredUser.user).toHaveProperty('uid');
        });

        test('should allow users to register and log in', () => {
            const testUsers = users.slice(0, 2);
            expect(testUsers.length).toBe(2);
            testUsers.forEach((user) => {
                expect(user.uid).toBeDefined();
                expect(user.token).toBeDefined();
                expect(user.email).toContain('@example.com');
            });
        });
    });

    describe('Firebase Auth Integration', () => {
        test('should register a new user and create Firebase Auth record', async () => {
            // This test verifies actual Firebase Auth integration
            const userData = new UserRegistrationBuilder()
                .build();

            const response = await apiDriver.register(userData);

            expect(response).toHaveProperty('user');
            expect(response.user).toHaveProperty('uid');
        });
    });

    describe('Duplicate Registration Prevention', () => {
        describe('Sequential Registration', () => {
            test('should prevent duplicate email registration', async () => {
                const userData = new UserRegistrationBuilder()
                    .build();

                // First registration should succeed
                const firstResponse = await apiDriver.register(userData);
                expect(firstResponse).toHaveProperty('user');

                // Second registration with same email should fail with ALREADY_EXISTS
                await expect(apiDriver.register(userData)).rejects.toThrow(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
            });

            test('should return consistent error message for duplicate emails', async () => {
                const userData = new UserRegistrationBuilder()
                    .build();

                // Create user first
                await apiDriver.register(userData);

                // Try to register again and check exact error (ALREADY_EXISTS with EMAIL_ALREADY_EXISTS detail)
                try {
                    await apiDriver.register(userData);
                    throw 'Should have thrown an error';
                } catch (error: any) {
                    expect(error.message).toContain('409');
                    expect(error.message).toMatch(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
                }
            });
        });

        describe('Concurrent Registration', () => {
            test('should handle concurrent registration attempts with same email', async () => {
                const userData = new UserRegistrationBuilder()
                    .build();

                // Attempt to register the same user concurrently
                const promises = Array(5)
                    .fill(null)
                    .map(() => apiDriver.register(userData).catch((err) => err));

                const results = await Promise.all(promises);

                // Exactly one should succeed, others should fail
                const successes = results.filter((r) => !(r instanceof Error));
                const failures = results.filter((r) => r instanceof Error);

                expect(successes.length).toBe(1);
                expect(failures.length).toBe(4);

                // All failures should have ALREADY_EXISTS error
                failures.forEach((failure) => {
                    expect(failure.message).toMatch(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
                });
            });

            test('should handle rapid sequential registrations with same email', async () => {
                const userData = new UserRegistrationBuilder()
                    .build();

                // First registration
                await apiDriver.register(userData);

                // Rapid sequential attempts should fail with ALREADY_EXISTS
                const attempts = 3;
                for (let i = 0; i < attempts; i++) {
                    await expect(apiDriver.register(userData)).rejects.toThrow(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
                }
            });
        });

        describe('Case Sensitivity', () => {
            test('should treat email addresses case-insensitively', async () => {
                const baseEmail = generateTestEmail();
                const userData = new UserRegistrationBuilder()
                    .withEmail(baseEmail.toLowerCase())
                    .build();

                // Register with lowercase
                await apiDriver.register(userData);

                // Try with uppercase - should fail with ALREADY_EXISTS
                const upperCaseData = new UserRegistrationBuilder()
                    .withEmail(baseEmail.toUpperCase())
                    .withPassword(userData.password)
                    .withDisplayName(userData.displayName)
                    .build();

                await expect(apiDriver.register(upperCaseData)).rejects.toThrow(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);

                // Try with mixed case - should also fail with ALREADY_EXISTS
                const mixedCaseData = new UserRegistrationBuilder()
                    .withEmail(baseEmail.charAt(0).toUpperCase() + baseEmail.slice(1).toLowerCase())
                    .withPassword(userData.password)
                    .withDisplayName(userData.displayName)
                    .build();

                await expect(apiDriver.register(mixedCaseData)).rejects.toThrow(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
            });
        });

        describe('Edge Cases', () => {
            test('should handle registration with trimmed email addresses', async () => {
                const baseEmail = generateTestEmail();
                const userData = new UserRegistrationBuilder()
                    .withEmail(baseEmail)
                    .build();

                // Register normally
                await apiDriver.register(userData);

                // Try with spaces - should be trimmed and treated as duplicate
                const spacedData = new UserRegistrationBuilder()
                    .withEmail(`  ${baseEmail}  `)
                    .withPassword(userData.password)
                    .withDisplayName(userData.displayName)
                    .build();

                // Server trims email spaces and detects duplicate email (returns ALREADY_EXISTS)
                await expect(apiDriver.register(spacedData)).rejects.toThrow(/ALREADY_EXISTS|EMAIL_ALREADY_EXISTS/i);
            });

            test('should allow different users with different emails', async () => {
                const user1 = new UserRegistrationBuilder()
                    .build();
                const user2 = new UserRegistrationBuilder()
                    .build();

                // Both registrations should succeed
                const response1 = await apiDriver.register(user1);
                const response2 = await apiDriver.register(user2);

                expect(response1.user.uid).not.toBe(response2.user.uid);
            });
        });

        describe('Error Recovery', () => {
            test('should allow registration after previous failure', async () => {
                const userData = new UserRegistrationBuilder()
                    .build();

                // First attempt with invalid password
                const invalidData = new UserRegistrationBuilder()
                    .from(userData)
                    .withInvalidPassword('123') // Too weak
                    .build();

                await expect(apiDriver.register(invalidData)).rejects.toThrow(/400|password/i);

                // Second attempt with valid data should succeed
                const response = await apiDriver.register(userData);
                expect(response.user.displayName).toBe(userData.displayName);
            });
        });
    });

    describe('Password Reset Email', () => {
        test('should send password reset email via Postmark sandbox', async () => {
            // Register a user with email matching sender domain
            // Postmark sandbox requires recipient domain to match sender domain (sidebadger.me)
            const testEmail = `test-${Date.now()}@sidebadger.me`;
            const userData = new UserRegistrationBuilder().withEmail(testEmail).build();
            await apiDriver.register(userData);

            // Request password reset - this hits the real Postmark API (sandboxed via sidebadger-me-blackhole)
            // Email is processed by Postmark but not actually delivered
            await expect(
                apiDriver.sendPasswordResetEmail({ email: userData.email }),
            ).resolves.not.toThrow();
        });
    });

    describe('Welcome Email', () => {
        test('should send welcome email during registration via Postmark sandbox', async () => {
            // Register a user with email matching sender domain
            // Postmark sandbox requires recipient domain to match sender domain (sidebadger.me)
            // The welcome email is sent automatically during registration
            const testEmail = `welcome-${Date.now()}@sidebadger.me`;
            const userData = new UserRegistrationBuilder().withEmail(testEmail).build();

            // Registration should succeed - welcome email is sent as part of the flow
            // but failures are logged and don't fail the registration
            const result = await apiDriver.register(userData);

            expect(result).toHaveProperty('user');
            expect(result.user).toHaveProperty('uid');
        });
    });

    describe('Email Verification', () => {
        test('should send email verification email via Postmark sandbox', async () => {
            // Register a user with email matching sender domain
            // Postmark sandbox requires recipient domain to match sender domain (sidebadger.me)
            const testEmail = `verify-${Date.now()}@sidebadger.me`;
            const userData = new UserRegistrationBuilder().withEmail(testEmail).build();
            await apiDriver.register(userData);

            // Request email verification - this hits the real Postmark API (sandboxed via sidebadger-me-blackhole)
            // Email is processed by Postmark but not actually delivered
            await expect(
                apiDriver.sendEmailVerification({ email: userData.email }),
            ).resolves.not.toThrow();
        });
    });

    describe('Email Change Verification', () => {
        test('should send email change verification via Postmark sandbox', async () => {
            // Borrow a pre-authenticated test user from the pool
            // These users have matching sidebadger.me domain for Postmark sandbox
            const [user] = await borrowTestUsers(1);
            const newEmail = toEmail(`emailchange-new-${Date.now()}@sidebadger.me`);

            // Request email change - this sends verification email to the new address
            // via Postmark sandbox (processed but not delivered)
            // The actual email change happens when user clicks the link
            await expect(
                apiDriver.changeEmail(
                    { currentPassword: toPassword(user.password), newEmail },
                    user.token,
                ),
            ).resolves.not.toThrow();
        });
    });
});
