import { randomChoice } from '../test-helpers';

interface PermissionSet {
    expenseEditing: string;
    expenseDeletion: string;
    memberInvitation: string;
    memberApproval: string;
    settingsManagement: string;
}

export class PermissionSetBuilder {
    private permissions: PermissionSet;

    constructor() {
        // Default to random permissions for variety
        this.permissions = {
            expenseEditing: randomChoice(['anyone', 'owner-and-admin', 'admin-only']),
            expenseDeletion: randomChoice(['anyone', 'owner-and-admin', 'admin-only']),
            memberInvitation: randomChoice(['anyone', 'owner-and-admin', 'admin-only']),
            memberApproval: randomChoice(['automatic', 'admin-required']),
            settingsManagement: randomChoice(['anyone', 'owner-and-admin', 'admin-only']),
        };
    }

    withExpenseEditing(level: string): this {
        this.permissions.expenseEditing = level;
        return this;
    }

    withExpenseDeletion(level: string): this {
        this.permissions.expenseDeletion = level;
        return this;
    }

    withMemberInvitation(level: string): this {
        this.permissions.memberInvitation = level;
        return this;
    }

    withMemberApproval(level: string): this {
        this.permissions.memberApproval = level;
        return this;
    }

    withSettingsManagement(level: string): this {
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

    asStrictPermissions(): this {
        this.permissions = {
            expenseEditing: 'admin-only',
            expenseDeletion: 'admin-only',
            memberInvitation: 'admin-only',
            memberApproval: 'admin-required',
            settingsManagement: 'admin-only',
        };
        return this;
    }

    build(): PermissionSet {
        return {
            expenseEditing: this.permissions.expenseEditing,
            expenseDeletion: this.permissions.expenseDeletion,
            memberInvitation: this.permissions.memberInvitation,
            memberApproval: this.permissions.memberApproval,
            settingsManagement: this.permissions.settingsManagement,
        };
    }
}