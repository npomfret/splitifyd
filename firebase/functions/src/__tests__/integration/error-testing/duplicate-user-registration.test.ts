// Tests for duplicate user registration handling

import { describe, expect, test } from 'vitest';

import { ApiDriver, generateTestEmail, UserBuilder } from '@splitifyd/test-support';

describe('Duplicate User Registration Tests', () => {
    const apiDriver = new ApiDriver();

    describe('Sequential Registration', () => {
        test('should prevent duplicate email registration', async () => {
            const userData = new UserBuilder().build();

            // First registration should succeed
            const firstResponse = await apiDriver.register(userData);
            expect(firstResponse).toHaveProperty('user');
            expect(firstResponse.user.email).toBe(userData.email);

            // Second registration with same email should fail
            await expect(apiDriver.register(userData)).rejects.toThrow(/409|email.*exists|already.*registered/i);
        });

        test('should return consistent error message for duplicate emails', async () => {
            const userData = new UserBuilder().build();

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
            const userData = new UserBuilder().build();

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
            const userData = new UserBuilder().build();

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
            const userData = new UserBuilder().withEmail(baseEmail.toLowerCase()).build();

            // Register with lowercase
            await apiDriver.register(userData);

            // Try with uppercase - should fail
            const upperCaseData = new UserBuilder().withEmail(baseEmail.toUpperCase()).withPassword(userData.password).withDisplayName(userData.displayName).build();

            await expect(apiDriver.register(upperCaseData)).rejects.toThrow(/409|email.*exists/i);

            // Try with mixed case - should also fail
            const mixedCaseData = new UserBuilder()
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
            const userData = new UserBuilder().withEmail(baseEmail).build();

            // Register normally
            await apiDriver.register(userData);

            // Try with spaces - Firebase validates email format first
            const spacedData = new UserBuilder().withEmail(`  ${baseEmail}  `).withPassword(userData.password).withDisplayName(userData.displayName).build();

            // Server correctly rejects emails with spaces as invalid format
            await expect(apiDriver.register(spacedData)).rejects.toThrow(/400|invalid.*email|validation/i);
        });

        test('should allow different users with different emails', async () => {
            const user1 = new UserBuilder().build();
            const user2 = new UserBuilder().build();

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
            const userData = new UserBuilder().build();

            // First attempt with invalid password
            const invalidData = { ...userData, password: '123' }; // Too weak

            await expect(apiDriver.register(invalidData)).rejects.toThrow(/400|password/i);

            // Second attempt with valid data should succeed
            const response = await apiDriver.register(userData);
            expect(response.user.email).toBe(userData.email);
        });
    });
});
