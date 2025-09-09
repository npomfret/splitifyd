import { Group, MemberRole, PermissionLevel, GroupPermissions, SecurityPreset, SecurityPresets, MemberRoles, PermissionLevels, MemberStatuses } from '@splitifyd/shared';
import { ExpenseData } from '@splitifyd/shared';
import {IFirestoreReader} from "../services/firestore";

export interface PermissionCheckOptions {
    expense?: ExpenseData;
    targetUserId?: string;
}

// todo: this do not belong in here - move them to GroupPermissionService.ts
export class PermissionEngineAsync {
    /**
     * Check if a user has permission to perform an action in a group (async version)
     */
    static async checkPermission(firestoreReader: IFirestoreReader, group: Group, userId: string, action: keyof GroupPermissions | 'viewGroup', options: PermissionCheckOptions = {}): Promise<boolean> {
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

        return this.evaluatePermission(permission, member.memberRole, userId, options);
    }

    /**
     * Evaluate a specific permission level against user's role and context
     */
    private static evaluatePermission(permission: PermissionLevel | string, userRole: MemberRole, userId: string, options: PermissionCheckOptions): boolean {
        switch (permission) {
            case PermissionLevels.ANYONE:
                return userRole !== MemberRoles.VIEWER;

            case PermissionLevels.OWNER_AND_ADMIN:
                if (userRole === MemberRoles.ADMIN) {
                    return true;
                }
                if (!options.expense && userRole === MemberRoles.MEMBER) {
                    return true;
                }
                if (options.expense && options.expense.createdBy === userId) {
                    return true;
                }
                return false;

            case PermissionLevels.ADMIN_ONLY:
                return userRole === MemberRoles.ADMIN;

            case 'automatic':
                return true;

            case 'admin-required':
                return userRole === MemberRoles.ADMIN;

            default:
                return false;
        }
    }

    /**
     * Check if user can change another user's role (async version)
     */
    static async canChangeRole(firestoreReader: IFirestoreReader, groupId: string, createdBy: string, actorUserId: string, targetUserId: string, newRole: MemberRole): Promise<{ allowed: boolean; reason?: string }> {
        const [actorMember, targetMember] = await Promise.all([
            firestoreReader.getGroupMember(groupId, actorUserId),
            firestoreReader.getGroupMember(groupId, targetUserId),
        ]);

        if (!actorMember || !targetMember) {
            return { allowed: false, reason: 'User not found in group' };
        }

        if (actorMember.memberRole !== MemberRoles.ADMIN) {
            return { allowed: false, reason: 'Only admins can change member roles' };
        }

        if (actorUserId === targetUserId && actorMember.memberRole === MemberRoles.ADMIN && newRole !== MemberRoles.ADMIN) {
            const allMembers = await firestoreReader.getAllGroupMembers(groupId);
            const adminCount = allMembers.filter((m) => m.memberRole === MemberRoles.ADMIN && m.memberStatus === MemberStatuses.ACTIVE).length;

            if (adminCount === 1) {
                return {
                    allowed: false,
                    reason: 'Cannot remove last admin. Promote another member first.',
                };
            }
        }

        if (targetUserId === createdBy && newRole === MemberRoles.VIEWER) {
            return {
                allowed: false,
                reason: 'Changing creator permissions requires explicit confirmation',
            };
        }

        return { allowed: true };
    }

    /**
     * Get user's effective permissions in a group (async version)
     */
    static async getUserPermissions(firestoreReader: IFirestoreReader, group: Group, userId: string): Promise<Record<string, boolean>> {
        return {
            canEditAnyExpense: await this.checkPermission(firestoreReader, group, userId, 'expenseEditing'),
            canDeleteAnyExpense: await this.checkPermission(firestoreReader, group, userId, 'expenseDeletion'),
            canInviteMembers: await this.checkPermission(firestoreReader, group, userId, 'memberInvitation'),
            canManageSettings: await this.checkPermission(firestoreReader, group, userId, 'settingsManagement'),
            canApproveMembers: await this.checkPermission(firestoreReader, group, userId, 'memberApproval'),
            canViewGroup: await this.checkPermission(firestoreReader, group, userId, 'viewGroup'),
        };
    }

    /**
     * Get default permissions for a security preset (static method, no changes needed)
     */
    static getDefaultPermissions(preset: SecurityPreset): GroupPermissions {
        switch (preset) {
            case SecurityPresets.OPEN:
                return {
                    expenseEditing: PermissionLevels.ANYONE,
                    expenseDeletion: PermissionLevels.ANYONE,
                    memberInvitation: PermissionLevels.ANYONE,
                    memberApproval: 'automatic',
                    settingsManagement: PermissionLevels.ANYONE,
                };

            case SecurityPresets.MANAGED:
                return {
                    expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                    expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                    memberInvitation: PermissionLevels.ADMIN_ONLY,
                    memberApproval: 'admin-required',
                    settingsManagement: PermissionLevels.ADMIN_ONLY,
                };

            case SecurityPresets.CUSTOM:
            default:
                return this.getDefaultPermissions(SecurityPresets.OPEN);
        }
    }
}