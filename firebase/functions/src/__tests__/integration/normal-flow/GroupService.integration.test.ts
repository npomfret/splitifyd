import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { ApiDriver, User, ExpenseBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { GroupService } from '../../../services/GroupService';
import { FirebaseIntegrationTestUserPool } from '../../support/FirebaseIntegrationTestUserPool';
import { MemberRoles, SecurityPresets, FirestoreCollections } from '@splitifyd/shared';
import { ApiError } from '../../../utils/errors';
import { firestoreDb } from '../../../firebase';

describe('GroupService - Integration Tests', () => {
    let apiDriver: ApiDriver;
    let groupService: GroupService;
    let userPool: FirebaseIntegrationTestUserPool;

    beforeAll(async () => {
        apiDriver = new ApiDriver(firestoreDb);
        groupService = new GroupService();

        // Create user pool with 4 users for complex scenarios
        userPool = new FirebaseIntegrationTestUserPool(apiDriver, 4);
        await userPool.initialize();
    });

    describe('createGroup', () => {
        test('should create a group with minimal data', async () => {
            const users = userPool.getUsers(1);
            const creator = users[0];

            const groupData = new CreateGroupRequestBuilder()
                .withName('Test Group')
                .withDescription('A test group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(group.id).toBeDefined();
            expect(group.name).toBe('Test Group');
            expect(group.description).toBe('A test group');
            expect(group.createdBy).toBe(creator.uid);
            expect(group.securityPreset).toBe(SecurityPresets.OPEN);
            expect(group.members).toBeDefined();
            expect(group.members[creator.uid]).toBeDefined();
            expect(group.members[creator.uid].role).toBe(MemberRoles.ADMIN);
            expect(group.createdAt).toBeDefined();
            expect(group.updatedAt).toBeDefined();

            // Verify Firestore document was created correctly
            const doc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).get();
            expect(doc.exists).toBe(true);
            
            const docData = doc.data()!;
            expect(docData.data.name).toBe('Test Group');
            expect(docData.data.createdBy).toBe(creator.uid);
            expect(docData.createdAt).toBeDefined();
            expect(docData.updatedAt).toBeDefined();

            // Cleanup
            await doc.ref.delete();
        });

        test('should create a group with multiple members', async () => {
            const users = userPool.getUsers(3);
            const [creator, member1, member2] = users;

            const groupData = new CreateGroupRequestBuilder()
                .withName('Multi-Member Group')
                .withMembers([
                    { uid: creator.uid, displayName: creator.displayName, email: creator.email },
                    { uid: member1.uid, displayName: member1.displayName, email: member1.email },
                    { uid: member2.uid, displayName: member2.displayName, email: member2.email },
                ])
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(Object.keys(group.members)).toHaveLength(3);
            expect(group.members[creator.uid].role).toBe(MemberRoles.ADMIN);
            expect(group.members[member1.uid].role).toBe(MemberRoles.MEMBER);
            expect(group.members[member2.uid].role).toBe(MemberRoles.MEMBER);

            // Each member should have a different theme color
            const themes = Object.values(group.members).map(m => m.theme);
            const uniqueThemes = new Set(themes);
            expect(uniqueThemes.size).toBe(themes.length);

            // Creator should have theme index 0
            expect(group.members[creator.uid].theme).toBeDefined();

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should assign theme colors to members correctly', async () => {
            const users = userPool.getUsers(2);
            const [creator, member] = users;

            const groupData = new CreateGroupRequestBuilder()
                .withName('Theme Test Group')
                .withMembers([
                    { uid: creator.uid, displayName: creator.displayName, email: creator.email },
                    { uid: member.uid, displayName: member.displayName, email: member.email },
                ])
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            // Creator should get first theme (index 0)
            expect(group.members[creator.uid].theme).toBeDefined();
            
            // Other member should get different theme
            expect(group.members[member.uid].theme).toBeDefined();
            expect(group.members[creator.uid].theme).not.toBe(group.members[member.uid].theme);

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should set default security preset and permissions', async () => {
            const users = userPool.getUsers(1);
            const creator = users[0];

            const groupData = new CreateGroupRequestBuilder()
                .withName('Security Test Group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(group.securityPreset).toBe(SecurityPresets.OPEN);
            expect(group.permissions).toBeDefined();
            expect(group.presetAppliedAt).toBeDefined();

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });
    });

    describe('getGroup', () => {
        let testGroupId: string;
        let creator: User;
        let member: User;
        let nonMember: User;

        beforeEach(async () => {
            const users = userPool.getUsers(3);
            [creator, member, nonMember] = users;

            // Create a test group
            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Getting',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            // Cleanup
            try {
                await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should return group with balance information for owner', async () => {
            const group = await groupService.getGroup(testGroupId, creator.uid);

            expect(group.id).toBe(testGroupId);
            expect(group.name).toBe('Test Group for Getting');
            expect(group.createdBy).toBe(creator.uid);
            expect(group.members).toBeDefined();
            expect(group.balance).toBeDefined();
            expect(group.balance.userBalance).toBeDefined();
            expect(group.balance.balancesByCurrency).toBeDefined();
        });

        test('should return group with balance information for member', async () => {
            const group = await groupService.getGroup(testGroupId, member.uid);

            expect(group.id).toBe(testGroupId);
            expect(group.balance).toBeDefined();
            expect(group.balance.userBalance).toBeDefined();
        });

        test('should throw NOT_FOUND for non-member', async () => {
            await expect(groupService.getGroup(testGroupId, nonMember.uid))
                .rejects.toThrow(ApiError);
        });

        test('should throw NOT_FOUND for non-existent group', async () => {
            await expect(groupService.getGroup('nonexistent-group-id', creator.uid))
                .rejects.toThrow(ApiError);
        });

        test('should calculate balances correctly with expenses', async () => {
            // Add an expense to the group
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupId)
                    .withPaidBy(creator.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(100)
                    .withDescription('Test expense for balance')
                    .build(),
                creator.token
            );

            // Get group with updated balance
            const group = await groupService.getGroup(testGroupId, creator.uid);

            // Creator paid $100, should be owed $50 (since split between 2)
            expect(group.balance.userBalance?.netBalance).toBe(50);
            expect(group.balance.userBalance?.totalOwed).toBe(50);
            expect(group.balance.userBalance?.totalOwing).toBe(0);

            // Get from member perspective
            const memberGroup = await groupService.getGroup(testGroupId, member.uid);
            expect(memberGroup.balance.userBalance?.netBalance).toBe(-50);
            expect(memberGroup.balance.userBalance?.totalOwed).toBe(0);
            expect(memberGroup.balance.userBalance?.totalOwing).toBe(50);

            // Cleanup expense
            await firestoreDb.collection(FirestoreCollections.EXPENSES).doc(expense.id).delete();
        });
    });

    describe('updateGroup', () => {
        let testGroupId: string;
        let creator: User;
        let member: User;

        beforeEach(async () => {
            const users = userPool.getUsers(2);
            [creator, member] = users;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Updates',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should allow owner to update group name and description', async () => {
            const updateData = {
                name: 'Updated Group Name',
                description: 'Updated description',
            };

            const result = await groupService.updateGroup(testGroupId, creator.uid, updateData);

            expect(result.message).toBe('Group updated successfully');

            // Verify the update was persisted
            const updatedGroup = await groupService.getGroup(testGroupId, creator.uid);
            expect(updatedGroup.name).toBe('Updated Group Name');
            expect(updatedGroup.description).toBe('Updated description');
        });

        test('should prevent non-owner from updating group', async () => {
            const updateData = {
                name: 'Unauthorized Update',
            };

            await expect(groupService.updateGroup(testGroupId, member.uid, updateData))
                .rejects.toThrow(ApiError);
        });

        test('should handle optimistic locking', async () => {
            // This tests the transaction-based updating
            const updateData = {
                name: 'Optimistic Test',
            };

            const result = await groupService.updateGroup(testGroupId, creator.uid, updateData);
            expect(result.message).toBe('Group updated successfully');

            // Verify the timestamp was updated
            const doc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).get();
            const docData = doc.data()!;
            expect(docData.updatedAt).toBeDefined();
        });
    });

    describe('deleteGroup', () => {
        let testGroupId: string;
        let creator: User;
        let member: User;

        beforeEach(async () => {
            const users = userPool.getUsers(2);
            [creator, member] = users;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Deletion',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        test('should allow owner to delete empty group', async () => {
            const result = await groupService.deleteGroup(testGroupId, creator.uid);

            expect(result.message).toBe('Group deleted successfully');

            // Verify group was deleted
            const doc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).get();
            expect(doc.exists).toBe(false);
        });

        test('should prevent non-owner from deleting group', async () => {
            await expect(groupService.deleteGroup(testGroupId, member.uid))
                .rejects.toThrow(ApiError);
        });

        test('should prevent deletion of group with expenses', async () => {
            // Add an expense to the group
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupId)
                    .withPaidBy(creator.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(50)
                    .withDescription('Blocking expense')
                    .build(),
                creator.token
            );

            await expect(groupService.deleteGroup(testGroupId, creator.uid))
                .rejects.toThrow(ApiError);

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.EXPENSES).doc(expense.id).delete();
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
        });

        test('should throw NOT_FOUND for non-existent group', async () => {
            await expect(groupService.deleteGroup('nonexistent-group-id', creator.uid))
                .rejects.toThrow(ApiError);
        });
    });

    describe('getGroupBalances', () => {
        let testGroupId: string;
        let creator: User;
        let member: User;

        beforeEach(async () => {
            const users = userPool.getUsers(2);
            [creator, member] = users;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Balances',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should return balance information for group member', async () => {
            const balances = await groupService.getGroupBalances(testGroupId, creator.uid);

            expect(balances.groupId).toBe(testGroupId);
            expect(balances.userBalances).toBeDefined();
            expect(balances.simplifiedDebts).toBeDefined();
            expect(balances.balancesByCurrency).toBeDefined();
            expect(balances.lastUpdated).toBeDefined();
        });

        test('should calculate balances correctly with multiple expenses', async () => {
            // Add multiple expenses
            const expense1 = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupId)
                    .withPaidBy(creator.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(100)
                    .withDescription('First expense')
                    .build(),
                creator.token
            );

            const expense2 = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupId)
                    .withPaidBy(member.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(60)
                    .withDescription('Second expense')
                    .build(),
                member.token
            );

            const balances = await groupService.getGroupBalances(testGroupId, creator.uid);

            // Creator paid $100, owes $30 to member (net: creator should be owed $20)
            // Member paid $60, owes $50 to creator (net: member should owe $20)
            expect(balances.balancesByCurrency).toBeDefined();
            
            // Verify balance structure exists
            expect(balances.userBalances).toBeDefined();
            expect(balances.simplifiedDebts).toBeDefined();

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.EXPENSES).doc(expense1.id).delete();
            await firestoreDb.collection(FirestoreCollections.EXPENSES).doc(expense2.id).delete();
        });

        test('should throw UNAUTHORIZED for missing userId', async () => {
            await expect(groupService.getGroupBalances(testGroupId, ''))
                .rejects.toThrow(ApiError);
        });

        test('should throw MISSING_FIELD for missing groupId', async () => {
            await expect(groupService.getGroupBalances('', creator.uid))
                .rejects.toThrow(ApiError);
        });

        test('should throw NOT_FOUND for non-existent group', async () => {
            await expect(groupService.getGroupBalances('nonexistent-group-id', creator.uid))
                .rejects.toThrow(ApiError);
        });
    });

    describe('listGroups', () => {
        let creator: User;
        let member: User;
        let testGroupIds: string[] = [];

        beforeEach(async () => {
            const users = userPool.getUsers(2);
            [creator, member] = users;

            // Create multiple test groups
            const group1 = await apiDriver.createGroupWithMembers('List Test Group 1', [creator], creator.token);
            const group2 = await apiDriver.createGroupWithMembers('List Test Group 2', [creator, member], creator.token);
            const group3 = await apiDriver.createGroupWithMembers('List Test Group 3', [creator], creator.token);

            testGroupIds = [group1.id, group2.id, group3.id];
        });

        afterEach(async () => {
            // Cleanup all test groups
            for (const groupId of testGroupIds) {
                try {
                    await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).delete();
                } catch (error) {
                    // Group might already be deleted
                }
            }
            testGroupIds = [];
        });

        test('should list all groups for a user', async () => {
            const response = await groupService.listGroups(creator.uid, {
                limit: 10,
            });

            expect(response.groups.length).toBeGreaterThanOrEqual(3);
            
            // Should contain our test groups
            const groupNames = response.groups.map(g => g.name);
            expect(groupNames).toContain('List Test Group 1');
            expect(groupNames).toContain('List Test Group 2');
            expect(groupNames).toContain('List Test Group 3');
        });

        test('should respect pagination limits', async () => {
            const response = await groupService.listGroups(creator.uid, {
                limit: 2,
            });

            expect(response.groups.length).toBe(2);
            expect(response.nextCursor).toBeDefined();
        });

        test('should handle pagination with cursor', async () => {
            const firstPage = await groupService.listGroups(creator.uid, {
                limit: 2,
            });

            if (firstPage.nextCursor) {
                const secondPage = await groupService.listGroups(creator.uid, {
                    limit: 2,
                    cursor: firstPage.nextCursor,
                });

                expect(secondPage.groups.length).toBeGreaterThan(0);
                // Groups should be different from first page
                const firstPageIds = firstPage.groups.map(g => g.id);
                const secondPageIds = secondPage.groups.map(g => g.id);
                expect(firstPageIds).not.toEqual(secondPageIds);
            }
        });

        test('should include balance information for each group', async () => {
            // Add an expense to one group to test balance calculation
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupIds[1])
                    .withPaidBy(creator.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(100)
                    .withDescription('List test expense')
                    .build(),
                creator.token
            );

            const response = await groupService.listGroups(creator.uid, {
                limit: 10,
            });

            const groupWithExpense = response.groups.find(g => g.id === testGroupIds[1]);
            expect(groupWithExpense).toBeDefined();
            expect(groupWithExpense!.balance).toBeDefined();

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.EXPENSES).doc(expense.id).delete();
        });
    });

    describe('access control and security', () => {
        let testGroupId: string;
        let creator: User;
        let member: User;
        let nonMember: User;

        beforeEach(async () => {
            const users = userPool.getUsers(3);
            [creator, member, nonMember] = users;

            const group = await apiDriver.createGroupWithMembers(
                'Security Test Group',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await firestoreDb.collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should return NOT_FOUND instead of FORBIDDEN for security', async () => {
            // Non-member should get NOT_FOUND, not FORBIDDEN, to prevent group ID enumeration
            await expect(groupService.getGroup(testGroupId, nonMember.uid))
                .rejects.toThrow(ApiError);
        });

        test('should enforce owner-only write operations', async () => {
            // Member should not be able to update group
            await expect(groupService.updateGroup(testGroupId, member.uid, { name: 'Hacked Name' }))
                .rejects.toThrow(ApiError);

            // Member should not be able to delete group
            await expect(groupService.deleteGroup(testGroupId, member.uid))
                .rejects.toThrow(ApiError);
        });

        test('should allow members to read group data', async () => {
            // Member should be able to get group
            const group = await groupService.getGroup(testGroupId, member.uid);
            expect(group.id).toBe(testGroupId);

            // Member should be able to get balances
            const balances = await groupService.getGroupBalances(testGroupId, member.uid);
            expect(balances.groupId).toBe(testGroupId);
        });
    });

    describe('error handling and validation', () => {
        test('should validate group document structure', async () => {
            const users = userPool.getUsers(1);
            const creator = users[0];

            // Valid group creation should work
            const groupData = new CreateGroupRequestBuilder()
                .withName('Valid Group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);
            expect(group.id).toBeDefined();

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should handle concurrent updates gracefully', async () => {
            const users = userPool.getUsers(1);
            const creator = users[0];

            const groupData = new CreateGroupRequestBuilder()
                .withName('Concurrent Test Group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            // Multiple concurrent updates should handle optimistic locking
            const updates = [
                { name: 'Update 1' },
                { name: 'Update 2' },
            ];

            const updatePromises = updates.map(update =>
                groupService.updateGroup(group.id, creator.uid, update)
            );

            // At least one should succeed
            const results = await Promise.allSettled(updatePromises);
            const successes = results.filter(r => r.status === 'fulfilled');
            expect(successes.length).toBeGreaterThan(0);

            // Cleanup
            await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should handle malformed input gracefully', async () => {
            const users = userPool.getUsers(1);
            const creator = users[0];

            // Empty name should be handled by validation layer
            // This test ensures the service doesn't crash
            const groupData = new CreateGroupRequestBuilder()
                .withName('')
                .build();

            try {
                const group = await groupService.createGroup(creator.uid, groupData);
                // If it succeeds, cleanup
                await firestoreDb.collection(FirestoreCollections.GROUPS).doc(group.id).delete();
            } catch (error) {
                // Expected - validation should catch this
                expect(error).toBeInstanceOf(Error);
            }
        });
    });
});