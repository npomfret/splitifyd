import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { getGroupMemberService, getGroupService, registerAllServices } from '../../../services/serviceRegistration';
import { borrowTestUsers } from '@splitifyd/test-support';
import { GroupMemberDocument, MemberRoles, MemberStatuses, AuthenticatedFirebaseUser } from '@splitifyd/shared';
import { getThemeColorForMember } from '../../../utils/groupHelpers';

describe('GroupMemberService Subcollection Integration Tests', () => {
    let users: AuthenticatedFirebaseUser[];
    let testUser1: AuthenticatedFirebaseUser;
    let testUser2: AuthenticatedFirebaseUser;
    let testGroup: any;

    beforeAll(async () => {
        // Register all services before creating instances
        registerAllServices();
    });

    beforeEach(async () => {
        // Create test users
        users = await borrowTestUsers(5); // Borrow 5 users for all tests
        testUser1 = users[0];
        testUser2 = users[1];

        // Create test group
        testGroup = await getGroupService().createGroup(testUser1.uid, {
            name: 'Test Subcollection Group',
            description: 'Testing subcollection functionality',
        });
    });

    describe('createMemberSubcollection', () => {
        test('should create member document in subcollection', async () => {
            const memberDoc: GroupMemberDocument = {
                userId: testUser2.uid,
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };

            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            // Verify member was created
            const retrievedMember = await getGroupMemberService().getMemberFromSubcollection(testGroup.id, testUser2.uid);
            expect(retrievedMember).toBeDefined();
            expect(retrievedMember?.userId).toBe(testUser2.uid);
            expect(retrievedMember?.groupId).toBe(testGroup.id);
            expect(retrievedMember?.role).toBe(MemberRoles.MEMBER);
            expect(retrievedMember?.status).toBe(MemberStatuses.ACTIVE);
            expect(retrievedMember?.invitedBy).toBe(testUser1.uid);
        });
    });

    describe('getMemberFromSubcollection', () => {
        test('should return null for non-existent member', async () => {
            const result = await getGroupMemberService().getMemberFromSubcollection(testGroup.id, 'non-existent-user');
            expect(result).toBeNull();
        });

        test('should return null for non-existent group', async () => {
            const result = await getGroupMemberService().getMemberFromSubcollection('non-existent-group', testUser1.uid);
            expect(result).toBeNull();
        });
    });

    describe('getMembersFromSubcollection', () => {
        test('should return all members for a group', async () => {
            // Add second member to subcollection
            const memberDoc: GroupMemberDocument = {
                userId: testUser2.uid,
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };
            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            // Get all members
            const members = await getGroupMemberService().getMembersFromSubcollection(testGroup.id);
            
            expect(members).toHaveLength(2); // testUser1 (creator) + testUser2
            
            const userIds = members.map(m => m.userId);
            expect(userIds).toContain(testUser1.uid);
            expect(userIds).toContain(testUser2.uid);
            
            const creator = members.find(m => m.userId === testUser1.uid);
            expect(creator?.role).toBe(MemberRoles.ADMIN);
        });

        test('should return empty array for group with no subcollection members', async () => {
            const newGroup = await getGroupService().createGroup(testUser1.uid, {
                name: 'Empty Subcollection Group',
                description: 'No subcollection members yet',
            });

            // Delete the auto-created subcollection member for this test
            await getGroupMemberService().deleteMemberFromSubcollection(newGroup.id, testUser1.uid);
            
            const members = await getGroupMemberService().getMembersFromSubcollection(newGroup.id);
            expect(members).toHaveLength(0);
        });
    });

    describe('updateMemberInSubcollection', () => {
        test('should update member role and status', async () => {
            // Add member first
            const memberDoc: GroupMemberDocument = {
                userId: testUser2.uid,
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };
            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            // Update the member
            await getGroupMemberService().updateMemberInSubcollection(testGroup.id, testUser2.uid, {
                role: MemberRoles.ADMIN,
                status: MemberStatuses.PENDING,
            });

            // Verify update
            const updatedMember = await getGroupMemberService().getMemberFromSubcollection(testGroup.id, testUser2.uid);
            expect(updatedMember?.role).toBe(MemberRoles.ADMIN);
            expect(updatedMember?.status).toBe(MemberStatuses.PENDING);
            expect(updatedMember?.userId).toBe(testUser2.uid); // Other fields unchanged
        });
    });

    describe('deleteMemberFromSubcollection', () => {
        test('should delete member from subcollection', async () => {
            // Add member first
            const memberDoc: GroupMemberDocument = {
                userId: testUser2.uid,
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };
            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            // Verify member exists
            let member = await getGroupMemberService().getMemberFromSubcollection(testGroup.id, testUser2.uid);
            expect(member).toBeDefined();

            // Delete member
            await getGroupMemberService().deleteMemberFromSubcollection(testGroup.id, testUser2.uid);

            // Verify member is deleted
            member = await getGroupMemberService().getMemberFromSubcollection(testGroup.id, testUser2.uid);
            expect(member).toBeNull();
        });

        test('should not throw error when deleting non-existent member', async () => {
            // Should not throw - let it bubble up if there's an actual error
            await getGroupMemberService().deleteMemberFromSubcollection(testGroup.id, 'non-existent-user');
        });
    });

    describe('getUserGroupsViaSubcollection - Scalable Query', () => {
        test('should return groups where user is a member via collectionGroup query', async () => {
            // Create additional groups
            const group2 = await getGroupService().createGroup(testUser2.uid, {
                name: 'User2 Group',
                description: 'Second group',
            });

            const group3 = await getGroupService().createGroup(testUser1.uid, {
                name: 'Another Group',
                description: 'Third group',
            });

            // Add testUser1 to group2 via subcollection
            const memberDoc: GroupMemberDocument = {
                userId: testUser1.uid,
                groupId: group2.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser2.uid,
            };
            await getGroupMemberService().createMemberSubcollection(group2.id, memberDoc);

            // Query for testUser1's groups using scalable query
            const userGroups = await getGroupMemberService().getUserGroupsViaSubcollection(testUser1.uid);
            
            // Should find groups where testUser1 is a member (including our test groups)
            expect(userGroups).toContain(testGroup.id); // Creator of testGroup
            expect(userGroups).toContain(group2.id);    // Member of group2  
            expect(userGroups).toContain(group3.id);    // Creator of group3
            expect(userGroups.length).toBeGreaterThanOrEqual(3); // May have more from other tests
        });

        test('should query correctly for user with existing groups', async () => {
            const testUser = users[4]; // Use pre-borrowed user
            
            // Check current groups for this user
            const initialGroups = await getGroupMemberService().getUserGroupsViaSubcollection(testUser.uid);
            const initialCount = initialGroups.length;
            
            // Create a new group for this user
            const newGroup = await getGroupService().createGroup(testUser.uid, {
                name: 'New Test Group for User4',
                description: 'Testing query functionality',
            });
            
            // Query again - should include the new group
            const updatedGroups = await getGroupMemberService().getUserGroupsViaSubcollection(testUser.uid);
            expect(updatedGroups).toContain(newGroup.id);
            expect(updatedGroups.length).toBe(initialCount + 1);
        });

        test('should work with large number of groups (scalability test)', async () => {
            // Create multiple groups for testUser1
            const groupPromises = [];
            for (let i = 0; i < 10; i++) {
                groupPromises.push(
                    getGroupService().createGroup(testUser1.uid, {
                        name: `Scale Test Group ${i}`,
                        description: `Group ${i} for scalability testing`,
                    })
                );
            }
            const groups = await Promise.all(groupPromises);

            // Query should efficiently find all groups
            const userGroups = await getGroupMemberService().getUserGroupsViaSubcollection(testUser1.uid);
            
            // Should include original testGroup + 10 new groups = 11 total
            expect(userGroups.length).toBeGreaterThanOrEqual(11);
            
            // Verify all new groups are included
            const groupIds = groups.map(g => g.id);
            for (const groupId of groupIds) {
                expect(userGroups).toContain(groupId);
            }
        });
    });

    describe('getGroupMembersResponseFromSubcollection', () => {
        test('should return GroupMembersResponse with profile data from subcollection', async () => {
            // Add second member
            const memberDoc: GroupMemberDocument = {
                userId: testUser2.uid,
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(1),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };
            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            // Get members response
            const response = await getGroupMemberService().getGroupMembersResponseFromSubcollection(testGroup.id);
            
            expect(response.members).toHaveLength(2);
            expect(response.hasMore).toBe(false);
            
            // Verify profile data is merged correctly
            const member1 = response.members.find(m => m.uid === testUser1.uid);
            const member2 = response.members.find(m => m.uid === testUser2.uid);
            
            expect(member1).toBeDefined();
            expect(member1?.displayName).toBe(testUser1.displayName);
            expect(member1?.email).toBe(testUser1.email);
            expect(member1?.memberRole).toBe(MemberRoles.ADMIN);
            expect(member1?.initials).toBeDefined();
            
            expect(member2).toBeDefined();
            expect(member2?.displayName).toBe(testUser2.displayName);
            expect(member2?.email).toBe(testUser2.email);
            expect(member2?.memberRole).toBe(MemberRoles.MEMBER);
            expect(member2?.initials).toBeDefined();
        });

        test('should handle unknown users gracefully', async () => {
            // Add member with non-existent user profile
            const memberDoc: GroupMemberDocument = {
                userId: 'unknown-user-id',
                groupId: testGroup.id,
                role: MemberRoles.MEMBER,
                theme: getThemeColorForMember(2),
                joinedAt: new Date().toISOString(),
                status: MemberStatuses.ACTIVE,
                invitedBy: testUser1.uid,
            };
            await getGroupMemberService().createMemberSubcollection(testGroup.id, memberDoc);

            const response = await getGroupMemberService().getGroupMembersResponseFromSubcollection(testGroup.id);
            
            const unknownMember = response.members.find(m => m.uid === 'unknown-user-id');
            expect(unknownMember).toBeDefined();
            expect(unknownMember?.displayName).toBe('Unknown User');
            expect(unknownMember?.email).toBe('');
            expect(unknownMember?.initials).toBe('?');
            expect(unknownMember?.memberRole).toBe(MemberRoles.MEMBER);
        });

        test('should sort members by display name', async () => {
            // Use additional users from borrowed users
            const user3 = users[2]; // Charlie Test
            const user4 = users[3]; // Alice Test

            const memberDocs: GroupMemberDocument[] = [
                {
                    userId: user3.uid,
                    groupId: testGroup.id,
                    role: MemberRoles.MEMBER,
                    theme: getThemeColorForMember(2),
                    joinedAt: new Date().toISOString(),
                    status: MemberStatuses.ACTIVE,
                    invitedBy: testUser1.uid,
                },
                {
                    userId: user4.uid,
                    groupId: testGroup.id,
                    role: MemberRoles.MEMBER,
                    theme: getThemeColorForMember(3),
                    joinedAt: new Date().toISOString(),
                    status: MemberStatuses.ACTIVE,
                    invitedBy: testUser1.uid,
                }
            ];

            for (const doc of memberDocs) {
                await getGroupMemberService().createMemberSubcollection(testGroup.id, doc);
            }

            const response = await getGroupMemberService().getGroupMembersResponseFromSubcollection(testGroup.id);
            
            // Should be sorted by displayName
            const displayNames = response.members.map(m => m.displayName);
            const sortedNames = [...displayNames].sort();
            expect(displayNames).toEqual(sortedNames);
        });
    });
});