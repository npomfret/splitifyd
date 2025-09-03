import { GroupPermissions, SecurityPreset, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { ExpenseData } from '@splitifyd/shared';

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

}
