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

import { ApiDriver, borrowTestUsers, generateTestEmail, UserRegistrationBuilder, TestUserBuilder } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';

describe('Authentication and Registration - Integration Tests (Essential Firebase Behavior Only)', () => {
    const apiDriver = new ApiDriver();

    describe('Basic Authentication', () => {
        let users: PooledTestUser[];

        beforeEach(async () => {
            users = await borrowTestUsers(2);
        });

        test('should be able to register a new user in the emulator', async () => {
            const userData = new TestUserBuilder().build();
            const registeredUser = await apiDriver.register(userData);

            expect(registeredUser).toHaveProperty('user');
            expect(registeredUser.user).toHaveProperty('uid');
            expect(registeredUser.user).toHaveProperty('email', userData.email);
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
            const userData = new UserRegistrationBuilder().build();

            const response = await apiDriver.register(userData);

            expect(response).toHaveProperty('user');
            expect(response.user).toHaveProperty('uid');
            expect(response.user).toHaveProperty('email');
            expect(response.user.email).toBe(userData.email);
        });
    });

    describe('Duplicate Registration Prevention', () => {
        describe('Sequential Registration', () => {
            test('should prevent duplicate email registration', async () => {
                const userData = new UserRegistrationBuilder().build();

                // First registration should succeed
                const firstResponse = await apiDriver.register(userData);
                expect(firstResponse).toHaveProperty('user');
                expect(firstResponse.user.email).toBe(userData.email);

                // Second registration with same email should fail
                await expect(apiDriver.register(userData)).rejects.toThrow(/409|email.*exists|already.*registered/i);
            });

            test('should return consistent error message for duplicate emails', async () => {
                const userData = new UserRegistrationBuilder().build();

                // Create user first
                await apiDriver.register(userData);

                // Try to register again and check exact error
                try {
                    await apiDriver.register(userData);
                    throw 'Should have thrown an error';
                } catch (error: any) {
                    expect(error.message).toContain('409');
                    // The actual error response should contain the proper error structure
                    if (error.response && error.response.data) {
                        expect(error.response.data).toMatchObject({
                            error: {
                                code: 'EMAIL_EXISTS',
                                message: expect.stringContaining('email already exists'),
                            },
                        });
                    }
                }
            });
        });

        describe('Concurrent Registration', () => {
            test('should handle concurrent registration attempts with same email', async () => {
                const userData = new UserRegistrationBuilder().build();

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

                // All failures should be due to duplicate email
                failures.forEach((failure) => {
                    expect(failure.message).toMatch(/409|email.*exists/i);
                });
            });

            test('should handle rapid sequential registrations with same email', async () => {
                const userData = new UserRegistrationBuilder().build();

                // First registration
                await apiDriver.register(userData);

                // Rapid sequential attempts
                const attempts = 3;
                for (let i = 0; i < attempts; i++) {
                    await expect(apiDriver.register(userData)).rejects.toThrow(/409|email.*exists/i);
                }
            });
        });

        describe('Case Sensitivity', () => {
            test('should treat email addresses case-insensitively', async () => {
                const baseEmail = generateTestEmail();
                const userData = new UserRegistrationBuilder().withEmail(baseEmail.toLowerCase()).build();

                // Register with lowercase
                await apiDriver.register(userData);

                // Try with uppercase - should fail
                const upperCaseData = new UserRegistrationBuilder().withEmail(baseEmail.toUpperCase()).withPassword(userData.password).withDisplayName(userData.displayName).build();

                await expect(apiDriver.register(upperCaseData)).rejects.toThrow(/409|email.*exists/i);

                // Try with mixed case - should also fail
                const mixedCaseData = new UserRegistrationBuilder()
                    .withEmail(baseEmail.charAt(0).toUpperCase() + baseEmail.slice(1).toLowerCase())
                    .withPassword(userData.password)
                    .withDisplayName(userData.displayName)
                    .build();

                await expect(apiDriver.register(mixedCaseData)).rejects.toThrow(/409|email.*exists/i);
            });
        });

        describe('Edge Cases', () => {
            test('should handle registration with trimmed email addresses', async () => {
                const baseEmail = generateTestEmail();
                const userData = new UserRegistrationBuilder().withEmail(baseEmail).build();

                // Register normally
                await apiDriver.register(userData);

                // Try with spaces - should be trimmed and treated as duplicate
                const spacedData = new UserRegistrationBuilder().withEmail(`  ${baseEmail}  `).withPassword(userData.password).withDisplayName(userData.displayName).build();

                // Server trims email spaces and detects duplicate email
                await expect(apiDriver.register(spacedData)).rejects.toThrow(/409|email.*exists|already.*registered/i);
            });

            test('should allow different users with different emails', async () => {
                const user1 = new UserRegistrationBuilder().build();
                const user2 = new UserRegistrationBuilder().build();

                // Both registrations should succeed
                const response1 = await apiDriver.register(user1);
                const response2 = await apiDriver.register(user2);

                expect(response1.user.email).toBe(user1.email);
                expect(response2.user.email).toBe(user2.email);
                expect(response1.user.uid).not.toBe(response2.user.uid);
            });
        });

        describe('Error Recovery', () => {
            test('should allow registration after previous failure', async () => {
                const userData = new UserRegistrationBuilder().build();

                // First attempt with invalid password
                const invalidData = { ...userData, password: '123' }; // Too weak

                await expect(apiDriver.register(invalidData)).rejects.toThrow(/400|password/i);

                // Second attempt with valid data should succeed
                const response = await apiDriver.register(userData);
                expect(response.user.email).toBe(userData.email);
            });
        });
    });
});
