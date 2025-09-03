import {test, describe, expect, beforeEach} from 'vitest';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import { Group, MemberRoles, SecurityPresets } from '@splitifyd/shared';
import {ApiDriver} from "@splitifyd/test-support";

describe('Group Permissions', () => {
    const apiDriver = new ApiDriver();
    let group: Group;
    let adminUser: any;
    let memberUser: any;

    beforeEach(async () => {
        ([adminUser, memberUser] = await borrowTestUsers(3));

        const groupData = {
            name: 'Permission Test Group',
        };
        group = await apiDriver.createGroupWithMembers(groupData.name, [adminUser, memberUser], adminUser.token);

        // Make adminUser an admin
        await apiDriver.setMemberRole(group.id, adminUser.token, adminUser.uid, MemberRoles.ADMIN);

        // Re-fetch group to get updated member roles
        group = (await apiDriver.getGroupFullDetails(group.id, adminUser.token)).group;
    });

    describe('Security Presets', () => {
        test('Admin can apply a security preset', async () => {
            await apiDriver.applySecurityPreset(group.id, adminUser.token, SecurityPresets.MANAGED);

            const {group: updatedGroup} = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
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

            const {members} = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            const member = members.members.find((m) => m.uid === memberUser.uid);
            expect(member!.memberRole).toBe(MemberRoles.ADMIN);

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

});
