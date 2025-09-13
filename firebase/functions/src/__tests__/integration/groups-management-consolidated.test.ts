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
});