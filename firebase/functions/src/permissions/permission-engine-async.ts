import { ExpenseDTO, GroupDTO, GroupPermissions, MemberRoles, MemberStatuses, PermissionLevels } from '@splitifyd/shared';
import { IFirestoreReader } from '../services/firestore';

interface PermissionCheckOptions {
    expense?: ExpenseDTO;
    targetUserId?: string;
}

export class PermissionEngineAsync {
    /**
     * Check if a user has permission to perform an action in a group (async version)
     */
    static async checkPermission(
        firestoreReader: IFirestoreReader,
        group: GroupDTO,
        userId: string,
        action: keyof GroupPermissions | 'viewGroup',
        options: PermissionCheckOptions = {},
    ): Promise<boolean> {
        if (!group.permissions) {
            throw new Error(`Group ${group.id} is missing permissions configuration`);
        }

        const member = await firestoreReader.getGroupMember(group.id, userId);
        if (!member) {
            return false;
        }

        if (member.memberStatus !== MemberStatuses.ACTIVE && action !== 'viewGroup') {
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

            case PermissionLevels.OWNER_AND_ADMIN:
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
