// Consolidated Security and Permissions Integration Tests
// Combines tests from security-and-permissions.test.ts, permission-edge-cases.test.ts, and security-preset-validation.integration.test.ts

import { GroupDTO, PooledTestUser, UserToken } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, GroupUpdateBuilder } from '@billsplit-wl/test-support';
import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe('Security and Permissions - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
    });

    describe('API Health Check', () => {
        test('should return healthy status from health endpoint', async () => {
            const health = await apiDriver.getHealth();
            expect(health.status).toBe('healthy');
            expect(health.timestamp).toBeDefined();
            expect(health.checks).toBeDefined();
            expect(health.checks.firestore).toBeDefined();
            expect(health.checks.auth).toBeDefined();
        });
    });

    describe('Authentication Security and Token Validation', () => {
        test('should reject requests with invalid authentication tokens', async () => {
            // No token - may get ECONNRESET if emulator resets connection
            await expect(apiDriver.listGroups(undefined, null as any)).rejects.toThrow(/401|unauthorized|missing.*token|AUTH_REQUIRED|ECONNRESET/i);

            // Malformed tokens - may get connection resets or header validation errors
            const malformedTokens = ['not-a-jwt-token', 'Bearer invalid', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid', 'header.payload.invalid-signature', '', '   '];

            for (const token of malformedTokens) {
                await expect(apiDriver.listGroups(undefined, token)).rejects.toThrow(/401|unauthorized|invalid.*token|AUTH_REQUIRED|AUTH_INVALID|ECONNRESET|Cache-Control/i);
            }
        });

        test('should reject expired and cross-project tokens', async () => {
            // Expired token (from 2020) - may get connection resets or header validation errors
            const expiredToken =
                'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc3BsaXRpZnlkIiwiYXVkIjoic3BsaXRpZnlkIiwiYXV0aF90aW1lIjoxNjA5NDU5MjAwLCJ1c2VyX2lkIjoidGVzdC11c2VyIiwic3ViIjoidGVzdC11c2VyIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NjI4MDB9.invalid-signature';
            await expect(apiDriver.listGroups(undefined, expiredToken)).rejects.toThrow(/401|unauthorized|expired|invalid|AUTH_INVALID|ECONNRESET|Cache-Control/i);

            // Wrong project token
            const wrongProjectToken =
                'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vd3JvbmctcHJvamVjdCIsImF1ZCI6Indyb25nLXByb2plY3QiLCJhdXRoX3RpbWUiOjE2MDk0NTkyMDAsInVzZXJfaWQiOiJ0ZXN0LXVzZXIiLCJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6OTk5OTk5OTk5OX0.invalid-signature';
            await expect(apiDriver.listGroups(undefined, wrongProjectToken)).rejects.toThrow(/401|unauthorized|invalid|audience|AUTH_INVALID|ECONNRESET|Cache-Control/i);
        });
    });

    describe('Cross-User Data Access Control', () => {
        let testGroup: GroupDTO;

        beforeEach(async () => {
            testGroup = await apiDriver.createGroupWithMembers(`Access Control Test ${uuidv4()}`, [users[0], users[1]], users[0].token);
        });

        test('should prevent unauthorized access to groups', async () => {
            // Create private group for user 0 only
            const privateGroup = await apiDriver.createGroupWithMembers(`Private Group ${uuidv4()}`, [users[0]], users[0].token);

            // User 1 should not be able to access (returns 404 for security)
            await expect(apiDriver.getGroupFullDetails(privateGroup.id, undefined, users[1].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|not.*member|NOT_FOUND|FORBIDDEN/i);

            await expect(apiDriver.getGroupBalances(privateGroup.id, users[1].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|not.*member|NOT_FOUND|FORBIDDEN/i);

            // Non-member should not be able to modify group
            await expect(apiDriver.updateGroup(
                testGroup.id,
                new GroupUpdateBuilder()
                    .withName('Hacked Name')
                    .build(),
                users[2].token,
            ))
                .rejects
                .toThrow(
                    /404|not.*found|403|forbidden|access.*denied|NOT_FOUND|FORBIDDEN/i,
                );

            // Member (not owner) should not be able to delete group
            await expect(apiDriver.deleteGroup(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden|unauthorized|access.*denied|FORBIDDEN/i);
        });

        test('should restrict expense access to group members only', async () => {
            // Create expense with user 0 and user 1
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Group Expense')
                .withAmount(100, 'USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Group members (expense participants) can view
            const byParticipant = await apiDriver.getExpense(expense.id, users[0].token);
            expect(byParticipant.id).toBe(expense.id);

            // Non-group members should NOT be able to view (security)
            await expect(apiDriver.getExpense(expense.id, users[2].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|NOT_FOUND|FORBIDDEN/i);
            await expect(apiDriver.getExpense(expense.id, users[3].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|NOT_FOUND|FORBIDDEN/i);
        });
    });

    describe('Non-Member Access Attempts and Edge Cases', () => {
        let edgeTestGroup: GroupDTO;

        beforeEach(async () => {
            edgeTestGroup = await apiDriver.createGroupWithMembers(`Edge Test ${uuidv4()}`, users.slice(0, 2), users[0].token);
        });

        test('should prevent non-members from performing group operations', async () => {
            // Non-member cannot create expenses
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(edgeTestGroup.id)
                .withDescription('Non-member attempt')
                .withAmount(50, 'USD')
                .withPaidBy(users[3].uid)
                .withParticipants([users[3].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[3].token)).rejects.toThrow(/failed with status 403/);

            // Non-member cannot access group expenses
            await expect(apiDriver.getGroupExpenses(edgeTestGroup.id, users[3].token)).rejects.toThrow(/failed with status (403|404)/);

            // Non-member cannot update group settings
            await expect(
                apiDriver.updateGroup(
                    edgeTestGroup.id,
                    new GroupUpdateBuilder()
                        .withName('Hacked Name')
                        .build(),
                    users[3].token,
                ),
            )
                .rejects
                .toThrow(/failed with status (403|404)/);
        });
    });

    describe('Permission System and Role Management', () => {
        let roleTestGroup: GroupDTO;
        let adminUser: UserToken;
        let memberUser: UserToken;

        beforeEach(async () => {
            [adminUser, memberUser] = users;
            roleTestGroup = await apiDriver.createGroupWithMembers('Role Test Group', [adminUser, memberUser], adminUser.token);
        });

        test('should enforce authorization for group updates', async () => {
            // Admin can update group
            await apiDriver.updateGroup(
                roleTestGroup.id,
                new GroupUpdateBuilder()
                    .withName('Updated by Admin')
                    .build(),
                adminUser.token,
            );

            const { group: updatedGroup } = await apiDriver.getGroupFullDetails(roleTestGroup.id, undefined, adminUser.token);
            expect(updatedGroup.name).toBe('Updated by Admin');

            // Member cannot update group settings (depends on group permissions)
            await expect(
                apiDriver.updateGroup(
                    roleTestGroup.id,
                    new GroupUpdateBuilder()
                        .withName('Hacked by Member')
                        .build(),
                    memberUser.token,
                ),
            )
                .rejects
                .toThrow(/failed with status (403|404)/);
        });
    });
    describe('Authentication Requirements and Boundary Testing', () => {
        test('should require authentication for all protected endpoints', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Auth Test', [users[0]], users[0].token);

            // Test multiple endpoints require authentication
            // Note: May get ECONNRESET if emulator resets connection on unauthenticated requests
            const endpoints = [
                () => apiDriver.listGroups(undefined, ''),
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, ''),
                () => apiDriver.getGroupBalances(testGroup.id, ''),
                () => apiDriver.getGroupExpenses(testGroup.id, ''),
                () =>
                    apiDriver.updateGroup(
                        testGroup.id,
                        new GroupUpdateBuilder()
                            .withName('New Name')
                            .build(),
                        '',
                    ),
            ];

            for (const endpoint of endpoints) {
                await expect(endpoint()).rejects.toThrow(/401|unauthorized|authentication|AUTH_REQUIRED|ECONNRESET|Cache-Control/i);
            }
        });

        test('should handle concurrent permission checks correctly', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Concurrent Test', [users[0], users[1]], users[0].token);

            // Concurrent access attempts by different users
            const concurrentRequests = [
                apiDriver.getGroupFullDetails(testGroup.id, undefined, users[0].token), // Should succeed
                apiDriver.getGroupFullDetails(testGroup.id, undefined, users[1].token), // Should succeed
                apiDriver.getGroupFullDetails(testGroup.id, undefined, users[2].token).catch(() => 'FAILED'), // Should fail
                apiDriver.getGroupFullDetails(testGroup.id, undefined, users[3].token).catch(() => 'FAILED'), // Should fail
            ];

            const results = await Promise.all(concurrentRequests);

            // First two should succeed, last two should fail
            expect(results[0]).toHaveProperty('group');
            expect(results[1]).toHaveProperty('group');
            expect(results[2]).toBe('FAILED');
            expect(results[3]).toBe('FAILED');
        });
    });
});
