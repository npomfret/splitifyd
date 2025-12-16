import { ExpenseDTO, GroupDTO, GroupPermissions, MemberRoles, MemberStatuses, PermissionLevels } from '@billsplit-wl/shared';
import { GroupMembership } from '@billsplit-wl/shared';
import type { UserId } from '@billsplit-wl/shared';

interface PermissionCheckOptions {
    expense?: ExpenseDTO;
    targetUserId?: UserId;
}

export class PermissionEngineAsync {
    /**
     * Check if a user has permission to perform an action in a group (async version)
     */
    static checkPermission(member: GroupMembership | null, group: GroupDTO, userId: UserId, action: keyof GroupPermissions | 'viewGroup', options: PermissionCheckOptions = {}): boolean {
        if (!group.permissions) {
            throw new Error(`Group ${group.id} is missing permissions configuration`);
        }

        // User is not a member
        if (!member) {
            return false;
        }

        if (member.memberStatus !== MemberStatuses.ACTIVE && action !== 'viewGroup') {
            return false;
        }

        // Block all write actions if group is locked
        if (group.locked === true && action !== 'viewGroup') {
            return false;
        }

        if (action === 'viewGroup') {
            return member.memberStatus === MemberStatuses.ACTIVE;
        }

        if (member.memberRole === MemberRoles.VIEWER && ['expenseEditing', 'expenseDeletion', 'memberInvitation', 'settingsManagement'].includes(action)) {
            return false;
        }

        const permission = group.permissions[action];
        if (permission === undefined) {
            throw new Error(`Group ${group.id} is missing permission setting for action: ${action}`);
        }

        switch (permission) {
            case PermissionLevels.ANYONE:
                return member.memberRole !== MemberRoles.VIEWER;

            case PermissionLevels.CREATOR_AND_ADMIN:
                if (member.memberRole === MemberRoles.ADMIN) {
                    return true;
                }
                if (!options.expense && member.memberRole === MemberRoles.MEMBER) {
                    return true;
                }
                if (options.expense && options.expense.createdBy === userId) {
                    return true;
                }
                return false;

            case PermissionLevels.ADMIN_ONLY:
                return member.memberRole === MemberRoles.ADMIN;

            case 'automatic':
                return true;

            case 'admin-required':
                return member.memberRole === MemberRoles.ADMIN;

            default:
                return false;
        }
    }
}
