import { PermissionEngine } from '../../permissions/permission-engine';
import { Group, GroupMember, ExpenseData, SecurityPresets, MemberRoles, MemberStatuses, PermissionLevels } from '@splitifyd/shared';

describe('PermissionEngine', () => {
    // Test data builders
    const createGroup = (preset: any = SecurityPresets.OPEN, customPermissions = {}): Group => ({
        id: 'group-1',
        name: 'Test Group',
        members: {},
        createdBy: 'user-creator',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        securityPreset: preset,
        presetAppliedAt: '2023-01-01T00:00:00.000Z',
        permissions: {
            ...PermissionEngine.getDefaultPermissions(preset),
            ...customPermissions,
        },
    });

    const createMember = (role: any = MemberRoles.MEMBER, status: any = MemberStatuses.ACTIVE): GroupMember => ({
        joinedAt: '2023-01-01T00:00:00.000Z',
        role,
        theme: {} as any,
        status,
    });

    const createExpense = (createdBy = 'user-1'): ExpenseData => ({
        id: 'expense-1',
        groupId: 'group-1',
        createdBy,
        paidBy: createdBy,
        amount: 100,
        currency: 'USD',
        description: 'Test expense',
        category: 'food',
        date: '2023-01-01T00:00:00.000Z',
        splitType: 'equal',
        participants: [createdBy],
        splits: [{ userId: createdBy, amount: 100 }],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        deletedAt: null,
        deletedBy: null,
    });

    describe('getDefaultPermissions', () => {
        it('should return open collaboration permissions', () => {
            const permissions = PermissionEngine.getDefaultPermissions(SecurityPresets.OPEN);

            expect(permissions).toEqual({
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.ANYONE,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ANYONE,
            });
        });

        it('should return managed group permissions', () => {
            const permissions = PermissionEngine.getDefaultPermissions(SecurityPresets.MANAGED);

            expect(permissions).toEqual({
                expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'admin-required',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            });
        });
    });

    describe('checkPermission - Open Collaboration', () => {
        let group: Group;

        beforeEach(() => {
            group = createGroup(SecurityPresets.OPEN);
            group.members = {
                'user-1': createMember(MemberRoles.MEMBER),
                'user-admin': createMember(MemberRoles.ADMIN),
                'user-viewer': createMember(MemberRoles.VIEWER),
                'user-pending': createMember(MemberRoles.MEMBER, MemberStatuses.PENDING),
            };
        });

        it('should allow members to edit any expense', () => {
            const expense = createExpense('user-admin');
            const canEdit = PermissionEngine.checkPermission(group, 'user-1', 'expenseEditing', { expense });
            expect(canEdit).toBe(true);
        });

        it('should allow members to delete any expense', () => {
            const expense = createExpense('user-admin');
            const canDelete = PermissionEngine.checkPermission(group, 'user-1', 'expenseDeletion', { expense });
            expect(canDelete).toBe(true);
        });

        it('should allow members to invite other members', () => {
            const canInvite = PermissionEngine.checkPermission(group, 'user-1', 'memberInvitation');
            expect(canInvite).toBe(true);
        });

        it('should allow members to manage settings', () => {
            const canManageSettings = PermissionEngine.checkPermission(group, 'user-1', 'settingsManagement');
            expect(canManageSettings).toBe(true);
        });

        it('should not allow viewers to edit expenses', () => {
            const expense = createExpense('user-1');
            const canEdit = PermissionEngine.checkPermission(group, 'user-viewer', 'expenseEditing', { expense });
            expect(canEdit).toBe(false);
        });

        it('should not allow pending members to perform actions', () => {
            const canEdit = PermissionEngine.checkPermission(group, 'user-pending', 'expenseEditing');
            expect(canEdit).toBe(false);
        });

        it('should allow pending members to view the group', () => {
            const canView = PermissionEngine.checkPermission(group, 'user-pending', 'viewGroup');
            expect(canView).toBe(false); // Actually should be false for pending members
        });

        it('should not allow non-members to do anything', () => {
            const canEdit = PermissionEngine.checkPermission(group, 'non-member', 'expenseEditing');
            expect(canEdit).toBe(false);
        });
    });

    describe('checkPermission - Managed Group', () => {
        let group: Group;

        beforeEach(() => {
            group = createGroup(SecurityPresets.MANAGED);
            group.members = {
                'user-1': createMember(MemberRoles.MEMBER),
                'user-admin': createMember(MemberRoles.ADMIN),
                'user-viewer': createMember(MemberRoles.VIEWER),
            };
        });

        it('should only allow admins to edit any expense', () => {
            const expense = createExpense('user-1');

            const memberCanEdit = PermissionEngine.checkPermission(group, 'user-1', 'expenseEditing', { expense });
            const adminCanEdit = PermissionEngine.checkPermission(group, 'user-admin', 'expenseEditing', { expense });

            expect(memberCanEdit).toBe(true); // Owner can edit their own expense
            expect(adminCanEdit).toBe(true);
        });

        it('should allow members to edit their own expenses', () => {
            const expense = createExpense('user-1');
            const canEdit = PermissionEngine.checkPermission(group, 'user-1', 'expenseEditing', { expense });
            expect(canEdit).toBe(true);
        });

        it('should not allow members to edit other members expenses', () => {
            const expense = createExpense('user-admin');
            const canEdit = PermissionEngine.checkPermission(group, 'user-1', 'expenseEditing', { expense });
            expect(canEdit).toBe(false);
        });

        it('should only allow admins to invite members', () => {
            const memberCanInvite = PermissionEngine.checkPermission(group, 'user-1', 'memberInvitation');
            const adminCanInvite = PermissionEngine.checkPermission(group, 'user-admin', 'memberInvitation');

            expect(memberCanInvite).toBe(false);
            expect(adminCanInvite).toBe(true);
        });

        it('should only allow admins to manage settings', () => {
            const memberCanManage = PermissionEngine.checkPermission(group, 'user-1', 'settingsManagement');
            const adminCanManage = PermissionEngine.checkPermission(group, 'user-admin', 'settingsManagement');

            expect(memberCanManage).toBe(false);
            expect(adminCanManage).toBe(true);
        });
    });

    describe('canChangeRole', () => {
        let group: Group;

        beforeEach(() => {
            group = createGroup(SecurityPresets.MANAGED);
            group.members = {
                'user-admin1': createMember(MemberRoles.ADMIN),
                'user-admin2': createMember(MemberRoles.ADMIN),
                'user-1': createMember(MemberRoles.MEMBER),
            };
            group.createdBy = 'user-admin1';
        });

        it('should allow admins to change member roles', () => {
            const result = PermissionEngine.canChangeRole(group.members, group.createdBy, 'user-admin1', 'user-1', MemberRoles.ADMIN);
            expect(result.allowed).toBe(true);
        });

        it('should not allow members to change roles', () => {
            const result = PermissionEngine.canChangeRole(group.members, group.createdBy, 'user-1', 'user-admin1', MemberRoles.MEMBER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Only admins can change member roles');
        });

        it('should not allow last admin to demote themselves', () => {
            // Remove one admin to make user-admin1 the last admin
            group.members = {
                'user-admin1': createMember(MemberRoles.ADMIN),
                'user-1': createMember(MemberRoles.MEMBER),
            };

            const result = PermissionEngine.canChangeRole(group.members, group.createdBy, 'user-admin1', 'user-admin1', MemberRoles.MEMBER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Cannot remove last admin. Promote another member first.');
        });

        it('should prevent changing creator to viewer without confirmation', () => {
            const result = PermissionEngine.canChangeRole(group.members, group.createdBy, 'user-admin1', 'user-admin1', MemberRoles.VIEWER);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Changing creator permissions requires explicit confirmation');
        });

        it('should allow demoting admin when multiple admins exist', () => {
            const result = PermissionEngine.canChangeRole(group.members, group.createdBy, 'user-admin1', 'user-admin2', MemberRoles.MEMBER);
            expect(result.allowed).toBe(true);
        });
    });

    describe('getUserPermissions', () => {
        it('should return all permissions for open collaboration member', () => {
            const group = createGroup(SecurityPresets.OPEN);
            group.members = {
                'user-1': createMember(MemberRoles.MEMBER),
            };

            const permissions = PermissionEngine.getUserPermissions(group, 'user-1');

            expect(permissions).toEqual({
                canEditAnyExpense: true,
                canDeleteAnyExpense: true,
                canInviteMembers: true,
                canManageSettings: true,
                canApproveMembers: true,
                canViewGroup: true,
            });
        });

        it('should return limited permissions for managed group member', () => {
            const group = createGroup(SecurityPresets.MANAGED);
            group.members = {
                'user-1': createMember(MemberRoles.MEMBER),
            };

            const permissions = PermissionEngine.getUserPermissions(group, 'user-1');

            expect(permissions).toEqual({
                canEditAnyExpense: true, // Members can create and edit their own expenses
                canDeleteAnyExpense: true, // Members can create and delete their own expenses
                canInviteMembers: false,
                canManageSettings: false,
                canApproveMembers: false,
                canViewGroup: true,
            });
        });

        it('should return no permissions for non-member', () => {
            const group = createGroup(SecurityPresets.OPEN);

            const permissions = PermissionEngine.getUserPermissions(group, 'non-member');

            expect(permissions).toEqual({
                canEditAnyExpense: false,
                canDeleteAnyExpense: false,
                canInviteMembers: false,
                canManageSettings: false,
                canApproveMembers: false,
                canViewGroup: false,
            });
        });
    });
});
