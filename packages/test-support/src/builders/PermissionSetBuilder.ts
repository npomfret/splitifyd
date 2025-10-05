import { GroupPermissions, PermissionLevel } from '@splitifyd/shared';
import { randomChoice } from '../test-helpers';

/**
 * Builder for creating GroupPermissions objects for tests
 * Provides preset configurations (open, managed) and custom permissions
 */
export class PermissionSetBuilder {
    private permissions: GroupPermissions;

    constructor() {
        // Default to random permissions for variety
        this.permissions = {
            expenseEditing: randomChoice(['anyone', 'owner-and-admin', 'admin-only'] as PermissionLevel[]),
            expenseDeletion: randomChoice(['anyone', 'owner-and-admin', 'admin-only'] as PermissionLevel[]),
            memberInvitation: randomChoice(['anyone', 'owner-and-admin', 'admin-only'] as PermissionLevel[]),
            memberApproval: randomChoice(['automatic', 'admin-required'] as ('automatic' | 'admin-required')[]),
            settingsManagement: randomChoice(['anyone', 'owner-and-admin', 'admin-only'] as PermissionLevel[]),
        };
    }

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

    withMemberApproval(level: 'automatic' | 'admin-required'): this {
        this.permissions.memberApproval = level;
        return this;
    }

    withSettingsManagement(level: PermissionLevel): this {
        this.permissions.settingsManagement = level;
        return this;
    }

    asOpenPermissions(): this {
        this.permissions = {
            expenseEditing: 'anyone',
            expenseDeletion: 'anyone',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'anyone',
        };
        return this;
    }

    asManagedPermissions(): this {
        this.permissions = {
            expenseEditing: 'owner-and-admin',
            expenseDeletion: 'owner-and-admin',
            memberInvitation: 'admin-only',
            memberApproval: 'admin-required',
            settingsManagement: 'admin-only',
        };
        return this;
    }

    build(): GroupPermissions {
        return { ...this.permissions };
    }
}