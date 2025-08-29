import { test, describe, beforeAll, afterAll, expect } from 'vitest';
import { ApiDriver, User, generateNewUserDetails } from '@splitifyd/test-support';
import { Group, MemberRoles, SecurityPresets } from '@splitifyd/shared';
import {firestoreDb} from "../../firebase";

describe('Group Permissions', () => {
    let apiDriver: ApiDriver;
    let adminUser: User;
    let memberUser: User;
    let group: Group;

    beforeAll(async () => {
        apiDriver = new ApiDriver(firestoreDb);
        adminUser = await apiDriver.createUser(generateNewUserDetails('admin'));
        memberUser = await apiDriver.createUser(generateNewUserDetails('member'));
        const groupData = {
            name: 'Permission Test Group',
        };
        group = await apiDriver.createGroupWithMembers(groupData.name, [adminUser, memberUser], adminUser.token);

        // Make adminUser an admin
        await apiDriver.setMemberRole(group.id, adminUser.token, adminUser.uid, MemberRoles.ADMIN);

        // Re-fetch group to get updated member roles
        group = await apiDriver.getGroup(group.id, adminUser.token);
    });

    afterAll(async () => {
        // Cleanup logic if needed
    });

    describe('Security Presets', () => {
        test('Admin can apply a security preset', async () => {
            await apiDriver.applySecurityPreset(group.id, adminUser.token, SecurityPresets.MANAGED);

            const updatedGroup = await apiDriver.getGroup(group.id, adminUser.token);
            expect(updatedGroup.securityPreset).toBe(SecurityPresets.MANAGED);
            expect(updatedGroup.permissions.expenseEditing).toBe('owner-and-admin');
        });

        test('Member cannot apply a security preset', async () => {
            await expect(apiDriver.applySecurityPreset(group.id, memberUser.token, SecurityPresets.OPEN)).rejects.toThrow('failed with status 403');
        });
    });

    describe('Member Roles', () => {
        test('Admin can change a member role', async () => {
            await apiDriver.setMemberRole(group.id, adminUser.token, memberUser.uid, MemberRoles.ADMIN);

            const updatedGroup = await apiDriver.getGroup(group.id, adminUser.token);
            expect(updatedGroup.members[memberUser.uid].role).toBe(MemberRoles.ADMIN);

            // Change back to member for other tests
            await apiDriver.setMemberRole(group.id, adminUser.token, memberUser.uid, MemberRoles.MEMBER);
        });

        test('Member cannot change a member role', async () => {
            await expect(apiDriver.setMemberRole(group.id, memberUser.token, adminUser.uid, MemberRoles.MEMBER)).rejects.toThrow('failed with status 403');
        });

        test('Last admin cannot be demoted', async () => {
            // First, demote the other admin
            await apiDriver.setMemberRole(group.id, adminUser.token, memberUser.uid, MemberRoles.MEMBER);

            await expect(apiDriver.setMemberRole(group.id, adminUser.token, adminUser.uid, MemberRoles.MEMBER)).rejects.toThrow('failed with status 400');
        });
    });

    // NOTE: Pending member approval endpoints are not yet implemented
    // These tests are commented out until the features are built
    // (Tests for features that don't exist yet violate testing guidelines)

    // describe('Pending Members', () => {
    //     let pendingUser: User;

    //     beforeAll(async () => {
    //         // Set group to require admin approval
    //         await apiDriver.applySecurityPreset(group.id, adminUser.token, SecurityPresets.MANAGED);
    //         pendingUser = await apiDriver.createUser(generateNewUserDetails('pending'));
    //         const shareLink = await apiDriver.generateShareLink(group.id, adminUser.token);
    //         await apiDriver.joinGroupViaShareLink(shareLink.linkId, pendingUser.token);
    //     });

    //     test('Admin can get list of pending members', async () => {
    //         const pendingMembers = await apiDriver.getPendingMembers(group.id, adminUser.token);
    //         expect(pendingMembers.count).toBe(1);
    //         expect(pendingMembers.pendingMembers[0].user.uid).toBe(pendingUser.uid);
    //     });

    //     test('Member cannot get list of pending members', async () => {
    //         await expect(
    //             apiDriver.getPendingMembers(group.id, memberUser.token)
    //         ).rejects.toThrow('failed with status 403');
    //     });

    //     test('Admin can approve a pending member', async () => {
    //         await apiDriver.approveMember(group.id, adminUser.token, pendingUser.uid);
    //         const updatedGroup = await apiDriver.getGroup(group.id, adminUser.token);
    //         expect(updatedGroup.members[pendingUser.uid].status).toBe(MemberStatuses.ACTIVE);
    //     });

    //     test('Admin can reject a pending member', async () => {
    //         const userToReject = await apiDriver.createUser(generateNewUserDetails('reject'));
    //         const shareLink = await apiDriver.generateShareLink(group.id, adminUser.token);
    //         await apiDriver.joinGroupViaShareLink(shareLink.linkId, userToReject.token);

    //         await apiDriver.rejectMember(group.id, adminUser.token, userToReject.uid);
    //         const updatedGroup = await apiDriver.getGroup(group.id, adminUser.token);
    //         expect(updatedGroup.members[userToReject.uid]).toBeUndefined();
    //     });
    // });
});
