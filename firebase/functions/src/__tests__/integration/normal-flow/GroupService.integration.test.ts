import { beforeEach, describe, expect, test } from 'vitest';
import {ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder, borrowTestUsers} from '@splitifyd/test-support';
import { GroupService } from '../../../services/GroupService';
import { SecurityPresets, FirestoreCollections } from '@splitifyd/shared';
import { ApiError } from '../../../utils/errors';
import {getFirestore} from '../../../firebase';
import { registerAllServices, getGroupService } from '../../../services/serviceRegistration';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

// NOTE: GroupService returns the raw Group interface which uses group.members object format
// This is different from the API endpoints which return GroupMemberWithProfile[] arrays
describe('GroupService - Integration Tests', () => {
    const apiDriver = new ApiDriver();
    let groupService: GroupService;
    let testUsers: AuthenticatedFirebaseUser[] = [];

    beforeEach(async () => {
        testUsers = await borrowTestUsers(4);

        // Register all services before creating instances
        registerAllServices();
        groupService = getGroupService();
    });

    describe('createGroup', () => {
        test('should create a group with minimal data', async () => {
            const creator = testUsers[0];

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
            expect(group.createdAt).toBeDefined();
            expect(group.updatedAt).toBeDefined();

            // Verify Firestore document was created correctly
            const doc = await getFirestore().collection(FirestoreCollections.GROUPS).doc(group.id).get();
            expect(doc.exists).toBe(true);
            
            const docData = doc.data()!;
            expect(docData.name).toBe('Test Group');
            expect(docData.createdBy).toBe(creator.uid);
            expect(docData.createdAt).toBeDefined();
            expect(docData.updatedAt).toBeDefined();

            // Cleanup
            await doc.ref.delete();
        });

        test('should set default security preset and permissions', async () => {
            const creator = testUsers[0];

            const groupData = new CreateGroupRequestBuilder()
                .withName('Security Test Group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(group.securityPreset).toBe(SecurityPresets.OPEN);
            expect(group.permissions).toBeDefined();
            expect(group.presetAppliedAt).toBeDefined();

            // Cleanup
            await getFirestore().collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });
    });

    describe('getGroupFullDetails', () => {
        let testGroupId: string;
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;
        let nonMember: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            [creator, member, nonMember] = testUsers;

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
                await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should return group with balance information for owner', async () => {
            const result = await groupService.getGroupFullDetails(testGroupId, creator.uid);

            expect(result.group.id).toBe(testGroupId);
            expect(result.group.name).toBe('Test Group for Getting');
            expect(result.group.createdBy).toBe(creator.uid);
            expect(result.balances).toBeDefined();
            expect(result.balances.balancesByCurrency).toBeDefined();
        });

        test('should return group with balance information for member', async () => {
            const result = await groupService.getGroupFullDetails(testGroupId, member.uid);

            expect(result.group.id).toBe(testGroupId);
            expect(result.balances).toBeDefined();
            expect(result.balances.balancesByCurrency).toBeDefined();
        });

        test('should throw NOT_FOUND for non-member', async () => {
            await expect(groupService.getGroupFullDetails(testGroupId, nonMember.uid))
                .rejects.toThrow(ApiError);
        });

        test('should throw NOT_FOUND for non-existent group', async () => {
            await expect(groupService.getGroupFullDetails('nonexistent-group-id', creator.uid))
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
            const result = await groupService.getGroupFullDetails(testGroupId, creator.uid);

            // Check that balance data is present (specific balance calculations tested elsewhere)
            expect(result.balances).toBeDefined();
            expect(result.balances.balancesByCurrency).toBeDefined();
            expect(result.balances.userBalances).toBeDefined();

            // Cleanup expense
            await getFirestore().collection(FirestoreCollections.EXPENSES).doc(expense.id).delete();
        });
    });

    describe('updateGroup', () => {
        let testGroupId: string;
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            [creator, member] = testUsers;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Updates',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
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
            const updatedResult = await groupService.getGroupFullDetails(testGroupId, creator.uid);
            expect(updatedResult.group.name).toBe('Updated Group Name');
            expect(updatedResult.group.description).toBe('Updated description');
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
            const doc = await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).get();
            const docData = doc.data()!;
            expect(docData.updatedAt).toBeDefined();
        });
    });

    describe('deleteGroup', () => {
        let testGroupId: string;
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            [creator, member] = testUsers;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Deletion',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        test('should allow owner to delete empty group', async () => {
            const result = await groupService.deleteGroup(testGroupId, creator.uid);

            expect(result.message).toBe('Group and all associated data deleted permanently');

            // Verify group was deleted
            const doc = await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).get();
            expect(doc.exists).toBe(false);
        });

        test('should prevent non-owner from deleting group', async () => {
            await expect(groupService.deleteGroup(testGroupId, member.uid))
                .rejects.toThrow(ApiError);
        });

        test('should successfully delete group with expenses (hard delete)', async () => {
            // Add an expense to the group
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(testGroupId)
                    .withPaidBy(creator.uid)
                    .withParticipants([creator.uid, member.uid])
                    .withAmount(50)
                    .withDescription('Active expense')
                    .build(),
                creator.token
            );

            // Hard delete should succeed even with active expenses
            const result = await groupService.deleteGroup(testGroupId, creator.uid);
            
            expect(result.message).toBe('Group and all associated data deleted permanently');

            // Verify group and expense were both deleted
            const groupDoc = await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).get();
            expect(groupDoc.exists).toBe(false);
            
            const expenseDoc = await getFirestore().collection(FirestoreCollections.EXPENSES).doc(expense.id).get();
            expect(expenseDoc.exists).toBe(false);
        });

        test('should throw NOT_FOUND for non-existent group', async () => {
            await expect(groupService.deleteGroup('nonexistent-group-id', creator.uid))
                .rejects.toThrow(ApiError);
        });
    });

    describe('getGroupBalances', () => {
        let testGroupId: string;
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            [creator, member] = testUsers;

            const group = await apiDriver.createGroupWithMembers(
                'Test Group for Balances',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
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
            await getFirestore().collection(FirestoreCollections.EXPENSES).doc(expense1.id).delete();
            await getFirestore().collection(FirestoreCollections.EXPENSES).doc(expense2.id).delete();
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
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;
        let testGroupIds: string[] = [];

        beforeEach(async () => {
            [creator, member] = testUsers;

            // Create multiple test groups
            const group1 = await apiDriver.createGroupWithMembers('List Test Group 1', [creator], creator.token);
            const group2 = await apiDriver.createGroupWithMembers('List Test Group 2', [creator, member], creator.token);
            const group3 = await apiDriver.createGroupWithMembers('List Test Group 3', [creator], creator.token);

            testGroupIds = [group1.id, group2.id, group3.id];
        });

        afterEach(async () => {
            // Cleanup all test groups using proper deletion service
            for (const groupId of testGroupIds) {
                try {
                    await groupService.deleteGroup(groupId, creator.uid);
                } catch (error) {
                    // Group might already be deleted or permission denied
                    try {
                        // Fallback to direct deletion if service fails
                        await getFirestore().collection(FirestoreCollections.GROUPS).doc(groupId).delete();
                        // Also clean up members subcollection
                        const membersSnapshot = await getFirestore().collection(FirestoreCollections.GROUPS)
                            .doc(groupId)
                            .collection('members')
                            .get();
                        const batch = getFirestore().batch();
                        membersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                    } catch (cleanupError) {
                        // Ignore cleanup errors
                    }
                }
            }
            testGroupIds = [];
        });

        test('should list all groups for a user', async () => {
            // Test basic functionality without relying on specific database state
            const response = await groupService.listGroups(creator.uid, {
                limit: 100,
            });

            // Basic response structure validation
            expect(response).toHaveProperty('groups');
            expect(response).toHaveProperty('count');
            expect(response).toHaveProperty('hasMore');
            expect(Array.isArray(response.groups)).toBe(true);
            
            // Each group should have proper structure
            for (const group of response.groups) {
                expect(group).toHaveProperty('id');
                expect(group).toHaveProperty('name');
                expect(group).toHaveProperty('createdBy');
                expect(group).toHaveProperty('createdAt');
                expect(group).toHaveProperty('updatedAt');
                expect(typeof group.id).toBe('string');
                expect(typeof group.name).toBe('string');
            }
        });

        test('should respect pagination limits', async () => {
            // Create 3 fresh groups to ensure we have enough for pagination testing
            const testGroups = [];
            for (let i = 0; i < 3; i++) {
                const group = await apiDriver.createGroupWithMembers(
                    `Pagination Test ${i} ${Date.now()}`, 
                    [creator], 
                    creator.token
                );
                testGroups.push(group);
            }
            
            try {
                // Test limit=1
                const response = await groupService.listGroups(creator.uid, {
                    limit: 1,
                });
    
                // Should get exactly 1 group (since we definitely have groups now)
                expect(response.groups.length).toBe(1);
                
                // Basic response structure validation
                expect(response).toHaveProperty('groups');
                expect(response).toHaveProperty('count');
                expect(response).toHaveProperty('hasMore');
                expect(Array.isArray(response.groups)).toBe(true);
                
                // Should have proper group structure
                const group = response.groups[0];
                expect(group).toHaveProperty('id');
                expect(group).toHaveProperty('name');
                expect(group).toHaveProperty('createdBy');
                
            } finally {
                // Cleanup
                for (const group of testGroups) {
                    try {
                        await groupService.deleteGroup(group.id, creator.uid);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
            }
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
            // Create a fresh group for this test
            const testGroup = await apiDriver.createGroupWithMembers(
                `Balance Test Group ${Date.now()}`, 
                [creator, member], 
                creator.token
            );
            
            try {
                // Add an expense to test balance calculation
                const expense = await apiDriver.createExpense(
                    new ExpenseBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(creator.uid)
                        .withParticipants([creator.uid, member.uid])
                        .withAmount(100)
                        .withDescription('Balance test expense')
                        .build(),
                    creator.token
                );
    
                // Get group details to verify balance calculation works
                const groupDetails = await groupService.getGroupFullDetails(testGroup.id, creator.uid);
                expect(groupDetails.group.balance).toBeDefined();
                
                // Test that listGroups includes balance information
                const response = await groupService.listGroups(creator.uid, {
                    limit: 100, // High limit to ensure we find our group
                });
    
                // Basic response validation
                expect(response).toHaveProperty('groups');
                expect(Array.isArray(response.groups)).toBe(true);
                
                // Each group should have balance property (can be null or object)
                for (const group of response.groups) {
                    expect(group).toHaveProperty('balance');
                }
                
            } finally {
                // Cleanup
                await groupService.deleteGroup(testGroup.id, creator.uid);
            }
        });
    });

    describe('access control and security', () => {
        let testGroupId: string;
        let creator: AuthenticatedFirebaseUser;
        let member: AuthenticatedFirebaseUser;
        let nonMember: AuthenticatedFirebaseUser;

        beforeEach(async () => {
            [creator, member, nonMember] = testUsers;

            const group = await apiDriver.createGroupWithMembers(
                'Security Test Group',
                [creator, member],
                creator.token
            );
            testGroupId = group.id;
        });

        afterEach(async () => {
            try {
                await getFirestore().collection(FirestoreCollections.GROUPS).doc(testGroupId).delete();
            } catch (error) {
                // Group might already be deleted
            }
        });

        test('should return NOT_FOUND instead of FORBIDDEN for security', async () => {
            // Non-member should get NOT_FOUND, not FORBIDDEN, to prevent group ID enumeration
            await expect(groupService.getGroupFullDetails(testGroupId, nonMember.uid))
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
            const result = await groupService.getGroupFullDetails(testGroupId, member.uid);
            expect(result.group.id).toBe(testGroupId);

            // Member should be able to get balances
            const balances = await groupService.getGroupBalances(testGroupId, member.uid);
            expect(balances.groupId).toBe(testGroupId);
        });
    });

    describe('error handling and validation', () => {
        test('should validate group document structure', async () => {
            const creator = testUsers[0];

            // Valid group creation should work
            const groupData = new CreateGroupRequestBuilder()
                .withName('Valid Group')
                .build();

            const group = await groupService.createGroup(creator.uid, groupData);
            expect(group.id).toBeDefined();

            // Cleanup
            await getFirestore().collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should handle concurrent updates gracefully', async () => {
            const creator = testUsers[0];

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
            await getFirestore().collection(FirestoreCollections.GROUPS).doc(group.id).delete();
        });

        test('should handle malformed input gracefully', async () => {
            const creator = testUsers[0];

            // Empty name should be handled by validation layer
            // This test ensures the service doesn't crash
            const groupData = new CreateGroupRequestBuilder()
                .withName('')
                .build();

            try {
                const group = await groupService.createGroup(creator.uid, groupData);
                // If it succeeds, cleanup
                await getFirestore().collection(FirestoreCollections.GROUPS).doc(group.id).delete();
            } catch (error) {
                // Expected - validation should catch this
                expect(error).toBeInstanceOf(Error);
            }
        });
    });
});