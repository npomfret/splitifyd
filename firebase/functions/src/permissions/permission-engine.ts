import { Group, MemberRole, PermissionLevel, GroupPermissions, SecurityPreset, SecurityPresets, MemberRoles, PermissionLevels, MemberStatuses } from '@splitifyd/shared';
import { ExpenseData } from '@splitifyd/shared';
import {GroupMember} from "@splitifyd/shared/src";

export interface PermissionCheckOptions {
    expense?: ExpenseData;
    targetUserId?: string;
}

export class PermissionEngine {
    /**
     * Check if a user has permission to perform an action in a group
     */
    static checkPermission(group: Group, userId: string, action: keyof GroupPermissions | 'viewGroup', options: PermissionCheckOptions = {}): boolean {
        // Validate group has required permission structure
        if (!group.permissions) {
            throw new Error(`Group ${group.id} is missing permissions configuration`);
        }

        // Basic group membership check
        const member = group.members[userId];
        if (!member) {
            return false; // User is not a member of the group
        }

        // Inactive members can't do anything except view
        if (member.status !== MemberStatuses.ACTIVE && action !== 'viewGroup') {
            return false;
        }

        // Handle view permission (all active members can view)
        if (action === 'viewGroup') {
            return member.status === MemberStatuses.ACTIVE;
        }

        // Viewer role can only read, never modify
        if (member.role === MemberRoles.VIEWER && ['expenseEditing', 'expenseDeletion', 'memberInvitation', 'settingsManagement'].includes(action)) {
            return false;
        }

        const permission = group.permissions[action];
        if (permission === undefined) {
            throw new Error(`Group ${group.id} is missing permission setting for action: ${action}`);
        }

        return this.evaluatePermission(permission, member.role, userId, options);
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
                // For creation operations (no existing resource), allow members
                if (!options.expense && userRole === MemberRoles.MEMBER) {
                    return true;
                }
                // For existing resources, check if user is the owner
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
     * Get default permissions for a security preset
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
                // Return open permissions as default fallback
                return this.getDefaultPermissions(SecurityPresets.OPEN);
        }
    }

    /**
     * Check if user can change another user's role
     */
    static canChangeRole(members: Record<string, GroupMember>, createdBy: string, actorUserId: string, targetUserId: string, newRole: MemberRole): { allowed: boolean; reason?: string } {
        const actorMember = members[actorUserId];
        const targetMember = members[targetUserId];

        if (!actorMember || !targetMember) {
            return { allowed: false, reason: 'User not found in group' };
        }

        // Only admins can change roles
        if (actorMember.role !== MemberRoles.ADMIN) {
            return { allowed: false, reason: 'Only admins can change member roles' };
        }

        // Prevent last admin from demoting themselves
        if (actorUserId === targetUserId && actorMember.role === MemberRoles.ADMIN && newRole !== MemberRoles.ADMIN) {
            const adminCount = Object.values(members).filter((m) => m.role === MemberRoles.ADMIN && m.status === MemberStatuses.ACTIVE).length;

            if (adminCount === 1) {
                return {
                    allowed: false,
                    reason: 'Cannot remove last admin. Promote another member first.',
                };
            }
        }

        // Prevent changing group creator to viewer without explicit confirmation
        if (targetUserId === createdBy && newRole === MemberRoles.VIEWER) {
            return {
                allowed: false,
                reason: 'Changing creator permissions requires explicit confirmation',
            };
        }

        return { allowed: true };
    }

    /**
     * Get user's effective permissions in a group (for UI display)
     */
    static getUserPermissions(group: Group, userId: string): Record<string, boolean> {
        return {
            canEditAnyExpense: this.checkPermission(group, userId, 'expenseEditing'),
            canDeleteAnyExpense: this.checkPermission(group, userId, 'expenseDeletion'),
            canInviteMembers: this.checkPermission(group, userId, 'memberInvitation'),
            canManageSettings: this.checkPermission(group, userId, 'settingsManagement'),
            canApproveMembers: this.checkPermission(group, userId, 'memberApproval'),
            canViewGroup: this.checkPermission(group, userId, 'viewGroup'),
        };
    }
}
