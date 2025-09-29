import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, SettlementBuilder, GroupUpdateBuilder, borrowTestUsers, generateShortId, NotificationDriver } from '@splitifyd/test-support';
import { PooledTestUser, FirestoreCollections, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { getAuth, getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';
import { FirestoreReader } from '../../services/firestore';
import { getTopLevelMembershipDocId } from '../../utils/groupMembershipHelpers';

describe('Groups Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth());
    const groupService = applicationBuilder.buildGroupService();
    const groupMemberService = applicationBuilder.buildGroupMemberService();
    const groupShareService = applicationBuilder.buildGroupShareService();
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    describe('Group Creation and Basic Operations', () => {
        // NOTE: Group creation business logic (validation, default settings, permissions)
        // is now comprehensively tested in unit tests: GroupService.test.ts
        // This integration test focuses only on API endpoint and Firebase Auth integration
        test('should create groups via API with proper authentication', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withDescription('A test group for API testing').build();

            // Test API creation with authentication
            const apiResponse = await apiDriver.createGroup(groupData, users[0].token);
            expect(apiResponse.id).toBeDefined();
            expect(apiResponse.name).toBe(groupData.name);
            expect(apiResponse.description).toBe(groupData.description);
            expect(apiResponse.createdBy).toBe(users[0].uid);

            // Test immediate balance access via API
            const balances = await apiDriver.getGroupBalances(apiResponse.id, users[0].token);
            expect(balances.groupId).toBe(apiResponse.id);
            expect(balances.balancesByCurrency).toBeDefined();
        });

        // NOTE: Group validation logic is now comprehensively tested in unit tests:
        // GroupService.test.ts - This integration test focuses on Firebase Auth integration only
        test('should require authentication for group creation', async () => {
            await expect(apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Test')
                    .build(),
                ''
            )).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('Group Retrieval and Access Control', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Get Test Group ${uuidv4()}`).build();
            testGroup = await apiDriver.createGroup(groupData, users[0].token);
        });

        test('should retrieve group details with proper structure', async () => {
            // Test basic retrieval
            const { group, members, balances } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            expect(group.id).toBe(testGroup.id);
            expect(group.name).toBe(testGroup.name);
            expect(members.members).toHaveLength(1);
            expect(balances.balancesByCurrency).toBeDefined();

            // Test with expenses for balance verification
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();
            await apiDriver.createExpense(expenseData, users[0].token);

            const { balances: updatedBalances } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(updatedBalances.balancesByCurrency).toBeDefined();
        });

        test('should enforce proper access control', async () => {
            // Non-existent group
            await expect(apiDriver.getGroupFullDetails('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);

            // Non-member access (returns 404 for security - doesn't reveal group existence)
            await expect(apiDriver.getGroupFullDetails(testGroup.id, users[1].token)).rejects.toThrow(/404|not found/i);

            // Unauthenticated access
            await expect(apiDriver.getGroupFullDetails(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);

            // Member access should work
            const multiMemberGroup = await apiDriver.createGroupWithMembers(`Shared Group ${uuidv4()}`, [users[0], users[1]], users[0].token);

            const { group: groupFromUser0 } = await apiDriver.getGroupFullDetails(multiMemberGroup.id, users[0].token);
            const { group: groupFromUser1 } = await apiDriver.getGroupFullDetails(multiMemberGroup.id, users[1].token);

            expect(groupFromUser0.id).toBe(multiMemberGroup.id);
            expect(groupFromUser1.id).toBe(multiMemberGroup.id);
        });
    });

    describe('Group Sharing and Invitations', () => {
        test('should handle complete sharing workflow', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Share Test Group ${uuidv4()}`, [users[0]], users[0].token);

            // Generate share link
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);

            // Test member permissions for sharing
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);
            const memberShareResponse = await apiDriver.generateShareLink(testGroup.id, users[1].token);
            expect(memberShareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);

            // Test non-member restriction
            await expect(apiDriver.generateShareLink(testGroup.id, users[2].token)).rejects.toThrow(/status 403.*UNAUTHORIZED/);

            // Test joining workflow
            const newUser = users[3];
            const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

            expect(joinResponse.groupId).toBe(testGroup.id);
            expect(joinResponse.success).toBe(true);
            expect(joinResponse.groupName).toBeDefined();

            // Verify user was added
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, newUser.token);
            const addedMember = members.members.find((m) => m.uid === newUser.uid);
            expect(addedMember).toBeDefined();

            // Test duplicate joining prevention
            await expect(apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token)).rejects.toThrow(/ALREADY_MEMBER/);

            // Test invalid share token
            await expect(apiDriver.joinGroupViaShareLink('INVALID_TOKEN_12345', users[2].token)).rejects.toThrow(/status 404.*INVALID_LINK/);
        });

        test('should support multiple users joining via same link', async () => {
            const multiJoinGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Multi Join Group ${uuidv4()}`).build(), users[0].token);

            const shareResponse = await apiDriver.generateShareLink(multiJoinGroup.id, users[0].token);
            const newUsers = users.slice(1, 4); // Users 1, 2, 3

            // All users join using same link
            for (const user of newUsers) {
                const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user.token);
                expect(joinResponse.groupId).toBe(multiJoinGroup.id);
            }

            // Verify all users were added
            const { members } = await apiDriver.getGroupFullDetails(multiJoinGroup.id, users[0].token);
            expect(members.members.length).toBe(4); // Original + 3 new members

            newUsers.forEach((user) => {
                const addedMember = members.members.find((m) => m.uid === user.uid);
                expect(addedMember).toBeDefined();
            });
        });
    });

    describe('Group Management Operations', () => {
        let testGroup: any;

        beforeEach(async () => {
            testGroup = await apiDriver.createGroupWithMembers(`Management Test Group ${generateShortId()}`, [users[0], users[1]], users[0].token);
        });

        // NOTE: Group update business logic, validation, and authorization are now tested in unit tests: GroupService.test.ts
        // This integration test focuses on API endpoints and Firebase transaction behavior
        test('should handle group updates via API with transaction consistency', async () => {
            const updateData = new GroupUpdateBuilder()
                .withName('Updated Group Name API')
                .withDescription('Updated via API')
                .build();

            // Test API update endpoint with authentication
            const result = await apiDriver.updateGroup(testGroup.id, updateData, users[0].token);
            expect(result.message).toBeDefined();

            // Verify update was persisted via API
            const { group: updatedGroup } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(updatedGroup.name).toBe('Updated Group Name API');
            expect(updatedGroup.description).toBe('Updated via API');
        });

        test('should handle group deletion with cascade', async () => {
            // Add expenses to test cascade deletion
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder().withGroupId(testGroup.id).withPaidBy(users[0].uid).withParticipants([users[0].uid, users[1].uid]).withAmount(50).withSplitType('equal').build(),
                users[0].token,
            );

            // Owner should be able to delete
            const result = await groupService.deleteGroup(testGroup.id, users[0].uid);
            expect(result.message).toBe('Group and all associated data deleted permanently');

            // Verify both group and expense were deleted
            const deletedGroup = await firestoreReader.getGroup(testGroup.id);
            expect(deletedGroup).toBeNull();

            const deletedExpense = await firestoreReader.getExpense(expense.id);
            expect(deletedExpense).toBeNull();

            // Non-owner should not be able to delete
            const anotherGroup = await apiDriver.createGroupWithMembers('Delete Test', [users[0], users[1]], users[0].token);
            await expect(groupService.deleteGroup(anotherGroup.id, users[1].uid)).rejects.toThrow();
        });
    });

    describe('Full Details API Integration', () => {
        test('should return consolidated data with pagination', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Full Details Test ${uuidv4()}`, [users[0], users[1], users[2]], users[0].token);

            // Add test data
            const uniqueId = generateShortId();
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Full details test ${uniqueId}`)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            await apiDriver.createSettlement(
                new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[1].uid).withPayee(users[0].uid).withAmount(20).withNote(`Settlement test ${uniqueId}`).build(),
                users[1].token,
            );

            // Test consolidated endpoint structure
            const fullDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            expect(fullDetails).toHaveProperty('group');
            expect(fullDetails).toHaveProperty('members');
            expect(fullDetails).toHaveProperty('expenses');
            expect(fullDetails).toHaveProperty('balances');
            expect(fullDetails).toHaveProperty('settlements');

            expect(fullDetails.group.id).toBe(testGroup.id);
            expect(fullDetails.members.members).toHaveLength(3);
            expect(fullDetails.expenses.expenses.length).toBeGreaterThanOrEqual(1);
            expect(fullDetails.settlements.settlements.length).toBeGreaterThanOrEqual(1);

            // Test pagination parameters
            const limitedDetails = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token, {
                expenseLimit: 5,
                settlementLimit: 3,
            });

            expect(limitedDetails.expenses).toHaveProperty('hasMore');
            expect(limitedDetails.settlements).toHaveProperty('hasMore');
        });

        test('should maintain consistency across individual and consolidated endpoints', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Consistency Test', [users[0], users[1]], users[0].token);

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Consistency test expense')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Get data from both endpoints
            const [fullDetails, expenses, balances] = await Promise.all([
                apiDriver.getGroupFullDetails(testGroup.id, users[0].token),
                apiDriver.getGroupExpenses(testGroup.id, users[0].token),
                apiDriver.getGroupBalances(testGroup.id, users[0].token),
            ]);

            // Verify consistency
            expect(fullDetails.expenses.expenses).toEqual(expenses.expenses);
            expect(fullDetails.balances.groupId).toBe(balances.groupId);
            expect(fullDetails.members.members).toHaveLength(2);
        });
    });

    describe('Concurrent Operations and Optimistic Locking', () => {
        test('should handle concurrent group joins correctly', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Concurrent Join Test ${uuidv4()}`).withDescription('Testing concurrent joins').build(),
                users[0].token,
            );

            // Generate share link
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);

            // Both users try to join simultaneously
            const joinPromises = [apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token), apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token)];

            const results = await Promise.allSettled(joinPromises);

            // Both should succeed or handle conflicts gracefully
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            if (failures.length > 0) {
                expect(successes.length).toBeGreaterThan(0);
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorCode = failure.reason?.response?.data?.error?.code;
                        expect(['CONCURRENT_UPDATE', 'ALREADY_MEMBER']).toContain(errorCode);
                    }
                }
            } else {
                expect(successes.length).toBe(2);
            }

            // Verify final state - both users should be members
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(members.members.length).toBe(3);
            expect(members.members.find((m) => m.uid === users[1].uid)).toBeDefined();
            expect(members.members.find((m) => m.uid === users[2].uid)).toBeDefined();
        });

        test('should prevent concurrent group updates with proper conflict resolution', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Concurrent Update Test ${uuidv4()}`).withDescription('Testing concurrent updates').build(),
                users[0].token,
            );

            // Add second user as member
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Same user tries multiple concurrent updates
            const updatePromises = [
                apiDriver.updateGroup(testGroup.id, new GroupUpdateBuilder().withName('First Update').build(), users[0].token),
                apiDriver.updateGroup(testGroup.id, new GroupUpdateBuilder().withName('Second Update').build(), users[0].token),
                apiDriver.updateGroup(testGroup.id, new GroupUpdateBuilder().withDescription('Updated description').build(), users[0].token),
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThanOrEqual(1);

            // Check failure reasons for optimistic locking conflicts
            for (const failure of failures) {
                if (failure.status === 'rejected') {
                    const errorMessage = failure.reason?.message || '';
                    const errorCode = failure.reason?.response?.data?.error?.code;
                    const isValidConcurrencyError = errorMessage.match(/concurrent|conflict|version|timestamp|CONCURRENT_UPDATE/i) || errorCode === 'CONCURRENT_UPDATE';
                    expect(isValidConcurrencyError).toBeTruthy();
                }
            }

            // Verify final state integrity
            const { group: finalGroup } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(finalGroup.name === 'First Update' || finalGroup.name === 'Second Update' || finalGroup.description === 'Updated description').toBeTruthy();
        });

        test('should handle concurrent expense operations', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Expense Locking Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            // Create an expense first
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Test Expense')
                    .withAmount(100)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Try concurrent expense updates
            const updatePromises = [apiDriver.updateExpense(expense.id, { amount: 200 }, users[0].token), apiDriver.updateExpense(expense.id, { amount: 300 }, users[0].token)];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            const conflicts = results.filter(
                (r) =>
                    r.status === 'rejected' &&
                    (r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE' || r.reason?.message?.includes('CONCURRENT_UPDATE') || r.reason?.message?.includes('409')),
            );

            expect(successes.length).toBeGreaterThan(0);

            if (failures.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state
            const expenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);
            const updatedExpense = expenses.expenses.find((e: any) => e.id === expense.id);
            expect([200, 300]).toContain(updatedExpense?.amount);
        });

        test('should handle concurrent expense deletion and modification', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Expense Delete Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Test Expense for Deletion')
                    .withAmount(50)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Try concurrent delete and update
            const promises = [apiDriver.deleteExpense(expense.id, users[0].token), apiDriver.updateExpense(expense.id, { amount: 75 }, users[0].token)];

            const results = await Promise.allSettled(promises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            expect(successes.length).toBeGreaterThanOrEqual(1);

            if (failures.length > 0) {
                for (const failure of failures) {
                    if (failure.status === 'rejected') {
                        const errorMessage = failure.reason?.message || '';
                        expect(errorMessage).toMatch(/not found|concurrent|conflict|does not exist/i);
                    }
                }
            }

            // Verify final state - expense is either deleted or updated
            try {
                const remainingExpense = await apiDriver.getExpense(expense.id, users[0].token);
                expect(remainingExpense.amount).toBe(75);
            } catch (error: any) {
                expect(error.message).toMatch(/not found|does not exist/i);
            }
        });

        test('should handle concurrent settlement operations', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Settlement Test ${uuidv4()}`, [users[0], users[1]], users[0].token);

            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder().withGroupId(testGroup.id).withPayer(users[0].uid).withPayee(users[1].uid).withAmount(50).withNote('Test settlement').build(),
                users[0].token,
            );

            // Try concurrent settlement updates
            const updatePromises = [apiDriver.updateSettlement(settlement.id, { amount: 75 }, users[0].token), apiDriver.updateSettlement(settlement.id, { amount: 100 }, users[0].token)];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const conflicts = results.filter((r) => r.status === 'rejected' && r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE');

            expect(successes.length).toBeGreaterThan(0);

            if (results.length - successes.length > 0) {
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Verify final state
            const updatedSettlement = await apiDriver.getSettlement(testGroup.id, settlement.id, users[0].token);
            expect([75, 100]).toContain(updatedSettlement?.amount);
        });

        test('should handle cross-entity race conditions', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Cross-Entity Race Test ${uuidv4()}`).withDescription('Testing cross-entity race conditions').build(),
                users[0].token,
            );

            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);

            // User joins while expense is being created simultaneously
            const promises = [
                apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withDescription('Race condition expense')
                        .withAmount(100)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid])
                        .withSplitType('equal')
                        .build(),
                    users[0].token,
                ),
            ];

            const results = await Promise.allSettled(promises);

            // Both operations should succeed independently
            for (const result of results) {
                expect(result.status).toBe('fulfilled');
            }

            // Verify final state
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            const expenses = await apiDriver.getGroupExpenses(testGroup.id, users[0].token);

            expect(members.members.find((m) => m.uid === users[1].uid)).toBeDefined();
            expect(expenses.expenses.length).toBe(1);
            expect(expenses.expenses[0].description).toBe('Race condition expense');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle malformed input gracefully', async () => {
            // Test malformed input handling
            const groupData = new CreateGroupRequestBuilder().withName('').build();

            try {
                await groupService.createGroup(users[0].uid, groupData);
                throw new Error('should not get here - invalid group was created');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }
        });

        test('should enforce security consistently', async () => {
            const testGroup = await apiDriver.createGroupWithMembers('Security Test', [users[0], users[1]], users[0].token);

            // Non-member should get NOT_FOUND (not FORBIDDEN) for security
            await expect(groupService.getGroupFullDetails(testGroup.id, users[2].uid)).rejects.toThrow();

            // Member should have read access but not write access
            const memberResult = await groupService.getGroupFullDetails(testGroup.id, users[1].uid);
            expect(memberResult.group.id).toBe(testGroup.id);

            await expect(groupService.updateGroup(testGroup.id, users[1].uid,
                new GroupUpdateBuilder().withName('Hacked Name').build()
            )).rejects.toThrow();
            await expect(groupService.deleteGroup(testGroup.id, users[1].uid)).rejects.toThrow();
        });
    });

    describe('Group Member Management and Operations', () => {
        // Helper function to create a group with multiple members
        const createGroupWithMembers = async (driver: ApiDriver, users: any[]): Promise<string> => {
            const groupData = new CreateGroupRequestBuilder().withName(`Member Test Group ${uuidv4()}`).withDescription('Test group for member operations').build();

            const group = await driver.createGroup(groupData, users[0].token);

            // Add additional members to the group via share link
            if (users.length > 1) {
                const shareResponse = await driver.generateShareLink(group.id, users[0].token);
                for (let i = 1; i < users.length; i++) {
                    await driver.joinGroupViaShareLink(shareResponse.linkId, users[i].token);
                }
            }

            return group.id;
        };

        describe('Member Information and Retrieval', () => {
            test('should return all group members via getGroupFullDetails', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);

                const response = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);

                expect(response.members).toMatchObject({
                    members: expect.arrayContaining([
                        expect.objectContaining({ uid: testUsers[0].uid }),
                        expect.objectContaining({ uid: testUsers[1].uid }),
                        expect.objectContaining({ uid: testUsers[2].uid }),
                    ]),
                });
                expect(response.members.members.length).toBe(3);
            });

            test('should return members sorted alphabetically', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);

                const response = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);

                const displayNames = response.members.members.map((m: any) => m.displayName);
                const sortedNames = [...displayNames].sort((a, b) => a.localeCompare(b));
                expect(displayNames).toEqual(sortedNames);
            });

            test('should enforce authentication for member access', async () => {
                const testUsers = users.slice(0, 1);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);

                await expect(apiDriver.getGroupFullDetails(groupId, 'invalid-token')).rejects.toThrow();
            });

            test('should enforce member access control', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, [testUsers[0]]);
                const nonMember = testUsers[1];

                await expect(apiDriver.getGroupFullDetails(groupId, nonMember.token)).rejects.toThrow();
            });
        });

        describe('Member Leaving Operations', () => {
            test('should allow a member to leave the group', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const memberToLeave = testUsers[1];

                const response = await apiDriver.leaveGroup(groupId, memberToLeave.token);

                expect(response).toEqual({
                    success: true,
                    message: 'Successfully left the group',
                });

                // Verify member was removed
                const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);
                expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).not.toContain(memberToLeave.uid);
                expect(fullDetailsResponse.members.members.length).toBe(2);
            });

            test('should update timestamps when leaving', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const memberToLeave = testUsers[1];

                // Get group info before leaving
                const { group: groupBefore } = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);

                await apiDriver.leaveGroup(groupId, memberToLeave.token);

                // Verify timestamps were updated
                const { group: groupAfter } = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);
                expect(new Date(groupAfter.updatedAt).getTime()).toBeGreaterThan(new Date(groupBefore.updatedAt).getTime());
            });
        });

        describe('Member Removal Operations', () => {
            test('should allow creator to remove a member', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const creator = testUsers[0];
                const memberToRemove = testUsers[1];

                const response = await apiDriver.removeGroupMember(groupId, memberToRemove.uid, creator.token);

                expect(response).toEqual({
                    success: true,
                    message: 'Member removed successfully',
                });

                // Verify member was removed
                const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, creator.token);
                expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).not.toContain(memberToRemove.uid);
                expect(fullDetailsResponse.members.members.length).toBe(2);
            });
        });

        describe('Complex Member Management Scenarios', () => {
            test('should handle multiple members leaving sequentially', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const member1 = testUsers[1];
                const member2 = testUsers[2];

                // First member leaves
                await apiDriver.leaveGroup(groupId, member1.token);

                // Second member leaves
                await apiDriver.leaveGroup(groupId, member2.token);

                // Verify only creator remains
                const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, testUsers[0].token);
                expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).toEqual([testUsers[0].uid]);
                expect(fullDetailsResponse.members.members.length).toBe(1);
            });

            test('should prevent access after leaving group', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const memberToLeave = testUsers[1];

                // Member leaves
                await apiDriver.leaveGroup(groupId, memberToLeave.token);

                // Try to access group details after leaving
                await expect(apiDriver.getGroupFullDetails(groupId, memberToLeave.token)).rejects.toThrow();
            });

            test('should handle mixed leave and remove operations', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const creator = testUsers[0];
                const member1 = testUsers[1];
                const member2 = testUsers[2];

                // Creator removes member1
                await apiDriver.removeGroupMember(groupId, member1.uid, creator.token);

                // Member2 leaves voluntarily
                await apiDriver.leaveGroup(groupId, member2.token);

                // Verify only creator remains
                const fullDetailsResponse = await apiDriver.getGroupFullDetails(groupId, creator.token);
                expect(fullDetailsResponse.members.members.map((m: any) => m.uid)).toEqual([creator.uid]);
                expect(fullDetailsResponse.members.members.length).toBe(1);
            });
        });
    });

    describe('Group Listing Operations', () => {
        let multipleGroups: any[] = [];

        beforeEach(async () => {
            // Create multiple groups for listing tests
            multipleGroups = [];
            const groupPromises = [];
            for (let i = 0; i < 5; i++) {
                groupPromises.push(apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`List Test Group ${i} ${uuidv4()}`).build(), users[0].token));
            }
            multipleGroups = await Promise.all(groupPromises);
        });

        test('should list all user groups', async () => {
            const response = await apiDriver.listGroups(users[0].token);

            expect(response.groups).toBeDefined();
            expect(Array.isArray(response.groups)).toBe(true);
            expect(response.groups.length).toBeGreaterThanOrEqual(5);
            expect(response.count).toBe(response.groups.length);
            expect(response.hasMore).toBeDefined();
        });

        test('should include group summaries with balance', async () => {
            const response = await apiDriver.listGroups(users[0].token);

            const firstGroup = response.groups[0];
            expect(firstGroup).toHaveProperty('id');
            expect(firstGroup).toHaveProperty('name');
            expect(firstGroup).toHaveProperty('balance');
            expect(firstGroup.balance).toHaveProperty('userBalance');
            expect(firstGroup.balance).toHaveProperty('balancesByCurrency');
            expect(firstGroup).toHaveProperty('lastActivity');
        });

        test('should support pagination', async () => {
            // Get first page
            const page1 = await apiDriver.listGroups(users[0].token, { limit: 2 });
            expect(page1.groups).toHaveLength(2);
            expect(page1.hasMore).toBe(true);
            expect(page1.nextCursor).toBeDefined();

            // Get second page
            const page2 = await apiDriver.listGroups(users[0].token, {
                limit: 2,
                cursor: page1.nextCursor,
            });
            expect(page2.groups.length).toBeGreaterThanOrEqual(1);

            // Ensure no duplicate IDs between pages
            const page1Ids = page1.groups.map((g: any) => g.id);
            const page2Ids = page2.groups.map((g: any) => g.id);
            const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
            expect(intersection).toHaveLength(0);
        });

        test('should support ordering', async () => {
            // Create an additional group with a slight delay to ensure different timestamps
            const latestGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Latest Group ${uuidv4()}`).build(), users[0].token);

            const responseDesc = await apiDriver.listGroups(users[0].token, { order: 'desc' });
            const responseAsc = await apiDriver.listGroups(users[0].token, { order: 'asc' });

            // Ensure we have enough groups to test ordering
            expect(responseDesc.groups.length).toBeGreaterThanOrEqual(2);
            expect(responseAsc.groups.length).toBeGreaterThanOrEqual(2);

            // The most recently created group should be first in desc order
            expect(responseDesc.groups[0].id).toBe(latestGroup.id);

            // The groups should be in different order for desc vs asc
            expect(responseDesc.groups[0].id).not.toBe(responseAsc.groups[0].id);
        });

        test('should only show groups where user is member', async () => {
            // Create a group with only user[1]
            const otherGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Other User Group ${uuidv4()}`).build(), users[1].token);

            // user[0] should not see this group
            const response = await apiDriver.listGroups(users[0].token);
            const groupIds = response.groups.map((g: any) => g.id);
            expect(groupIds).not.toContain(otherGroup.id);
        });

        test('should require authentication', async () => {
            await expect(apiDriver.listGroups('')).rejects.toThrow(/401|unauthorized/i);
        });

        test('should handle includeMetadata parameter correctly', async () => {
            // Test without metadata
            const responseWithoutMeta = await apiDriver.listGroups(users[0].token, {
                includeMetadata: false,
            });
            expect(responseWithoutMeta.metadata).toBeUndefined();

            // Test with metadata (note: may be undefined if no recent changes)
            const responseWithMeta = await apiDriver.listGroups(users[0].token, {
                includeMetadata: true,
            });
            // Metadata might not exist if no recent changes, but structure should be correct if present
            if (responseWithMeta.metadata) {
                expect(responseWithMeta.metadata).toHaveProperty('lastChangeTimestamp');
                expect(responseWithMeta.metadata).toHaveProperty('changeCount');
                expect(responseWithMeta.metadata).toHaveProperty('serverTime');
                expect(responseWithMeta.metadata).toHaveProperty('hasRecentChanges');
            }
        });

        test('should handle groups with expenses and settlements correctly', async () => {
            // Use one of the groups created in beforeEach to ensure it shows up in listGroups
            const response = await apiDriver.listGroups(users[0].token);
            expect(response.groups).toBeDefined();
            expect(response.groups.length).toBeGreaterThan(0);

            // Use the first group from the list
            const testGroup = response.groups[0];

            // Add an expense
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Test expense for listGroups`)
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // List groups and verify the test group has balance data
            const updatedResponse = await apiDriver.listGroups(users[0].token);
            const groupInList = updatedResponse.groups.find((g: any) => g.id === testGroup.id);

            expect(groupInList).toBeDefined();
            if (groupInList) {
                expect(groupInList.balance).toBeDefined();
                const balance = groupInList.balance as any;
                expect(balance.userBalance).toBeDefined();
                expect(typeof balance.userBalance.netBalance).toBe('number');
                expect(typeof balance.userBalance.totalOwed).toBe('number');
                expect(typeof balance.userBalance.totalOwing).toBe('number');
                expect(groupInList.lastActivity).toBeDefined();
                expect(groupInList.lastActivityRaw).toBeDefined();
            }
        });
    });

    describe('Group Deletion Notifications and Cleanup', () => {
        test('should delete group and prevent member access', async () => {
            // Create a group with 2 members
            const groupData = new CreateGroupRequestBuilder().withName(`Delete Test ${uuidv4()}`).withDescription('Testing group deletion').build();

            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add second user to the group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Verify 2 members before deletion
            const { members } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
            expect(members.members.length).toBe(2);

            // Delete the group
            await apiDriver.deleteGroup(group.id, users[0].token);

            // Verify the group is deleted from the backend
            await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);

            // Verify second user also cannot access deleted group
            await expect(apiDriver.getGroupFullDetails(group.id, users[1].token)).rejects.toThrow(/404|not found/i);
        });

        test('should handle single user group deletion', async () => {
            // Set up notification listener before any operations
            const [user1Listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // Create a group with just the owner
            const groupData = new CreateGroupRequestBuilder().withName(`Single User Test ${uuidv4()}`).withDescription('Testing single user group deletion').build();

            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Wait for group creation notification
            await user1Listener.waitForGroupEvent(group.id, 1, 1000);

            // Verify event count after group creation
            user1Listener.assertEventCount(group.id, 1, 'group');

            // Clear events to isolate deletion operation
            notificationDriver.clearEvents();

            // Delete the group
            await apiDriver.deleteGroup(group.id, users[0].token);

            // Verify the group is actually deleted from the backend
            await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);
        });
    });

    describe('Group Lifecycle Edge Cases', () => {
        let testGroup: any;
        let groupUsers: PooledTestUser[];

        beforeEach(async () => {
            groupUsers = users.slice(0, 4);
            testGroup = await apiDriver.createGroupWithMembers(`Lifecycle Test Group ${uuidv4()}`, groupUsers, groupUsers[0].token);
        });

        test('should handle viewing group with no expenses', async () => {
            // Create a fresh group with no expenses using the builder
            // Note: Only the creator will be a member initially
            const groupData = new CreateGroupRequestBuilder().withName(`Empty Group ${uuidv4()}`).build();
            const emptyGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Verify the group was created
            const { group: createdGroup } = await apiDriver.getGroupFullDetails(emptyGroup.id, users[0].token);
            expect(createdGroup.id).toBe(emptyGroup.id);

            // Should be able to get group details and verify no expenses
            const { group: groupDetails } = await apiDriver.getGroupFullDetails(emptyGroup.id, users[0].token);
            expect(groupDetails).toHaveProperty('id');

            // Verify no expenses exist
            const expenses = await apiDriver.getGroupExpenses(emptyGroup.id, users[0].token);
            expect(expenses.expenses).toHaveLength(0);

            // Verify empty group details include balance structure
            expect(groupDetails).toHaveProperty('balance');
            // For groups without expenses, balance should be empty or zero
            if (groupDetails.balance?.balancesByCurrency?.['EUR']) {
                expect(groupDetails.balance.balancesByCurrency['EUR'].netBalance).toBe(0);
            }
        });

        test('should handle multiple expenses with same participants', async () => {
            // Use the 4th user for this isolated test (we borrowed 4 users total)
            const testUser = users[3];

            const multiExpenseGroupData = new CreateGroupRequestBuilder().withName(`Multi Expense Group ${uuidv4()}`).build();
            const multiExpenseGroup = await apiDriver.createGroup(multiExpenseGroupData, testUser.token);

            // Create multiple expenses where the user pays themselves (testing expense tracking)
            const expenses = [
                { amount: 50, description: 'Expense 1' },
                { amount: 30, description: 'Expense 2' },
                { amount: 20, description: 'Expense 3' },
            ];

            const createdExpenseIds = [];
            for (const expense of expenses) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(multiExpenseGroup.id)
                    .withAmount(expense.amount)
                    .withDescription(expense.description)
                    .withPaidBy(testUser.uid)
                    .withParticipants([testUser.uid])
                    .withSplitType('equal')
                    .build();
                const createdExpense = await apiDriver.createExpense(expenseData, testUser.token);
                createdExpenseIds.push(createdExpense.id);
            }

            // Verify expenses were created correctly
            const loadedExpenses = await Promise.all(createdExpenseIds.map((id) => apiDriver.getExpense(id, testUser.token)));

            expect(loadedExpenses).toHaveLength(3);
            expect(loadedExpenses[0].amount).toBe(50);
            expect(loadedExpenses[0].paidBy).toBe(testUser.uid);
            expect(loadedExpenses[1].amount).toBe(30);
            expect(loadedExpenses[1].paidBy).toBe(testUser.uid);
            expect(loadedExpenses[2].amount).toBe(20);
            expect(loadedExpenses[2].paidBy).toBe(testUser.uid);

            // Verify all expenses are tracked
            const groupExpenses = await apiDriver.getGroupExpenses(multiExpenseGroup.id, testUser.token);
            expect(groupExpenses.expenses).toHaveLength(3);

            // Get group directly to check balance
            const groupInList = await apiDriver.getGroup(multiExpenseGroup.id, testUser.token);
            expect(groupInList).toBeDefined();

            // When a user pays for expenses only they participate in, net balance should be 0
            if (groupInList?.balance?.balancesByCurrency) {
                const eurBalance = groupInList.balance.balancesByCurrency['EUR'];
                if (eurBalance) {
                    expect(eurBalance.netBalance).toBe(0);
                }
            }
        });

        test('should handle deleting expenses successfully', async () => {
            // Focus on expense deletion functionality rather than balance recalculation

            // Create an expense
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('To Be Deleted Test')
                .withAmount(100) // Test expense deletion - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
            expect(createdExpense.id).toBeDefined();

            // Verify the expense exists
            const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(fetchedExpense).toBeDefined();
            expect(fetchedExpense.description).toBe('To Be Deleted Test');

            // Delete the expense
            await apiDriver.deleteExpense(createdExpense.id, users[0].token);

            // Verify the expense is gone
            await expect(apiDriver.getExpense(createdExpense.id, users[0].token)).rejects.toThrow(/not found|deleted|404/i);
        });

        test('should handle complex split scenarios', async () => {
            // Create a fresh group for this test to ensure clean state
            const complexGroupData = new CreateGroupRequestBuilder().withName(`Complex Split Group ${uuidv4()}`).build();
            const complexGroup = await apiDriver.createGroup(complexGroupData, users[0].token);

            // Scenario: Mixed split types in one group - just verify structure
            const expenseData1 = new CreateExpenseRequestBuilder()
                .withGroupId(complexGroup.id)
                .withAmount(90) // Complex split scenario - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();

            await apiDriver.createExpense(expenseData1, users[0].token);

            // Verify expense was created
            const expenses = await apiDriver.getGroupExpenses(complexGroup.id, users[0].token);
            expect(expenses.expenses).toHaveLength(1);
            expect(expenses.expenses[0].amount).toBe(90);

            // Verify group details include balance info after expense creation
            const { group: groupWithBalance } = await apiDriver.getGroupFullDetails(complexGroup.id, users[0].token);
            expect(groupWithBalance).toHaveProperty('balance');

            // When a single user pays for expenses they fully participate in, net balance is 0
            if (groupWithBalance.balance?.balancesByCurrency?.['EUR']) {
                expect(groupWithBalance.balance.balancesByCurrency['EUR'].netBalance).toBe(0);
            }
        });

        test('should handle expense updates successfully', async () => {
            // Focus on expense update functionality rather than balance recalculation

            // Create initial expense
            const initialExpenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Update Test Expense')
                .withAmount(50) // Test expense updates - this is what the test is about
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(initialExpenseData, users[0].token);
            expect(createdExpense.id).toBeDefined();

            // Verify initial expense data
            let fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(fetchedExpense.amount).toBe(50);
            expect(fetchedExpense.description).toBe('Update Test Expense');

            // Update the expense
            await apiDriver.updateExpense(
                createdExpense.id,
                {
                    amount: 80,
                    description: 'Updated Test Expense',
                },
                users[0].token,
            );

            // Verify the update worked
            fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
            expect(fetchedExpense.amount).toBe(80);
            expect(fetchedExpense.description).toBe('Updated Test Expense');

            // Verify splits were recalculated
            expect(fetchedExpense.splits).toHaveLength(2);
            const totalSplits = fetchedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
            expect(totalSplits).toBeCloseTo(80, 1);
        });
    });

    describe('Comprehensive Group Deletion Tests', () => {
        test('should successfully delete group with soft-deleted expenses using hard delete', async () => {
            const groupUsers = await borrowTestUsers(2);
            const [user1, user2] = groupUsers;

            // Create a group
            const groupData = new CreateGroupRequestBuilder().withName(`Bug Reproduction Group ${uuidv4()}`).withDescription('Testing group deletion with soft-deleted expenses').build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add second user to the group
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Create an expense
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Expense to be deleted')
                .withAmount(50)
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid, user2.uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

            // Soft-delete the expense (this simulates the bug scenario)
            await apiDriver.deleteExpense(createdExpense.id, user1.token);

            // Verify the expense is soft-deleted but still exists in Firestore
            // (It should have deletedAt field set but still be in the collection)

            // Hard delete should succeed and clean up all data including soft-deleted expenses
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toContain('deleted permanently');

            // Verify the group is actually deleted
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token)).rejects.toThrow(/404|not found/i);

            // Also verify that user2 can't access it
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token)).rejects.toThrow(/404|not found/i);
        });

        test('should delete group with multiple soft-deleted expenses', async () => {
            const groupUsers = await borrowTestUsers(3);
            const [user1, user2, user3] = groupUsers;

            // Create a group with multiple members
            const groupData = new CreateGroupRequestBuilder().withName(`Multi Expense Group ${uuidv4()}`).withDescription('Testing group deletion with multiple soft-deleted expenses').build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add other users to the group
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user3.token);

            // Create multiple expenses and soft-delete them all
            const expenseIds: string[] = [];

            for (let i = 1; i <= 3; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(`Expense ${i}`)
                    .withAmount(25 * i)
                    .withPaidBy(groupUsers[i - 1].uid)
                    .withParticipants([user1.uid, user2.uid, user3.uid])
                    .withSplitType('equal')
                    .build();

                const createdExpense = await apiDriver.createExpense(expenseData, user1.token);
                expenseIds.push(createdExpense.id);

                // Soft-delete the expense
                await apiDriver.deleteExpense(createdExpense.id, user1.token);
            }

            // Try to delete the group - should work with the fix
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toContain('deleted permanently');

            // Verify the group is deleted for all users
            for (const user of groupUsers) {
                await expect(apiDriver.getGroupFullDetails(testGroup.id, user.token)).rejects.toThrow(/404|not found/i);
            }
        });

        test('should clean up member subcollection when deleting group', async () => {
            const groupUsers = await borrowTestUsers(4);
            const [owner, ...members] = groupUsers;

            // Create a group with multiple members
            const groupData = new CreateGroupRequestBuilder().withName(`Member Cleanup Group ${uuidv4()}`).withDescription('Testing member subcollection cleanup').build();

            const testGroup = await apiDriver.createGroup(groupData, owner.token);

            // Add multiple members to create subcollection documents
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, owner.token);
            for (const member of members) {
                await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member.token);
            }

            // Verify all members are in the group
            const { members: groupMembers } = await apiDriver.getGroupFullDetails(testGroup.id, owner.token);
            expect(groupMembers.members).toHaveLength(4); // owner + 3 members

            // Delete the group
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, owner.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toContain('deleted permanently');

            // Verify the group is completely gone
            await expect(apiDriver.getGroupFullDetails(testGroup.id, owner.token)).rejects.toThrow(/404|not found/i);

            // Verify members can't access it either (confirms proper cleanup)
            for (const member of members) {
                await expect(apiDriver.getGroupFullDetails(testGroup.id, member.token)).rejects.toThrow(/404|not found/i);
            }
        });

        test('should successfully delete group with active (non-deleted) expenses using hard delete', async () => {
            const groupUsers = await borrowTestUsers(2);
            const [user1, user2] = groupUsers;

            // Create a group
            const groupData = new CreateGroupRequestBuilder().withName(`Active Expense Group ${uuidv4()}`).withDescription('Testing hard delete with active expenses').build();

            const testGroup = await apiDriver.createGroup(groupData, user1.token);

            // Add second user
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Create an active expense (don't delete it)
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Active expense')
                .withAmount(75)
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid, user2.uid])
                .withSplitType('equal')
                .build();

            const createdExpense = await apiDriver.createExpense(expenseData, user1.token);

            // Hard delete should succeed even with active expenses
            const deleteResponse = await apiDriver.deleteGroup(testGroup.id, user1.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toContain('deleted permanently');

            // Verify the group is completely deleted
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user1.token)).rejects.toThrow(/404|not found/i);

            // Verify user2 also can't access it
            await expect(apiDriver.getGroupFullDetails(testGroup.id, user2.token)).rejects.toThrow(/404|not found/i);

            // Verify the expense is also deleted (hard delete removes everything)
            await expect(apiDriver.getExpense(createdExpense.id, user1.token)).rejects.toThrow(/404|not found/i);
        });

        test('should completely delete group with ALL subcollections and related data', async () => {
            const groupUsers = await borrowTestUsers(4);
            const [owner, member1, member2, member3] = groupUsers;

            // Create a comprehensive group with ALL possible related data
            const groupData = new CreateGroupRequestBuilder().withName(`Comprehensive Deletion Test ${uuidv4()}`).withDescription('Testing complete deletion of all subcollections').build();

            const testGroup = await apiDriver.createGroup(groupData, owner.token);
            const groupId = testGroup.id;

            // Add multiple members to create member documents
            const shareResponse = await apiDriver.generateShareLink(groupId, owner.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member2.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, member3.token);

            // Create multiple expenses (both active and soft-deleted) to populate various collections
            const expenses = [];
            for (let i = 1; i <= 4; i++) {
                const expenseData = new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withAmount(25 * i)
                    .withPaidBy(groupUsers[i - 1].uid)
                    .withParticipants([owner.uid, member1.uid, member2.uid, member3.uid])
                    .withSplitType('equal')
                    .build();

                const expense = await apiDriver.createExpense(expenseData, owner.token);
                expenses.push(expense);
            }

            // Soft-delete some expenses (creates deletedAt field but keeps documents)
            await apiDriver.deleteExpense(expenses[0].id, owner.token);
            await apiDriver.deleteExpense(expenses[1].id, owner.token);

            // Create settlements to populate settlements collection
            const settlementData = new SettlementBuilder().withGroupId(groupId).withPayer(member1.uid).withPayee(owner.uid).withAmount(50.0).build();
            await apiDriver.createSettlement(settlementData, member1.token);

            // Create multiple share links to populate shareLinks subcollection
            await apiDriver.generateShareLink(groupId, owner.token);
            await apiDriver.generateShareLink(groupId, owner.token);

            // Add comments on group to populate group comments subcollection
            await apiDriver.createGroupComment(groupId, 'Group comment 1', owner.token);
            await apiDriver.createGroupComment(groupId, 'Group comment 2', member1.token);

            // Add comments on expenses to populate expense comments subcollections
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 1', owner.token);
            await apiDriver.createExpenseComment(expenses[2].id, 'Expense comment 2', member1.token);
            await apiDriver.createExpenseComment(expenses[3].id, 'Another expense comment', member2.token);

            // Use FirestoreReader for proper verification
            const firestore = getFirestore();
            const firestoreReader = new FirestoreReader(firestore);

            // VERIFICATION BEFORE DELETION: Use the group deletion data method that mirrors the actual deletion logic
            const groupDeletionData = await firestoreReader.getGroupDeletionData(groupId);

            expect(groupDeletionData.expenses.size).toBeGreaterThanOrEqual(4); // All 4 expenses
            expect(groupDeletionData.settlements.size).toBeGreaterThanOrEqual(1); // At least our settlement
            expect(groupDeletionData.shareLinks.size).toBeGreaterThanOrEqual(2); // 2 share links created
            expect(groupDeletionData.groupComments.size).toBeGreaterThanOrEqual(2); // 2 group comments

            // Count expense comments across all expenses
            const totalExpenseComments = groupDeletionData.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
            expect(totalExpenseComments).toBeGreaterThanOrEqual(3); // 3 expense comments total

            console.log(
                `Before deletion - Expenses: ${groupDeletionData.expenses.size}, Settlements: ${groupDeletionData.settlements.size}, Share links: ${groupDeletionData.shareLinks.size}, Group comments: ${groupDeletionData.groupComments.size}, Expense comments: ${totalExpenseComments},`,
            );

            // PERFORM HARD DELETE
            const deleteResponse = await apiDriver.deleteGroup(groupId, owner.token);

            expect(deleteResponse).toHaveProperty('message');
            expect(deleteResponse.message).toContain('deleted permanently');

            // COMPREHENSIVE VERIFICATION: ALL subcollections should be completely deleted

            // 1. Main group document should be deleted - use FirestoreReader method
            const groupExists = await firestoreReader.documentExists(FirestoreCollections.GROUPS, groupId);
            expect(groupExists).toBe(false);

            // 2. Use group deletion data method to verify all subcollections are empty
            const groupDeletionDataAfter = await firestoreReader.getGroupDeletionData(groupId);

            expect(groupDeletionDataAfter.expenses.size).toBe(0);
            expect(groupDeletionDataAfter.settlements.size).toBe(0);
            expect(groupDeletionDataAfter.shareLinks.size).toBe(0);
            expect(groupDeletionDataAfter.groupComments.size).toBe(0);

            // Verify all expense comment subcollections are empty
            const totalExpenseCommentsAfter = groupDeletionDataAfter.expenseComments.reduce((sum, snapshot) => sum + snapshot.size, 0);
            expect(totalExpenseCommentsAfter).toBe(0);

            // 5. All top-level GROUP_MEMBERSHIPS documents should be deleted - use FirestoreReader
            for (const user of groupUsers) {
                const topLevelDocId = getTopLevelMembershipDocId(user.uid, groupId);
                const membershipExists = await firestoreReader.documentExists(FirestoreCollections.GROUP_MEMBERSHIPS, topLevelDocId);
                expect(membershipExists).toBe(false);
            }

            // 10. API calls should return 404 for all users
            for (const user of groupUsers) {
                await expect(apiDriver.getGroupFullDetails(groupId, user.token)).rejects.toThrow(/404|not found/i);
            }

            // 11. Individual expenses should return 404
            for (const expense of expenses) {
                await expect(apiDriver.getExpense(expense.id, owner.token)).rejects.toThrow(/404|not found/i);
            }

            console.log('✅ Comprehensive group deletion test passed - all subcollections verified as deleted');
        }, 5000); // Fast timeout for comprehensive test
    });

    describe('Member Management Operations', () => {
        // Consolidated from GroupMemberSubcollection.integration.test.ts - basic member CRUD operations

        describe('Member Creation', () => {
            test('should create member document using service layer', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Member Creation Test Group',
                    description: 'Testing member creation functionality',
                });

                const memberDoc = {
                    uid: users[1].uid,
                    groupId: testGroup.id,
                    memberRole: MemberRoles.MEMBER,
                    theme: groupShareService.getThemeColorForMember(1),
                    joinedAt: new Date().toISOString(),
                    memberStatus: MemberStatuses.ACTIVE,
                    invitedBy: users[0].uid,
                };

                await groupMemberService.createMember(testGroup.id, memberDoc);

                // Verify member was created
                const retrievedMember = await groupMemberService.getGroupMember(testGroup.id, users[1].uid);
                expect(retrievedMember).toBeDefined();
                expect(retrievedMember?.uid).toBe(users[1].uid);
                expect(retrievedMember?.groupId).toBe(testGroup.id);
                expect(retrievedMember?.memberRole).toBe(MemberRoles.MEMBER);
                expect(retrievedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);
                expect(retrievedMember?.invitedBy).toBe(users[0].uid);
            });

            test('should return null for non-existent member queries', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Non-existent Member Test',
                    description: 'Testing non-existent member queries',
                });

                const result = await groupMemberService.getGroupMember(testGroup.id, 'non-existent-user');
                expect(result).toBeNull();

                const result2 = await groupMemberService.getGroupMember('non-existent-group', users[0].uid);
                expect(result2).toBeNull();
            });
        });

        describe('Member Retrieval', () => {
            test('should return all members for a group', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'All Members Test Group',
                    description: 'Testing member retrieval',
                });

                // Add second member
                const memberDoc = {
                    uid: users[1].uid,
                    groupId: testGroup.id,
                    memberRole: MemberRoles.MEMBER,
                    theme: groupShareService.getThemeColorForMember(1),
                    joinedAt: new Date().toISOString(),
                    memberStatus: MemberStatuses.ACTIVE,
                    invitedBy: users[0].uid,
                };
                await groupMemberService.createMember(testGroup.id, memberDoc);

                // Get all members
                const members = await groupMemberService.getAllGroupMembers(testGroup.id);

                expect(members).toHaveLength(2); // users[0] (creator) + users[1]
                const userIds = members.map((m: any) => m.uid);
                expect(userIds).toContain(users[0].uid);
                expect(userIds).toContain(users[1].uid);

                const creator = members.find((m: any) => m.uid === users[0].uid);
                expect(creator?.memberRole).toBe(MemberRoles.ADMIN);
            });

            test('should return empty array for group with no members', async () => {
                const newGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Empty Members Group',
                    description: 'No members for testing',
                });

                // Delete the auto-created member for this test
                await groupMemberService.deleteMember(newGroup.id, users[0].uid);

                const members = await groupMemberService.getAllGroupMembers(newGroup.id);
                expect(members).toHaveLength(0);
            });
        });

        describe('Member Updates', () => {
            test('should update member role and status', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Member Update Test Group',
                    description: 'Testing member updates',
                });

                // Add member first
                const memberDoc = {
                    uid: users[1].uid,
                    groupId: testGroup.id,
                    memberRole: MemberRoles.MEMBER,
                    theme: groupShareService.getThemeColorForMember(1),
                    joinedAt: new Date().toISOString(),
                    memberStatus: MemberStatuses.ACTIVE,
                    invitedBy: users[0].uid,
                };
                await groupMemberService.createMember(testGroup.id, memberDoc);

                // Update the member
                await groupMemberService.updateMember(testGroup.id, users[1].uid, {
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.PENDING,
                });

                // Verify update
                const updatedMember = await groupMemberService.getGroupMember(testGroup.id, users[1].uid);
                expect(updatedMember?.memberRole).toBe(MemberRoles.ADMIN);
                expect(updatedMember?.memberStatus).toBe(MemberStatuses.PENDING);
                expect(updatedMember?.uid).toBe(users[1].uid); // Other fields unchanged
            });
        });

        describe('Member Deletion', () => {
            test('should delete member from group', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Member Deletion Test Group',
                    description: 'Testing member deletion',
                });

                // Add member first
                const memberDoc = {
                    uid: users[1].uid,
                    groupId: testGroup.id,
                    memberRole: MemberRoles.MEMBER,
                    theme: groupShareService.getThemeColorForMember(1),
                    joinedAt: new Date().toISOString(),
                    memberStatus: MemberStatuses.ACTIVE,
                    invitedBy: users[0].uid,
                };
                await groupMemberService.createMember(testGroup.id, memberDoc);

                // Verify member exists
                let member = await groupMemberService.getGroupMember(testGroup.id, users[1].uid);
                expect(member).toBeDefined();

                // Delete member
                await groupMemberService.deleteMember(testGroup.id, users[1].uid);

                // Verify member is deleted
                member = await groupMemberService.getGroupMember(testGroup.id, users[1].uid);
                expect(member).toBeNull();
            });

            test('should not throw error when deleting non-existent member', async () => {
                const testGroup = await groupService.createGroup(users[0].uid, {
                    name: 'Non-existent Delete Test',
                    description: 'Testing non-existent member deletion',
                });

                // Should not throw - idempotent operation
                await expect(groupMemberService.deleteMember(testGroup.id, 'non-existent-user')).resolves.not.toThrow();
            });
        });
    });
});
