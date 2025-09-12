// Comprehensive group management API integration tests
// Consolidates tests from group-crud.test.ts, group-management.test.ts, GroupService.integration.test.ts

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, borrowTestUsers, borrowTestUser } from '@splitifyd/test-support';
import { SecurityPresets } from '@splitifyd/shared';
import { getFirestore } from '../../firebase';
import { PooledTestUser } from '@splitifyd/shared';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';

describe('Groups API', () => {
    const apiDriver = new ApiDriver();
    const applicationBuilder = new ApplicationBuilder(getFirestore());
    const groupService = applicationBuilder.buildGroupService();
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    describe('Group Creation', () => {
        test('should create a new group with minimal data', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withDescription('A test group for API testing').build();

            const response = await apiDriver.createGroup(groupData, users[0].token);

            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
            expect(response.description).toBe(groupData.description);
            expect(response.createdBy).toBe(users[0].uid);
        });

        test('should create a group with member objects', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Group with Members ${uuidv4()}`).build();

            const response = await apiDriver.createGroup(groupData, users[0].token);

            expect(response.id).toBeDefined();
            expect(response.name).toBe(groupData.name);
        });

        test('should set default security preset and permissions', async () => {
            const creator = users[0];
            const groupData = new CreateGroupRequestBuilder().withName('Security Test Group').build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(group.securityPreset).toBe(SecurityPresets.OPEN);
            expect(group.permissions).toBeDefined();
            expect(group.presetAppliedAt).toBeDefined();
        });

        test('should be able to fetch balances immediately after creating group', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Balance Test Group ${uuidv4()}`).withDescription('Testing immediate balance fetch').build();

            const createdGroup = await apiDriver.createGroup(groupData, users[0].token);

            // Verify the group can be fetched normally
            const { group: fetchedGroup } = await apiDriver.getGroupFullDetails(createdGroup.id, users[0].token);
            expect(fetchedGroup).toBeDefined();
            expect(fetchedGroup.id).toBe(createdGroup.id);

            // Fetch balances immediately after creation
            const balances = await apiDriver.getGroupBalances(createdGroup.id, users[0].token);

            expect(balances).toBeDefined();
            expect(balances.groupId).toBe(createdGroup.id);
            expect(balances.userBalances).toBeDefined();
            expect(balances.balancesByCurrency).toBeDefined();
            expect(typeof balances.balancesByCurrency).toBe('object');
            expect(Object.keys(balances.balancesByCurrency)).toHaveLength(0); // New group should have no balances
            expect(typeof balances.userBalances).toBe('object');
            expect(balances.userBalances).not.toBeNull();
            expect(Object.keys(balances.userBalances)).toHaveLength(0);
        });

        describe('Validation', () => {
            test('should validate required fields', async () => {
                // Missing name
                await expect(apiDriver.createGroup({ description: 'No name' }, users[0].token)).rejects.toThrow(/name.*required/i);

                // Empty name
                await expect(apiDriver.createGroup({ name: '   ' }, users[0].token)).rejects.toThrow(/name.*required/i);
            });

            test('should validate field lengths', async () => {
                const longName = 'a'.repeat(101);
                const longDescription = 'b'.repeat(501);

                await expect(apiDriver.createGroup({ name: longName }, users[0].token)).rejects.toThrow(/less than 100 characters/i);

                await expect(apiDriver.createGroup({ name: 'Valid Name', description: longDescription }, users[0].token)).rejects.toThrow(/less than or equal to 500 characters/i);
            });

            test('should require authentication', async () => {
                await expect(apiDriver.createGroup({ name: 'Test' }, '')).rejects.toThrow(/401|unauthorized/i);
            });
        });
    });

    describe('Group Retrieval', () => {
        let testGroup: any;

        beforeEach(async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Get Test Group ${uuidv4()}`).build();
            testGroup = await apiDriver.createGroup(groupData, users[0].token);
        });

        test('should retrieve a group by ID', async () => {
            const { group, members, balances } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            expect(group.id).toBe(testGroup.id);
            expect(group.name).toBe(testGroup.name);
            expect(group.description).toBe(testGroup.description);
            expect(members.members).toHaveLength(1);
            expect(balances).toBeDefined();
            expect(balances.balancesByCurrency).toBeDefined();
            expect(Object.keys(balances.balancesByCurrency).length).toBe(0);
        });

        test('should include balance information', async () => {
            // Create an expense to generate balance
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(testGroup.id)
                .withDescription('Test expense')
                .withAmount(100)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .withSplitType('equal')
                .build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // Get group details (balance calculation happens automatically)
            const { balances } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);

            expect(balances).toBeDefined();
            expect(balances.balancesByCurrency).toBeDefined();
        });

        test('should return 404 for non-existent group', async () => {
            await expect(apiDriver.getGroupFullDetails('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);
        });

        test('should return 404 for non-existent group ID', async () => {
            const user = await borrowTestUser();
            const fakeGroupId = 'non-existent-group-id-12345';

            await expect(apiDriver.getGroupFullDetails(fakeGroupId, user.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should restrict access to non-members', async () => {
            await expect(apiDriver.getGroupFullDetails(testGroup.id, users[1].token)).rejects.toThrow(/404|not found/i);
        });

        test('should return 404 for valid group when user is not a member (security: hide existence)', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Members Only Group ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroup(groupData, users[0].token);

            const outsiderUser = users[1];

            // NOTE: Returns 404 instead of 403 for security - doesn't reveal group existence
            await expect(apiDriver.getGroupFullDetails(testGroup.id, outsiderUser.token)).rejects.toThrow(/status 404.*NOT_FOUND/);
        });

        test('should allow group members to access group details', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Shared Group ${uuidv4()}`).build();
            const testGroup = await apiDriver.createGroupWithMembers(groupData.name, [users[0], users[1]], users[0].token);

            // Both members should be able to access the group
            const { group: groupFromUser0 } = await apiDriver.getGroupFullDetails(testGroup.id, users[0].token);
            expect(groupFromUser0.id).toBe(testGroup.id);

            const { group: groupFromUser1 } = await apiDriver.getGroupFullDetails(testGroup.id, users[1].token);
            expect(groupFromUser1.id).toBe(testGroup.id);
        });

        test('should require authentication', async () => {
            await expect(apiDriver.getExpenseFullDetails(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
        });
    });

    describe('Group Sharing & Invitations', () => {
        test('should generate shareable link for group', async () => {
            const testGroup = await apiDriver.createGroupWithMembers(`Share Link Test Group ${uuidv4()}`, [users[0], users[1]], users[0].token);

            // Any member should be able to generate a share link
            const shareResponse = await apiDriver.generateShareLink(testGroup.id, users[0].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should allow any member to generate shareable link', async () => {
            const memberGroup = await apiDriver.createGroupWithMembers(`Member Share Test Group ${uuidv4()}`, [users[0], users[1]], users[0].token);

            // User[1] (member) should be able to generate a share link
            const shareResponse = await apiDriver.generateShareLink(memberGroup.id, users[1].token);

            expect(shareResponse).toHaveProperty('shareablePath');
            expect(shareResponse).toHaveProperty('linkId');
            expect(shareResponse.shareablePath).toBe(`/join?linkId=${shareResponse.linkId}`);
            expect(shareResponse.linkId).toMatch(/^[A-Za-z0-9_-]{16}$/);
        });

        test('should not allow non-members to generate shareable link', async () => {
            const groupData = new CreateGroupRequestBuilder().withName(`Non-Member Test Group ${uuidv4()}`).build();
            const restrictedGroup = await apiDriver.createGroup(groupData, users[0].token);

            // User[1] (non-member) should not be able to generate a share link
            await expect(apiDriver.generateShareLink(restrictedGroup.id, users[1].token)).rejects.toThrow(/status 403.*UNAUTHORIZED/);
        });

        test('should allow new users to join group via share link', async () => {
            const shareableGroupData = new CreateGroupRequestBuilder().build();
            const shareableGroup = await apiDriver.createGroup(shareableGroupData, users[0].token);

            // Generate share link
            const shareResponse = await apiDriver.generateShareLink(shareableGroup.id, users[0].token);

            const newUser = users[1];

            // Join the group using the share token
            const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, newUser.token);

            expect(joinResponse).toHaveProperty('groupId');
            expect(joinResponse.groupId).toBe(shareableGroup.id);
            expect(joinResponse).toHaveProperty('message');
            expect(joinResponse).toHaveProperty('groupName');

            // Verify the user was added to the group
            const { members } = await apiDriver.getGroupFullDetails(shareableGroup.id, newUser.token);
            const addedMember = members.members.find((m) => m.uid === newUser.uid);
            expect(addedMember).toBeDefined();
        });

        test('should not allow duplicate joining via share link', async () => {
            const dupTestGroupData = new CreateGroupRequestBuilder().build();
            const dupTestGroup = await apiDriver.createGroup(dupTestGroupData, users[0].token);
            const shareResponse = await apiDriver.generateShareLink(dupTestGroup.id, users[0].token);

            // Add user[1] to the group via share link
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // Try to join again with the same user
            await expect(apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token)).rejects.toThrow(/ALREADY_MEMBER/);
        });

        test('should reject invalid share tokens', async () => {
            const user = await borrowTestUser();

            // Try to join with an invalid token
            await expect(apiDriver.joinGroupViaShareLink('INVALID_TOKEN_12345', user.token)).rejects.toThrow(/status 404.*INVALID_LINK/);
        });

        test('should allow multiple users to join group using the same share link', async () => {
            // Create a new group with only one member
            const multiJoinGroupData = new CreateGroupRequestBuilder().build();
            const multiJoinGroup = await apiDriver.createGroup(multiJoinGroupData, users[0].token);

            // Generate a share link
            const shareResponse = await apiDriver.generateShareLink(multiJoinGroup.id, users[0].token);

            // Use 3 users who will join via the same link
            const newUsers = users.slice(1, 4);

            // All users should be able to join using the same link
            for (const user of newUsers) {
                const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user.token);

                expect(joinResponse).toHaveProperty('groupId');
                expect(joinResponse.groupId).toBe(multiJoinGroup.id);
                expect(joinResponse).toHaveProperty('message');
            }

            // Verify all users were added to the group
            const { members } = await apiDriver.getGroupFullDetails(multiJoinGroup.id, users[0].token);

            // Should have original member + 3 new members = 4 total
            expect(members.members.length).toBe(4);
            const originalMember = members.members.find((m) => m.uid === users[0].uid);
            expect(originalMember).toBeDefined();
            newUsers.forEach((user) => {
                const addedMember = members.members.find((m) => m.uid === user.uid);
                expect(addedMember).toBeDefined();
            });
        });
    });

    describe('GroupService Direct Testing', () => {
        test('should create a group with minimal data via service', async () => {
            const creator = users[0];

            const groupData = new CreateGroupRequestBuilder().withName('Test Group').withDescription('A test group').build();

            const group = await groupService.createGroup(creator.uid, groupData);

            expect(group.id).toBeDefined();
            expect(group.name).toBe('Test Group');
            expect(group.description).toBe('A test group');
            expect(group.createdBy).toBe(creator.uid);
            expect(group.securityPreset).toBe(SecurityPresets.OPEN);
            expect(group.createdAt).toBeDefined();
            expect(group.updatedAt).toBeDefined();

            // Verify Firestore document was created correctly
            const firestoreGroup = await firestoreReader.getGroup(group.id);
            expect(firestoreGroup).not.toBeNull();
            expect(firestoreGroup!.name).toBe('Test Group');
            expect(firestoreGroup!.createdBy).toBe(creator.uid);
            expect(firestoreGroup!.createdAt).toBeDefined();
            expect(firestoreGroup!.updatedAt).toBeDefined();

        });
    });
});
