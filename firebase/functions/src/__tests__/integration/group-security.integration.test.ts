import { GroupMembershipDTO, MemberRoles, MemberStatuses, PermissionLevels } from '@splitifyd/shared';
import { ApiDriver, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_TIMEOUT_MS = 60_000;

describe('Group Security Endpoints', () => {
    const apiDriver = new ApiDriver();
    let adminUser: Awaited<ReturnType<ApiDriver['createUser']>>;
    let memberUser: Awaited<ReturnType<ApiDriver['createUser']>>;
    let extraUser: Awaited<ReturnType<ApiDriver['createUser']>>;

    beforeAll(async () => {
        adminUser = await apiDriver.createUser();
        memberUser = await apiDriver.createUser();
        extraUser = await apiDriver.createUser();
    }, TEST_TIMEOUT_MS);

    afterAll(async () => {
        // No teardown required - the emulator resets between test runs
    });

    it(
        'should support managed presets, approvals, role changes, and custom permissions',
        async () => {
            const groupRequest = new CreateGroupRequestBuilder()
                .withName(`Security Managed Group ${Date.now()}`)
                .withDescription('Group for security endpoint validation')
                .build();

            const group = await apiDriver.createGroup(groupRequest, adminUser.token);

            await apiDriver.updateGroupPermissions(
                group.id,
                {
                    expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                    expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                    memberInvitation: PermissionLevels.ADMIN_ONLY,
                    memberApproval: 'admin-required',
                    settingsManagement: PermissionLevels.ADMIN_ONLY,
                },
                adminUser.token,
            );

            const detailsAfterPreset = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            expect(detailsAfterPreset.group.permissions).toMatchObject({
                expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'admin-required',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            });

            const { linkId } = await apiDriver.generateShareableLink(group.id, adminUser.token);

            const joinResult = await apiDriver.joinGroupByLink(linkId, memberUser.token);
            expect(joinResult.success).toBe(false);
            expect(joinResult.memberStatus).toBe(MemberStatuses.PENDING);

            let pendingMembers = await apiDriver.getPendingMembers(group.id, adminUser.token);
            expect(findMember(pendingMembers, memberUser.uid)?.memberStatus).toBe(MemberStatuses.PENDING);

            await apiDriver.approveMember(group.id, memberUser.uid, adminUser.token);

            pendingMembers = await apiDriver.getPendingMembers(group.id, adminUser.token);
            expect(findMember(pendingMembers, memberUser.uid)).toBeUndefined();

            const detailsAfterApproval = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            const approvedMember = detailsAfterApproval.members.members.find((m) => m.uid === memberUser.uid);
            expect(approvedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);

            await apiDriver.updateMemberRole(group.id, memberUser.uid, MemberRoles.ADMIN, adminUser.token);

            const detailsAfterRoleChange = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            const promotedMember = detailsAfterRoleChange.members.members.find((m) => m.uid === memberUser.uid);
            expect(promotedMember?.memberRole).toBe(MemberRoles.ADMIN);

            await apiDriver.updateGroupPermissions(group.id, { expenseEditing: PermissionLevels.ADMIN_ONLY }, adminUser.token);

            const detailsAfterCustomPermissions = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            expect(detailsAfterCustomPermissions.group.permissions.expenseEditing).toBe(PermissionLevels.ADMIN_ONLY);

            const joinResultExtra = await apiDriver.joinGroupByLink(linkId, extraUser.token);
            expect(joinResultExtra.success).toBe(false);
            expect(joinResultExtra.memberStatus).toBe(MemberStatuses.PENDING);

            pendingMembers = await apiDriver.getPendingMembers(group.id, adminUser.token);
            expect(findMember(pendingMembers, extraUser.uid)?.memberStatus).toBe(MemberStatuses.PENDING);

            await apiDriver.rejectMember(group.id, extraUser.uid, adminUser.token);

            pendingMembers = await apiDriver.getPendingMembers(group.id, adminUser.token);
            expect(findMember(pendingMembers, extraUser.uid)).toBeUndefined();

            const finalDetails = await apiDriver.getGroupFullDetails(group.id, adminUser.token);
            const rejectedMember = finalDetails.members.members.find((m) => m.uid === extraUser.uid);
            expect(rejectedMember).toBeUndefined();
        },
        TEST_TIMEOUT_MS,
    );
});

function findMember(members: GroupMembershipDTO[], uid: string): GroupMembershipDTO | undefined {
    return members.find((member) => member.uid === uid);
}
