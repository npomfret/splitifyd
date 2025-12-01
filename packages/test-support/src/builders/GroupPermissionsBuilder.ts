import type { GroupPermissions, PermissionLevel } from '@billsplit-wl/shared';
import { PermissionLevels } from '@billsplit-wl/shared';

/**
 * Builder for creating GroupPermissions objects for testing
 * Used for updateGroupPermissions API calls
 */
export class GroupPermissionsBuilder {
    private permissions: Partial<GroupPermissions> = {};

    withExpenseEditing(level: PermissionLevel): this {
        this.permissions.expenseEditing = level;
        return this;
    }

    withExpenseDeletion(level: PermissionLevel): this {
        this.permissions.expenseDeletion = level;
        return this;
    }

    withMemberInvitation(level: PermissionLevel): this {
        this.permissions.memberInvitation = level;
        return this;
    }

    withMemberApproval(approval: 'automatic' | 'admin-required'): this {
        this.permissions.memberApproval = approval;
        return this;
    }

    withSettingsManagement(level: PermissionLevel): this {
        this.permissions.settingsManagement = level;
        return this;
    }

    build(): Partial<GroupPermissions> {
        return { ...this.permissions };
    }

    /**
     * Creates a builder preset for admin-only permissions
     */
    static adminOnly(): GroupPermissionsBuilder {
        return new GroupPermissionsBuilder()
            .withExpenseEditing(PermissionLevels.OWNER_AND_ADMIN)
            .withExpenseDeletion(PermissionLevels.OWNER_AND_ADMIN)
            .withMemberInvitation(PermissionLevels.ADMIN_ONLY)
            .withMemberApproval('admin-required')
            .withSettingsManagement(PermissionLevels.ADMIN_ONLY);
    }

    /**
     * Creates a builder preset for member approval only (other permissions unchanged)
     */
    static requireAdminApproval(): GroupPermissionsBuilder {
        return new GroupPermissionsBuilder()
            .withMemberApproval('admin-required');
    }

    /**
     * Creates a builder preset for automatic approval only
     */
    static automaticApproval(): GroupPermissionsBuilder {
        return new GroupPermissionsBuilder()
            .withMemberApproval('automatic');
    }
}
