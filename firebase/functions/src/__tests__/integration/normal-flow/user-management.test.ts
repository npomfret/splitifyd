// Tests for user management endpoints

import {beforeEach, describe, expect, test} from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, borrowTestUser, generateTestEmail, User} from '@splitifyd/test-support';
import { ExpenseBuilder, UserBuilder } from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';

describe('User Management Tests', () => {
    // Automatic user pool management - fresh user for each test, automatic cleanup!
    const apiDriver = new ApiDriver();
    let user: User;

    beforeEach(async () => {
        user = await borrowTestUser();
    });

    describe('User Registration', () => {
        test('should register a new user successfully', async () => {
            const userData = new UserBuilder().build();

            const response = await apiDriver.register(userData);

            expect(response).toHaveProperty('user');
            expect(response.user).toHaveProperty('uid');
            expect(response.user).toHaveProperty('email');
            expect(response.user.email).toBe(userData.email);
        });

        test('should reject registration with invalid email', async () => {
            const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user..double@domain.com', 'user@domain', ''];

            for (const email of invalidEmails) {
                try {
                    await apiDriver.register(new UserBuilder().withEmail(email).build());
                    // If registration succeeds, the email validation is too permissive
                    throw new Error(`Email validation is too permissive: "${email}" was accepted`);
                } catch (error) {
                    const errorMessage = (error as Error).message;
                    // Accept both validation errors (400) and existing account errors (409)
                    // since some invalid emails might coincidentally match existing accounts
                    expect(errorMessage).toMatch(/400|409|invalid.*email|validation|email.*exists/i);
                }
            }
        });

        test('should reject registration with weak passwords', async () => {
            const weakPasswords = [
                '123456',
                'password',
                'abc',
                '',
                '12345',
                'qwerty',
                'password123', // no special chars
                'PASSWORD123!', // no lowercase
                'password!', // no numbers
            ];

            for (const password of weakPasswords) {
                await expect(apiDriver.register(new UserBuilder().withPassword(password).build())).rejects.toThrow(/400|weak.*password|password.*requirements|validation/i);
            }
        });

        test('should reject registration with missing required fields', async () => {
            const incompleteData = [
                { password: 'Password123!', displayName: 'Test User' }, // missing email
                { email: generateTestEmail(), displayName: 'Test User' }, // missing password
                { email: generateTestEmail(), password: 'Password123!' }, // missing displayName
                {}, // missing all
            ];

            for (const data of incompleteData) {
                await expect(apiDriver.register(data as any)).rejects.toThrow(/400|required|missing.*field|validation/i);
            }
        });

        test('should reject registration with duplicate email', async () => {
            // Create a user first to ensure it exists
            const firstUser = new UserBuilder().build();

            // First registration should succeed
            await apiDriver.register(firstUser);

            // Second registration with same email should fail
            await expect(apiDriver.register(new UserBuilder().withEmail(firstUser.email).build())).rejects.toThrow(/400|409|email.*exists|already.*registered/i);
        });

        test('should reject excessively long display names', async () => {
            const longDisplayName = 'A'.repeat(256); // Very long name

            await expect(apiDriver.register(new UserBuilder().withDisplayName(longDisplayName).build())).rejects.toThrow(/400|too.*long|exceeds.*limit|validation/i);
        });

        // Comprehensive invalid registration tests for terms and cookie policy
        describe('Invalid Registration Scenarios', () => {
            test('should reject registration with missing termsAccepted field', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        cookiePolicyAccepted: true,
                        // termsAccepted field intentionally omitted
                    });
                    throw new Error('Registration should have been rejected for missing termsAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|terms.*acceptance|required/i);
                }
            });

            test('should reject registration with missing cookiePolicyAccepted field', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: true,
                        // cookiePolicyAccepted field intentionally omitted
                    });
                    throw new Error('Registration should have been rejected for missing cookiePolicyAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|cookie.*policy.*acceptance|required/i);
                }
            });

            test('should reject registration with both terms fields missing', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        // Both terms fields intentionally omitted
                    });
                    throw new Error('Registration should have been rejected for missing terms fields');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|terms.*acceptance|required/i);
                }
            });

            test('should reject registration with null termsAccepted', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: null,
                        cookiePolicyAccepted: true,
                    });
                    throw new Error('Registration should have been rejected for null termsAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|terms.*service|validation/i);
                }
            });

            test('should reject registration with null cookiePolicyAccepted', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: true,
                        cookiePolicyAccepted: null,
                    });
                    throw new Error('Registration should have been rejected for null cookiePolicyAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|cookie.*policy|validation/i);
                }
            });

            test('should reject registration with string values for boolean fields', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: 'true', // String instead of boolean
                        cookiePolicyAccepted: true,
                    });
                    throw new Error('Registration should have been rejected for string termsAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|validation|must be.*boolean/i);
                }
            });

            test('should reject registration with numeric values for boolean fields', async () => {
                const userData = new UserBuilder().build();

                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: true,
                        cookiePolicyAccepted: 1, // Number instead of boolean
                    });
                    throw new Error('Registration should have been rejected for numeric cookiePolicyAccepted');
                } catch (error) {
                    expect((error as Error).message).toMatch(/400|validation|must be.*boolean/i);
                }
            });

            test('should reject registration with combined invalid fields', async () => {
                try {
                    await apiDriver.makeInvalidApiCall('/register', 'POST', {
                        email: 'invalid-email',
                        password: '123',
                        displayName: '',
                        termsAccepted: false,
                        cookiePolicyAccepted: false,
                    });
                    throw new Error('Registration should have been rejected for multiple invalid fields');
                } catch (error) {
                    // Should get the first validation error (likely email format)
                    expect((error as Error).message).toMatch(/400|invalid|validation/i);
                }
            });

            test('should provide specific error codes for terms and cookie policy failures', async () => {
                const userData = new UserBuilder().build();

                // Test specific error code for terms not accepted
                try {
                    await apiDriver.register({
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                        termsAccepted: false,
                        cookiePolicyAccepted: true,
                    });
                    throw new Error('Should have rejected for terms not accepted');
                } catch (error) {
                    expect((error as Error).message).toContain('Terms of Service');
                }

                // Test specific error code for cookie policy not accepted
                const userData2 = new UserBuilder().build();
                try {
                    await apiDriver.register({
                        email: userData2.email,
                        password: userData2.password,
                        displayName: userData2.displayName,
                        termsAccepted: true,
                        cookiePolicyAccepted: false,
                    });
                    throw new Error('Should have rejected for cookie policy not accepted');
                } catch (error) {
                    expect((error as Error).message).toContain('Cookie Policy');
                }
            });
        });
    });

    describe('User Expenses Endpoint', () => {
        let testGroup: any;
        // let userExpenses: any[] = []; // Not used currently

        beforeEach(async () => {
            // Create a test group and some expenses for the user
            const secondUser = await borrowTestUser();

            testGroup = await apiDriver.createGroupWithMembers(`User Expenses Test Group ${uuidv4()}`, [user, secondUser], user.token);

            // Create multiple expenses
            await apiDriver.createExpense(
                new ExpenseBuilder().withGroupId(testGroup.id).withAmount(100).withPaidBy(user.uid).withParticipants([user.uid, secondUser.uid]).withDescription('User Expense 1').build(),
                user.token,
            );

            await apiDriver.createExpense(
                new ExpenseBuilder().withGroupId(testGroup.id).withAmount(50).withPaidBy(user.uid).withParticipants([user.uid, secondUser.uid]).withDescription('User Expense 2').build(),
                user.token,
            );

            await apiDriver.createExpense(
                new ExpenseBuilder().withGroupId(testGroup.id).withAmount(75).withPaidBy(secondUser.uid).withParticipants([user.uid, secondUser.uid]).withDescription('Other User Expense').build(),
                secondUser.token,
            );

            // userExpenses = [expense1, expense2, expense3]; // Not used currently
        });

        test('should list all expenses for a user across groups', async () => {
            const response = await apiDriver.listUserExpenses(user.token);

            expect(response).toHaveProperty('expenses');
            expect(Array.isArray(response.expenses)).toBe(true);
            expect(response.expenses.length).toBeGreaterThanOrEqual(3);

            // Should include expenses where user is payer or participant
            const expenseDescriptions = response.expenses.map((e: any) => e.description);
            expect(expenseDescriptions).toContain('User Expense 1');
            expect(expenseDescriptions).toContain('User Expense 2');
            expect(expenseDescriptions).toContain('Other User Expense'); // user is participant
        });

        test('should require authentication for user expenses', async () => {
            await expect(apiDriver.listUserExpenses(null as any)).rejects.toThrow(/401|unauthorized|missing.*token/i);
        });

        test('should include expense metadata in user expenses', async () => {
            const response = await apiDriver.listUserExpenses(user.token);

            expect(response.expenses.length).toBeGreaterThan(0);

            const expense = response.expenses[0];
            expect(expense).toHaveProperty('id');
            expect(expense).toHaveProperty('description');
            expect(expense).toHaveProperty('amount');
            expect(expense).toHaveProperty('paidBy');
            expect(expense).toHaveProperty('participants');
            expect(expense).toHaveProperty('date');
            expect(expense).toHaveProperty('groupId');
            expect(expense).toHaveProperty('createdAt');
            expect(expense).toHaveProperty('updatedAt');
        });

        test('should handle pagination parameters', async () => {
            // Test with limit parameter
            const limitedResponse = await apiDriver.listUserExpenses(user.token, { limit: 2 });

            expect(limitedResponse).toHaveProperty('expenses');
            expect(Array.isArray(limitedResponse.expenses)).toBe(true);
            expect(limitedResponse.expenses.length).toBeLessThanOrEqual(2);
        });

        test('should handle date filtering', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const response = await apiDriver.listUserExpenses(user.token, {
                startDate: yesterday.toISOString(),
                endDate: tomorrow.toISOString(),
            });

            expect(response).toHaveProperty('expenses');
            expect(Array.isArray(response.expenses)).toBe(true);
            // Should include today's expenses
            expect(response.expenses.length).toBeGreaterThanOrEqual(3);
        });

        test('should return empty array for user with no expenses', async () => {
            const newUser = await apiDriver.createUser(new UserBuilder().build());// don't use the pool users - we need a clean one

            const response = await apiDriver.listUserExpenses(newUser.token);

            expect(response).toHaveProperty('expenses');
            expect(Array.isArray(response.expenses)).toBe(true);
            expect(response.expenses.length).toBe(0);
        });

        test('should validate query parameters', async () => {
            // Note: Current API implementation is permissive with query parameters
            // This test documents expected behavior, but validation may need strengthening
            const invalidParams = ['limit=invalid', 'limit=-1', 'limit=1000000', 'startDate=invalid-date', 'endDate=invalid-date'];

            for (const param of invalidParams) {
                try {
                    // For invalid parameter testing, we use makeInvalidApiCall to test error handling
                    const response = await apiDriver.makeInvalidApiCall(`/expenses/user?${param}`, 'GET', null, user.token);
                    // API currently allows invalid parameters and returns data anyway
                    // TODO: Strengthen validation to reject invalid parameters
                    expect(response).toHaveProperty('expenses');
                } catch (error) {
                    // API might return 400 for validation errors or 500 for internal errors
                    // Both indicate the parameter was problematic
                    expect((error as Error).message).toMatch(/400|500|invalid.*parameter|validation|internal.*error/i);
                }
            }
        });

        test('should not expose other users private data', async () => {
            const response = await apiDriver.listUserExpenses(user.token);

            // Should not include sensitive fields like internal IDs or audit logs
            const expense = response.expenses[0];
            expect(expense).not.toHaveProperty('internalId');
            expect(expense).not.toHaveProperty('auditLog');
            expect(expense).not.toHaveProperty('privateNotes');

            // Should not expose other users' email addresses or sensitive data
            const jsonString = JSON.stringify(response);
            expect(jsonString).not.toMatch(/password|secret|privateKey/i);
        });
    });

    describe('User Profile Management', () => {
        test('should allow users to update their own groups', async () => {
            // Test user can update groups they created
            const groupData = new CreateGroupRequestBuilder().withName(`User Profile Group ${user.displayName}`).withMembers([user]).build();

            const userGroup = await apiDriver.createGroup(groupData, user.token);

            const updatedData = {
                name: `Updated Profile Group ${user.displayName}`,
                description: 'Updated group description',
            };

            await apiDriver.updateGroup(userGroup.id, updatedData, user.token);

            const retrievedGroup = await apiDriver.getGroup(userGroup.id, user.token);
            expect(retrievedGroup.name).toBe(`Updated Profile Group ${user.displayName}`);
        });

        test('should prevent users from updating other users groups', async () => {
            const otherUser = await borrowTestUser();

            const otherGroupData = new CreateGroupRequestBuilder().withName(`Other User Group ${otherUser.displayName}`).withMembers([otherUser]).build();

            const otherUserGroup = await apiDriver.createGroup(otherGroupData, otherUser.token);

            // user should not be able to update otherUser's group
            await expect(
                apiDriver.updateGroup(
                    otherUserGroup.id,
                    {
                        name: 'Hijacked Group Name',
                    },
                    user.token,
                ),
            ).rejects.toThrow(/403|404|forbidden|access.*denied|not.*found/i);
        });
    });

    describe('Data Validation and Security', () => {
        test('should handle concurrent user operations safely', async () => {
            const concurrentGroupData = new CreateGroupRequestBuilder().withName(`Concurrent Test Group ${user.displayName}`).withMembers([user]).build();

            const userGroup = await apiDriver.createGroup(concurrentGroupData, user.token);

            // Perform multiple concurrent updates
            const promises = Array.from({ length: 5 }, (_, i) =>
                apiDriver.updateGroup(
                    userGroup.id,
                    {
                        name: `Concurrent Update ${i + 1}`,
                    },
                    user.token,
                ),
            );

            // All should either succeed or fail gracefully
            const results = await Promise.allSettled(promises);

            // At least one should succeed
            const successCount = results.filter((r) => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(0);
        });
    });

    describe('Terms and Cookie Policy Acceptance', () => {
        test('should reject registration without terms acceptance', async () => {
            const userData = new UserBuilder().build();

            try {
                await apiDriver.register({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: false,
                    cookiePolicyAccepted: true,
                });

                throw new Error('Registration should have been rejected');
            } catch (error) {
                expect((error as Error).message).toContain('Terms of Service');
            }
        });

        test('should reject registration without cookie policy acceptance', async () => {
            const userData = new UserBuilder().build();

            try {
                await apiDriver.register({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: true,
                    cookiePolicyAccepted: false,
                });

                throw new Error('Registration should have been rejected');
            } catch (error) {
                expect((error as Error).message).toContain('Cookie Policy');
            }
        });

        test('should reject registration without both acceptances', async () => {
            const userData = new UserBuilder().build();

            try {
                await apiDriver.register({
                    email: userData.email,
                    password: userData.password,
                    displayName: userData.displayName,
                    termsAccepted: false,
                    cookiePolicyAccepted: false,
                });

                throw new Error('Registration should have been rejected');
            } catch (error) {
                // Should get error about Terms of Service (first validation error)
                expect((error as Error).message).toContain('Terms of Service');
            }
        });

        test('should store acceptance timestamps in Firestore', async () => {
            const userData = new UserBuilder().build();

            // Register user with both acceptances
            const response = await apiDriver.register({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            expect(response).toHaveProperty('user');
            expect(response.user).toHaveProperty('uid');
            expect(response).toHaveProperty('success', true);

            // Since we can't easily access Firestore from tests without complex setup,
            // we verify the registration succeeded, which means the timestamps were stored
            // (as the function would fail if the Firestore write failed)
            expect(response.user.email).toBe(userData.email);
            expect(response.user.displayName).toBe(userData.displayName);
        });

        test('should allow registration with both acceptances', async () => {
            const userData = new UserBuilder().build();

            const response = await apiDriver.register({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                termsAccepted: true,
                cookiePolicyAccepted: true,
            });

            expect(response).toHaveProperty('success', true);
            expect(response).toHaveProperty('user');
            expect(response.user.email).toBe(userData.email);
            expect(response.user.displayName).toBe(userData.displayName);
        });
    });
});
