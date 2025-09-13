import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
    ApiDriver,
    CreateGroupRequestBuilder,
    CreateExpenseRequestBuilder,
    SettlementBuilder,
    borrowTestUsers,
    borrowTestUser,
    generateShortId
} from '@splitifyd/test-support';
import { SecurityPresets, PooledTestUser } from '@splitifyd/shared';
import { getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';

describe('Groups Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const applicationBuilder = new ApplicationBuilder(getFirestore());
    const groupService = applicationBuilder.buildGroupService();
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    describe('Group Creation and Basic Operations', () => {
        test('should create groups with validation and default settings', async () => {
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Test Group ${uuidv4()}`)
                .withDescription('A test group for API testing')
                .build();

            // Test API creation
            const apiResponse = await apiDriver.createGroup(groupData, users[0].token);
            expect(apiResponse.id).toBeDefined();
            expect(apiResponse.name).toBe(groupData.name);
            expect(apiResponse.description).toBe(groupData.description);
            expect(apiResponse.createdBy).toBe(users[0].uid);

            // Test service-level creation with default settings
            const serviceGroup = await groupService.createGroup(users[0].uid, groupData);
            expect(serviceGroup.securityPreset).toBe(SecurityPresets.OPEN);
            expect(serviceGroup.permissions).toBeDefined();
            expect(serviceGroup.presetAppliedAt).toBeDefined();

            // Verify Firestore persistence
            const firestoreGroup = await firestoreReader.getGroup(serviceGroup.id);
            expect(firestoreGroup).not.toBeNull();
            expect(firestoreGroup!.createdBy).toBe(users[0].uid);

            // Test immediate balance access
            const balances = await apiDriver.getGroupBalances(apiResponse.id, users[0].token);
            expect(balances.groupId).toBe(apiResponse.id);
            expect(balances.balancesByCurrency).toBeDefined();
            expect(Object.keys(balances.balancesByCurrency)).toHaveLength(0); // Empty group
        });

        test('should validate group creation input', async () => {
            // Missing name
            await expect(apiDriver.createGroup({ description: 'No name' }, users[0].token))
                .rejects.toThrow(/name.*required/i);

            // Empty name
            await expect(apiDriver.createGroup({ name: '   ' }, users[0].token))
                .rejects.toThrow(/name.*required/i);

            // Field length validation
            const longName = 'a'.repeat(101);
            const longDescription = 'b'.repeat(501);

            await expect(apiDriver.createGroup({ name: longName }, users[0].token))
                .rejects.toThrow(/less than 100 characters/i);

            await expect(apiDriver.createGroup({ name: 'Valid Name', description: longDescription }, users[0].token))
                .rejects.toThrow(/less than or equal to 500 characters/i);

            // Authentication required
            await expect(apiDriver.createGroup({ name: 'Test' }, ''))
                .rejects.toThrow(/401|unauthorized/i);
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
            await expect(apiDriver.getGroupFullDetails('non-existent-id', users[0].token))
                .rejects.toThrow(/404|not found/i);

            // Non-member access (returns 404 for security - doesn't reveal group existence)
            await expect(apiDriver.getGroupFullDetails(testGroup.id, users[1].token))
                .rejects.toThrow(/404|not found/i);

            // Unauthenticated access
            await expect(apiDriver.getGroupFullDetails(testGroup.id, ''))
                .rejects.toThrow(/401|unauthorized/i);

            // Member access should work
            const multiMemberGroup = await apiDriver.createGroupWithMembers(
                `Shared Group ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

            const { group: groupFromUser0 } = await apiDriver.getGroupFullDetails(multiMemberGroup.id, users[0].token);
            const { group: groupFromUser1 } = await apiDriver.getGroupFullDetails(multiMemberGroup.id, users[1].token);

            expect(groupFromUser0.id).toBe(multiMemberGroup.id);
            expect(groupFromUser1.id).toBe(multiMemberGroup.id);
        });
    });

    describe('Group Sharing and Invitations', () => {
        test('should handle complete sharing workflow', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(
                `Share Test Group ${uuidv4()}`,
                [users[0]],
                users[0].token
            );

            // Generate share link
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);

            // Test member permissions for sharing
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);
            const memberShareResponse = await apiDriver.generateShareLink(testGroup.id, users[1].token);
            expect(memberShareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);

            // Test non-member restriction
            await expect(apiDriver.generateShareLink(testGroup.id, users[2].token))
                .rejects.toThrow(/status 403.*UNAUTHORIZED/);

            // Test joining workflow
            const newUser = users[3];
            const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

            expect(joinResponse.groupId).toBe(testGroup.id);
            expect(joinResponse.success).toBe(true);
            expect(joinResponse.groupName).toBeDefined();

            // Verify user was added
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, newUser.token);
            const addedMember = members.members.find(m => m.uid === newUser.uid);
            expect(addedMember).toBeDefined();

            // Test duplicate joining prevention
            await expect(apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token))
                .rejects.toThrow(/ALREADY_MEMBER/);

            // Test invalid share token
            await expect(apiDriver.joinGroupViaShareLink('INVALID_TOKEN_12345', users[2].token))
                .rejects.toThrow(/status 404.*INVALID_LINK/);
        });

        test('should support multiple users joining via same link', async () => {
            const multiJoinGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Multi Join Group ${uuidv4()}`).build(),
                users[0].token
            );

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

            newUsers.forEach(user => {
                const addedMember = members.members.find(m => m.uid === user.uid);
                expect(addedMember).toBeDefined();
            });
        });
    });

    describe('Group Management Operations', () => {
        let testGroup: any;

        beforeEach(async () => {
            testGroup = await apiDriver.createGroupWithMembers(
                `Management Test Group ${generateShortId()}`,
                [users[0], users[1]],
                users[0].token
            );
        });

        test('should handle group updates with proper authorization', async () => {
            const updateData = {
                name: 'Updated Group Name',
                description: 'Updated description',
            };

            // Owner should be able to update
            const result = await groupService.updateGroup(testGroup.id, users[0].uid, updateData);
            expect(result.message).toBe('Group updated successfully');

            // Verify update was persisted
            const updatedResult = await groupService.getGroupFullDetails(testGroup.id, users[0].uid);
            expect(updatedResult.group.name).toBe('Updated Group Name');
            expect(updatedResult.group.description).toBe('Updated description');

            // Non-owner should not be able to update
            await expect(groupService.updateGroup(testGroup.id, users[1].uid, { name: 'Unauthorized Update' }))
                .rejects.toThrow();
        });

        test('should handle group deletion with cascade', async () => {
            // Add expenses to test cascade deletion
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(50)
                    .withSplitType('equal')
                    .build(),
                users[0].token
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
            const testGroup = await apiDriver.createGroupWithMembers(
                `Full Details Test ${uuidv4()}`,
                [users[0], users[1], users[2]],
                users[0].token
            );

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
                users[0].token
            );

            await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(testGroup.id)
                    .withPayer(users[1].uid)
                    .withPayee(users[0].uid)
                    .withAmount(20)
                    .withNote(`Settlement test ${uniqueId}`)
                    .build(),
                users[1].token
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
                users[0].token
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
                new CreateGroupRequestBuilder()
                    .withName(`Concurrent Join Test ${uuidv4()}`)
                    .withDescription('Testing concurrent joins')
                    .build(),
                users[0].token
            );

            // Generate share link
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);

            // Both users try to join simultaneously
            const joinPromises = [
                apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token),
                apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token)
            ];

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
            expect(members.members.find(m => m.uid === users[1].uid)).toBeDefined();
            expect(members.members.find(m => m.uid === users[2].uid)).toBeDefined();
        });

        test('should prevent concurrent group updates with proper conflict resolution', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Concurrent Update Test ${uuidv4()}`)
                    .withDescription('Testing concurrent updates')
                    .build(),
                users[0].token
            );

            // Add second user as member
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Same user tries multiple concurrent updates
            const updatePromises = [
                apiDriver.updateGroup(testGroup.id, { name: 'First Update' }, users[0].token),
                apiDriver.updateGroup(testGroup.id, { name: 'Second Update' }, users[0].token),
                apiDriver.updateGroup(testGroup.id, { description: 'Updated description' }, users[0].token),
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
                    const isValidConcurrencyError =
                        errorMessage.match(/concurrent|conflict|version|timestamp|CONCURRENT_UPDATE/i) ||
                        errorCode === 'CONCURRENT_UPDATE';
                    expect(isValidConcurrencyError).toBeTruthy();
                }
            }

            // Verify final state integrity
            const { group: finalGroup } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(
                finalGroup.name === 'First Update' ||
                finalGroup.name === 'Second Update' ||
                finalGroup.description === 'Updated description'
            ).toBeTruthy();
        });

        test('should handle concurrent expense operations', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(
                `Expense Locking Test ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

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
                users[0].token
            );

            // Try concurrent expense updates
            const updatePromises = [
                apiDriver.updateExpense(expense.id, { amount: 200 }, users[0].token),
                apiDriver.updateExpense(expense.id, { amount: 300 }, users[0].token)
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');
            const conflicts = results.filter(
                (r) =>
                    r.status === 'rejected' &&
                    (r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE' ||
                     r.reason?.message?.includes('CONCURRENT_UPDATE') ||
                     r.reason?.message?.includes('409'))
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
            const testGroup = await apiDriver.createGroupWithMembers(
                `Expense Delete Test ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription('Test Expense for Deletion')
                    .withAmount(50)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token
            );

            // Try concurrent delete and update
            const promises = [
                apiDriver.deleteExpense(expense.id, users[0].token),
                apiDriver.updateExpense(expense.id, { amount: 75 }, users[0].token)
            ];

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
            const testGroup = await apiDriver.createGroupWithMembers(
                `Settlement Test ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(testGroup.id)
                    .withPayer(users[0].uid)
                    .withPayee(users[1].uid)
                    .withAmount(50)
                    .withNote('Test settlement')
                    .build(),
                users[0].token
            );

            // Try concurrent settlement updates
            const updatePromises = [
                apiDriver.updateSettlement(settlement.id, { amount: 75 }, users[0].token),
                apiDriver.updateSettlement(settlement.id, { amount: 100 }, users[0].token)
            ];

            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter((r) => r.status === 'fulfilled');
            const conflicts = results.filter(
                (r) => r.status === 'rejected' && r.reason?.response?.data?.error?.code === 'CONCURRENT_UPDATE'
            );

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
                new CreateGroupRequestBuilder()
                    .withName(`Cross-Entity Race Test ${uuidv4()}`)
                    .withDescription('Testing cross-entity race conditions')
                    .build(),
                users[0].token
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
                    users[0].token
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

            expect(members.members.find(m => m.uid === users[1].uid)).toBeDefined();
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

            await expect(groupService.updateGroup(testGroup.id, users[1].uid, { name: 'Hacked Name' })).rejects.toThrow();
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
                        expect.objectContaining({ uid: testUsers[2].uid })
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

            test('should prevent the creator from leaving', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);

                await expect(apiDriver.leaveGroup(groupId, testUsers[0].token)).rejects.toThrow(/Group creator cannot leave/);
            });

            test('should prevent leaving with outstanding balance', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const memberWithDebt = testUsers[1];

                // Create an expense where member owes money
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription('Test expense')
                        .withAmount(100)
                        .withPaidBy(testUsers[0].uid)
                        .withParticipants([testUsers[0].uid, memberWithDebt.uid])
                        .withSplitType('equal')
                        .build(),
                    testUsers[0].token,
                );

                await expect(apiDriver.leaveGroup(groupId, memberWithDebt.token)).rejects.toThrow(/Cannot leave group with outstanding balance/);
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

            test('should prevent non-creator from removing members', async () => {
                const testUsers = users.slice(0, 3);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const nonCreator = testUsers[1];
                const memberToRemove = testUsers[2];

                await expect(apiDriver.removeGroupMember(groupId, memberToRemove.uid, nonCreator.token)).rejects.toThrow(/FORBIDDEN/);
            });

            test('should prevent removing the creator', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const creator = testUsers[0];

                await expect(apiDriver.removeGroupMember(groupId, creator.uid, creator.token)).rejects.toThrow(/Group creator cannot be removed/);
            });

            test('should prevent removing member with outstanding balance', async () => {
                const testUsers = users.slice(0, 2);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const creator = testUsers[0];
                const memberWithDebt = testUsers[1];

                // Create expense where member owes money
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withDescription('Test expense')
                        .withAmount(100)
                        .withPaidBy(creator.uid)
                        .withParticipants([creator.uid, memberWithDebt.uid])
                        .withSplitType('equal')
                        .build(),
                    creator.token,
                );

                await expect(apiDriver.removeGroupMember(groupId, memberWithDebt.uid, creator.token)).rejects.toThrow(/Cannot remove member with outstanding balance/);
            });

            test('should handle removing non-existent member', async () => {
                const testUsers = users.slice(0, 1);
                const groupId = await createGroupWithMembers(apiDriver, testUsers);
                const creator = testUsers[0];
                const nonExistentMember = 'non-existent-uid';

                await expect(apiDriver.removeGroupMember(groupId, nonExistentMember, creator.token)).rejects.toThrow(/User is not a member of this group/);
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
                groupPromises.push(
                    apiDriver.createGroup(
                        new CreateGroupRequestBuilder().withName(`List Test Group ${i} ${uuidv4()}`).build(),
                        users[0].token
                    )
                );
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
            await new Promise((resolve) => setTimeout(resolve, 100));
            const latestGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Latest Group ${uuidv4()}`).build(),
                users[0].token
            );

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
            const otherGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Other User Group ${uuidv4()}`).build(),
                users[1].token
            );

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
        test('should notify users via user-notifications when group is deleted', async () => {
            // Create a group with 2 members
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Notification Test ${uuidv4()}`)
                .withDescription('Testing user notifications during group deletion')
                .build();

            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add second user to the group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Verify 2 members before deletion
            const { members } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
            expect(members.members.length).toBe(2);

            // Get initial change versions for both users
            const firestore = getFirestore();
            const user1NotificationsBefore = await firestore.doc(`user-notifications/${users[0].uid}`).get();
            const user2NotificationsBefore = await firestore.doc(`user-notifications/${users[1].uid}`).get();

            const initialUser1Version = user1NotificationsBefore.data()?.changeVersion || 0;
            const initialUser2Version = user2NotificationsBefore.data()?.changeVersion || 0;

            // Delete the group - this should trigger our notification system
            await apiDriver.deleteGroup(group.id, users[0].token);

            // Wait for triggers to execute
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get user notification documents after deletion
            const user1NotificationsAfter = await firestore.doc(`user-notifications/${users[0].uid}`).get();
            const user2NotificationsAfter = await firestore.doc(`user-notifications/${users[1].uid}`).get();

            // Both users should have notification documents
            expect(user1NotificationsAfter.exists).toBe(true);
            expect(user2NotificationsAfter.exists).toBe(true);

            const user1AfterData = user1NotificationsAfter.data();
            const user2AfterData = user2NotificationsAfter.data();

            const finalUser1Version = user1AfterData?.changeVersion || 0;
            const finalUser2Version = user2AfterData?.changeVersion || 0;

            // Both users should have their change version incremented (indicating they were notified)
            expect(finalUser1Version).toBeGreaterThan(initialUser1Version);
            expect(finalUser2Version).toBeGreaterThan(initialUser2Version);

            // The deleted group should NOT be in their notification documents anymore
            expect(user1AfterData?.groups?.[group.id]).toBeUndefined();
            expect(user2AfterData?.groups?.[group.id]).toBeUndefined();

            // Verify the group is actually deleted from the backend
            await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);
        }, 15000);

        test('should handle single user group deletion', async () => {
            // Create a group with just the owner
            const groupData = new CreateGroupRequestBuilder()
                .withName(`Single User Test ${uuidv4()}`)
                .withDescription('Testing single user group deletion')
                .build();

            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Get initial change version
            const firestore = getFirestore();
            const userNotificationsBefore = await firestore.doc(`user-notifications/${users[0].uid}`).get();
            const initialVersion = userNotificationsBefore.data()?.changeVersion || 0;

            // Delete the group
            await apiDriver.deleteGroup(group.id, users[0].token);

            // Wait for triggers to execute
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Get user notification document after deletion
            const userNotificationsAfter = await firestore.doc(`user-notifications/${users[0].uid}`).get();

            expect(userNotificationsAfter.exists).toBe(true);

            const finalVersion = userNotificationsAfter.data()?.changeVersion || 0;

            // User should be notified about the group deletion
            expect(finalVersion).toBeGreaterThan(initialVersion);

            // Group should be removed from notifications
            expect(userNotificationsAfter.data()?.groups?.[group.id]).toBeUndefined();

            // Verify the group is actually deleted
            await expect(apiDriver.getGroupFullDetails(group.id, users[0].token)).rejects.toThrow(/404|not found/i);
        }, 15000);
    });
});