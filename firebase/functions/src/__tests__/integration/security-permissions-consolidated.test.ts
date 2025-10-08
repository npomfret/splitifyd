// Consolidated Security and Permissions Integration Tests
// Combines tests from security-and-permissions.test.ts, permission-edge-cases.test.ts, and security-preset-validation.integration.test.ts

import { GroupDTO, PooledTestUser, UserToken } from '@splitifyd/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, GroupUpdateBuilder, NotificationDriver, UserRegistrationBuilder } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

describe('Security and Permissions - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const firestore = getFirestore();
    const notificationDriver = new NotificationDriver(firestore);
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('API Security Headers and Infrastructure', () => {
        test('should return proper CORS and security headers', async () => {
            const url = `${apiDriver.getBaseUrl()}/health`;

            // Test CORS headers
            const corsResponse = await fetch(url, {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization',
                },
            });

            expect(corsResponse.status).toBe(204);
            expect(corsResponse.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
            expect(corsResponse.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
            expect(corsResponse.headers.get('Access-Control-Allow-Headers')).toBeTruthy();

            // Test security headers
            const securityResponse = await fetch(url);
            expect(securityResponse.status).toBe(200);
            expect(securityResponse.headers.get('X-Content-Type-Options')).toBeTruthy();
            expect(securityResponse.headers.get('X-Frame-Options')).toBeTruthy();
            expect(securityResponse.headers.get('X-XSS-Protection')).toBeTruthy();
        });
    });

    describe('Authentication Security and Token Validation', () => {
        test('should reject requests with invalid authentication tokens', async () => {
            // No token
            await expect(apiDriver.listGroups(null as any)).rejects.toThrow(/401|unauthorized|missing.*token/i);

            // Malformed tokens
            const malformedTokens = ['not-a-jwt-token', 'Bearer invalid', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid', 'header.payload.invalid-signature', '', '   '];

            for (const token of malformedTokens) {
                await expect(apiDriver.listGroups(token)).rejects.toThrow(/401|unauthorized|invalid.*token/i);
            }
        });

        test('should reject expired and cross-project tokens', async () => {
            // Expired token (from 2020)
            const expiredToken =
                'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc3BsaXRpZnlkIiwiYXVkIjoic3BsaXRpZnlkIiwiYXV0aF90aW1lIjoxNjA5NDU5MjAwLCJ1c2VyX2lkIjoidGVzdC11c2VyIiwic3ViIjoidGVzdC11c2VyIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk0NjI4MDB9.invalid-signature';
            await expect(apiDriver.listGroups(expiredToken)).rejects.toThrow(/401|unauthorized|expired|invalid/i);

            // Wrong project token
            const wrongProjectToken =
                'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyN2JmNDk2MmJkY2ZlODdlOGQ1ZWNhM2Y3N2JjOWZjYzA0OWMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vd3JvbmctcHJvamVjdCIsImF1ZCI6Indyb25nLXByb2plY3QiLCJhdXRoX3RpbWUiOjE2MDk0NTkyMDAsInVzZXJfaWQiOiJ0ZXN0LXVzZXIiLCJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6OTk5OTk5OTk5OX0.invalid-signature';
            await expect(apiDriver.listGroups(wrongProjectToken)).rejects.toThrow(/401|unauthorized|invalid|audience/i);
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
            await expect(apiDriver.getGroupFullDetails(privateGroup.id, users[1].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|not.*member/i);

            await expect(apiDriver.getGroupBalances(privateGroup.id, users[1].token)).rejects.toThrow(/404|not.*found|403|forbidden|access.*denied|not.*member/i);

            // Non-member should not be able to modify group
            await expect(apiDriver.updateGroup(testGroup.id, new GroupUpdateBuilder().withName('Hacked Name').build(), users[2].token)).rejects.toThrow(
                /404|not.*found|403|forbidden|access.*denied/i,
            );

            // Member (not owner) should not be able to delete group
            await expect(apiDriver.deleteGroup(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden|unauthorized|access.*denied/i);
        });

        test('should prevent unauthorized access to expenses', async () => {
            // Create expense excluding user 2
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Private Expense')
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Group member but not expense participant should be denied
            await expect(apiDriver.getExpense(expense.id, users[2].token)).rejects.toThrow(/403|forbidden|not.*participant|access.*denied/i);

            // Non-group member should be denied
            await expect(apiDriver.getExpense(expense.id, users[3].token)).rejects.toThrow(/403|forbidden|not.*participant|access.*denied/i);
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
                .withAmount(50)
                .withCurrency('USD')
                .withPaidBy(users[3].uid)
                .withParticipants([users[3].uid])
                .withSplitType('equal')
                .build();

            await expect(apiDriver.createExpense(expenseData, users[3].token)).rejects.toThrow(/failed with status 403/);

            // Non-member cannot access group expenses
            await expect(apiDriver.getGroupExpenses(edgeTestGroup.id, users[3].token)).rejects.toThrow(/failed with status (403|404)/);

            // Non-member cannot update group settings
            await expect(apiDriver.updateGroup(edgeTestGroup.id, { name: 'Hacked Name' }, users[3].token)).rejects.toThrow(/failed with status (403|404)/);
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
            await apiDriver.updateGroup(roleTestGroup.id, { name: 'Updated by Admin' }, adminUser.token);

            const { group: updatedGroup } = await apiDriver.getGroupFullDetails(roleTestGroup.id, adminUser.token);
            expect(updatedGroup.name).toBe('Updated by Admin');

            // Member cannot update group settings (depends on group permissions)
            await expect(apiDriver.updateGroup(roleTestGroup.id, { name: 'Hacked by Member' }, memberUser.token)).rejects.toThrow(/failed with status (403|404)/);
        });
    });

    describe('Security Preset Validation and Data Integrity', () => {
        test('should handle groups with invalid security preset data gracefully', async () => {
            // Create test user
            const testUser = await apiDriver.createUser(new UserRegistrationBuilder().withEmail(`test-invalid-${Date.now()}@test.com`).withDisplayName('Test User Invalid').build());

            // Create valid group first
            await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Valid Group Test ' + Date.now())
                    .withDescription('Testing valid security preset')
                    .build(),
                testUser.token,
            );

            // Insert group with invalid securityPreset directly via Firestore
            const invalidGroupId = 'invalid-group-' + Date.now();
            await firestore
                .collection('groups')
                .doc(invalidGroupId)
                .set({
                    id: invalidGroupId,
                    name: 'Invalid Security Preset Group',
                    description: 'Group with invalid security preset',
                    securityPreset: 'unknown', // Invalid value
                    createdBy: testUser.uid,
                    members: {
                        [testUser.uid]: {
                            role: 'admin',
                            status: 'active',
                            joinedAt: new Date().toISOString(),
                            color: {
                                light: '#FF6B6B',
                                dark: '#FF6B6B',
                                name: 'red',
                                pattern: 'solid',
                                colorIndex: 0,
                            },
                        },
                    },
                    permissions: {
                        expenseEditing: 'anyone',
                        expenseDeletion: 'anyone',
                        memberInvitation: 'anyone',
                        memberApproval: 'automatic',
                        settingsManagement: 'anyone',
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

            // API should handle invalid data gracefully
            const listResponse = await apiDriver.listGroups(testUser.token);
            expect(listResponse).toBeDefined();
            expect(listResponse.groups).toBeDefined();
        });

        test('should successfully handle multiple groups', async () => {
            const testUser = await apiDriver.createUser(new UserRegistrationBuilder().withEmail(`test-valid-${Date.now()}@test.com`).withDisplayName('Test User Valid').build());

            // Create multiple valid groups
            const validGroups: GroupDTO[] = [];
            for (let i = 0; i < 3; i++) {
                const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Valid Group ${i} - ${Date.now()}`).withDescription(`Valid group ${i}`).build(), testUser.token);
                validGroups.push(group);
            }

            // Fetch groups list should work without issues
            const listResponse = await apiDriver.listGroups(testUser.token);
            expect(listResponse.groups.length).toBeGreaterThanOrEqual(3);

            // Verify all groups were created
            const createdGroupIds = validGroups.map((g) => g.id);
            const listedGroupIds = listResponse.groups.map((g) => g.id);

            for (const groupId of createdGroupIds) {
                expect(listedGroupIds).toContain(groupId);
            }
        });
    });

    describe('Authentication Requirements and Boundary Testing', () => {
        test('should require authentication for all protected endpoints', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Auth Test', [users[0]], users[0].token);

            // Test multiple endpoints require authentication
            const endpoints = [
                () => apiDriver.listGroups(''),
                () => apiDriver.getGroupFullDetails(testGroup.id, ''),
                () => apiDriver.getGroupBalances(testGroup.id, ''),
                () => apiDriver.getGroupExpenses(testGroup.id, ''),
                () => apiDriver.updateGroup(testGroup.id, new GroupUpdateBuilder().withName('New Name').build(), ''),
            ];

            for (const endpoint of endpoints) {
                await expect(endpoint()).rejects.toThrow(/401|unauthorized|authentication/i);
            }
        });

        test('should handle concurrent permission checks correctly', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Concurrent Test', [users[0], users[1]], users[0].token);

            // Concurrent access attempts by different users
            const concurrentRequests = [
                apiDriver.getGroupFullDetails(testGroup.id, users[0].token), // Should succeed
                apiDriver.getGroupFullDetails(testGroup.id, users[1].token), // Should succeed
                apiDriver.getGroupFullDetails(testGroup.id, users[2].token).catch(() => 'FAILED'), // Should fail
                apiDriver.getGroupFullDetails(testGroup.id, users[3].token).catch(() => 'FAILED'), // Should fail
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
