/**
 * @jest-environment node
 */

// Tests for duplicate user registration handling

import { ApiDriver } from '../../support/ApiDriver';
import { UserBuilder } from '../../support/builders';

describe('Duplicate User Registration Tests', () => {
    let driver: ApiDriver;

    jest.setTimeout(4000); // it takes about 2s

    beforeAll(async () => {

        driver = new ApiDriver();
    });


    describe('Sequential Registration', () => {
        test('should prevent duplicate email registration', async () => {
            const userData = new UserBuilder().build();

            // First registration should succeed
            const firstResponse = await driver.register(userData);
            expect(firstResponse).toHaveProperty('user');
            expect(firstResponse.user.email).toBe(userData.email);

            // Second registration with same email should fail
            await expect(driver.register(userData)).rejects.toThrow(/409|email.*exists|already.*registered/i);
        });

        test('should return consistent error message for duplicate emails', async () => {
            const userData = new UserBuilder().build();

            // Create user first
            await driver.register(userData);

            // Try to register again and check exact error
            try {
                await driver.register(userData);
                fail('Should have thrown an error');
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
                .map(() => driver.register(userData).catch((err) => err));

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
            await driver.register(userData);

            // Rapid sequential attempts
            const attempts = 3;
            for (let i = 0; i < attempts; i++) {
                await expect(driver.register(userData)).rejects.toThrow(/409|email.*exists/i);
            }
        });
    });

    describe('Case Sensitivity', () => {
        test('should treat email addresses case-insensitively', async () => {
            const baseEmail = `test${Date.now()}@example.com`;
            const userData = new UserBuilder().withEmail(baseEmail.toLowerCase()).build();

            // Register with lowercase
            await driver.register(userData);

            // Try with uppercase - should fail
            const upperCaseData = new UserBuilder().withEmail(baseEmail.toUpperCase()).withPassword(userData.password).withDisplayName(userData.displayName).build();

            await expect(driver.register(upperCaseData)).rejects.toThrow(/409|email.*exists/i);

            // Try with mixed case - should also fail
            const mixedCaseData = new UserBuilder()
                .withEmail(baseEmail.charAt(0).toUpperCase() + baseEmail.slice(1).toLowerCase())
                .withPassword(userData.password)
                .withDisplayName(userData.displayName)
                .build();

            await expect(driver.register(mixedCaseData)).rejects.toThrow(/409|email.*exists/i);
        });
    });

    describe('Edge Cases', () => {
        test('should handle registration with trimmed email addresses', async () => {
            const baseEmail = `trim${Date.now()}@example.com`;
            const userData = new UserBuilder().withEmail(baseEmail).build();

            // Register normally
            await driver.register(userData);

            // Try with spaces - Firebase validates email format first
            const spacedData = new UserBuilder().withEmail(`  ${baseEmail}  `).withPassword(userData.password).withDisplayName(userData.displayName).build();

            // Server correctly rejects emails with spaces as invalid format
            await expect(driver.register(spacedData)).rejects.toThrow(/400|invalid.*email|validation/i);
        });

        test('should allow different users with different emails', async () => {
            const timestamp = Date.now();
            const user1 = new UserBuilder().withEmail(`user1-${timestamp}@example.com`).build();
            const user2 = new UserBuilder().withEmail(`user2-${timestamp}@example.com`).build();

            // Both registrations should succeed
            const response1 = await driver.register(user1);
            const response2 = await driver.register(user2);

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

            await expect(driver.register(invalidData)).rejects.toThrow(/400|password/i);

            // Second attempt with valid data should succeed
            const response = await driver.register(userData);
            expect(response.user.email).toBe(userData.email);
        });
    });
});
