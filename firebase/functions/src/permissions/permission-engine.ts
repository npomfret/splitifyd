import { Group, MemberRole, PermissionLevel, GroupPermissions, SecurityPreset, SecurityPresets, MemberRoles, PermissionLevels, MemberStatuses } from '@splitifyd/shared';
import { ExpenseData } from '@splitifyd/shared';
import {GroupMember} from "@splitifyd/shared/src";

export interface PermissionCheckOptions {
    expense?: ExpenseData;
    targetUserId?: string;
}

/**
 * @deprecated Use PermissionEngineAsync instead for scalable subcollection-based permissions
 */
export class PermissionEngine {


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
     * @deprecated Use PermissionEngineAsync.canChangeRole instead for scalable subcollection queries
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

}
