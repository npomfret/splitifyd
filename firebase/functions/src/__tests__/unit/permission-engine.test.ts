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
});
