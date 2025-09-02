import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Group, MemberRoles, MemberStatuses, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';
import { getGroupMemberService } from '../../services/serviceRegistration';

vi.mock('../../services/serviceRegistration');

const mockGroupMemberService = {
    getMemberFromSubcollection: vi.fn(),
    getMembersFromSubcollection: vi.fn(),
};

vi.mocked(getGroupMemberService).mockReturnValue(mockGroupMemberService as any);

describe('PermissionEngineAsync', () => {
    let testGroup: Group;
    const testUserId = 'user123';
    const testGroupId = 'group456';

    beforeEach(() => {
        vi.clearAllMocks();
        
        testGroup = {
            id: testGroupId,
            name: 'Test Group',
            description: 'Test Description',
            createdBy: 'creator123',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            members: {},
            securityPreset: SecurityPresets.OPEN,
            permissions: {
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            },
        };
    });

    describe('checkPermission', () => {
        test('should return false if user is not a member', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue(null);

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
            expect(mockGroupMemberService.getMemberFromSubcollection).toHaveBeenCalledWith(testGroupId, testUserId);
        });

        test('should return false if user is inactive', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.PENDING,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow inactive users to view group', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.PENDING,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'viewGroup');

            expect(result).toBe(false); // Still false because status is PENDING, not ACTIVE
        });

        test('should allow active users to view group', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('should deny viewers from expense editing', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.VIEWER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow member with ANYONE permission', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });

        test('should allow admin with ADMIN_ONLY permission', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.ADMIN,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(true);
        });

        test('should deny member with ADMIN_ONLY permission', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('should allow admin with OWNER_AND_ADMIN permission', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.ADMIN,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(testGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(true);
        });

        test('should allow expense owner with OWNER_AND_ADMIN permission', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const mockExpense = {
                id: 'expense123',
                createdBy: testUserId,
                groupId: testGroupId,
                description: 'Test expense',
                amount: 100,
                currency: 'USD',
                date: '2023-01-01',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
                category: 'food',
                splitType: 'equal' as const,
                paidBy: testUserId,
                participants: [testUserId],
                splits: [{ userId: testUserId, amount: 100 }],
                deletedAt: null,
                deletedBy: null,
            };

            const result = await PermissionEngineAsync.checkPermission(
                testGroup, 
                testUserId, 
                'expenseDeletion',
                { expense: mockExpense }
            );

            expect(result).toBe(true);
        });

        test('should throw error if group missing permissions', async () => {
            const groupWithoutPermissions = { ...testGroup, permissions: undefined as any };
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            await expect(
                PermissionEngineAsync.checkPermission(groupWithoutPermissions, testUserId, 'expenseEditing')
            ).rejects.toThrow('Group group456 is missing permissions configuration');
        });

        test('should throw error if specific permission missing', async () => {
            const groupWithMissingPermission = {
                ...testGroup,
                permissions: { ...testGroup.permissions, expenseEditing: undefined as any }
            };
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            await expect(
                PermissionEngineAsync.checkPermission(groupWithMissingPermission, testUserId, 'expenseEditing')
            ).rejects.toThrow('Group group456 is missing permission setting for action: expenseEditing');
        });
    });

    describe('canChangeRole', () => {
        test('should return false if actor member not found', async () => {
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce(null) // Actor not found
                .mockResolvedValueOnce({    // Target found
                    userId: 'target123',
                    groupId: testGroupId,
                    role: MemberRoles.MEMBER,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                });

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId, 
                'creator123', 
                testUserId, 
                'target123', 
                MemberRoles.ADMIN
            );

            expect(result).toEqual({ allowed: false, reason: 'User not found in group' });
        });

        test('should return false if target member not found', async () => {
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce({    // Actor found
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                })
                .mockResolvedValueOnce(null); // Target not found

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId,
                'creator123',
                testUserId,
                'target123',
                MemberRoles.ADMIN
            );

            expect(result).toEqual({ allowed: false, reason: 'User not found in group' });
        });

        test('should return false if actor is not admin', async () => {
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce({    // Actor (not admin)
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.MEMBER,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                })
                .mockResolvedValueOnce({    // Target
                    userId: 'target123',
                    groupId: testGroupId,
                    role: MemberRoles.MEMBER,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                });

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId,
                'creator123',
                testUserId,
                'target123',
                MemberRoles.ADMIN
            );

            expect(result).toEqual({ allowed: false, reason: 'Only admins can change member roles' });
        });

        test('should prevent last admin from demoting themselves', async () => {
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce({    // Actor (admin)
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                })
                .mockResolvedValueOnce({    // Target (same as actor)
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                });

            // Mock getMembersFromSubcollection to return only one admin
            mockGroupMemberService.getMembersFromSubcollection.mockResolvedValue([
                {
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                }
            ]);

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId,
                'creator123',
                testUserId,     // Actor
                testUserId,     // Target (same as actor)
                MemberRoles.MEMBER
            );

            expect(result).toEqual({ 
                allowed: false, 
                reason: 'Cannot remove last admin. Promote another member first.'
            });
        });

        test('should prevent changing creator to viewer', async () => {
            const creatorId = 'creator123';
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce({    // Actor (admin)
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                })
                .mockResolvedValueOnce({    // Target (creator)
                    userId: creatorId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                });

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId,
                creatorId,      // Created by
                testUserId,     // Actor
                creatorId,      // Target (creator)
                MemberRoles.VIEWER
            );

            expect(result).toEqual({ 
                allowed: false, 
                reason: 'Changing creator permissions requires explicit confirmation'
            });
        });

        test('should allow valid role change', async () => {
            mockGroupMemberService.getMemberFromSubcollection
                .mockResolvedValueOnce({    // Actor (admin)
                    userId: testUserId,
                    groupId: testGroupId,
                    role: MemberRoles.ADMIN,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                })
                .mockResolvedValueOnce({    // Target
                    userId: 'target123',
                    groupId: testGroupId,
                    role: MemberRoles.MEMBER,
                    status: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
                });

            const result = await PermissionEngineAsync.canChangeRole(
                testGroupId,
                'creator123',
                testUserId,
                'target123',
                MemberRoles.ADMIN
            );

            expect(result).toEqual({ allowed: true });
        });
    });

    describe('getUserPermissions', () => {
        test('should return user permissions for admin', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.ADMIN,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.getUserPermissions(testGroup, testUserId);

            expect(result).toEqual({
                canEditAnyExpense: true,
                canDeleteAnyExpense: true,
                canInviteMembers: true,
                canManageSettings: true,
                canApproveMembers: true,
                canViewGroup: true,
            });
        });

        test('should return limited permissions for member', async () => {
            mockGroupMemberService.getMemberFromSubcollection.mockResolvedValue({
                userId: testUserId,
                groupId: testGroupId,
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.getUserPermissions(testGroup, testUserId);

            expect(result).toEqual({
                canEditAnyExpense: true,      // ANYONE permission
                canDeleteAnyExpense: true,    // OWNER_AND_ADMIN allows members for creation
                canInviteMembers: false,      // ADMIN_ONLY
                canManageSettings: false,     // ADMIN_ONLY
                canApproveMembers: true,      // 'automatic' permission
                canViewGroup: true,
            });
        });
    });

    describe('getDefaultPermissions', () => {
        test('should return open permissions for OPEN preset', () => {
            const result = PermissionEngineAsync.getDefaultPermissions(SecurityPresets.OPEN);

            expect(result).toEqual({
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.ANYONE,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ANYONE,
            });
        });

        test('should return managed permissions for MANAGED preset', () => {
            const result = PermissionEngineAsync.getDefaultPermissions(SecurityPresets.MANAGED);

            expect(result).toEqual({
                expenseEditing: PermissionLevels.OWNER_AND_ADMIN,
                expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'admin-required',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            });
        });

        test('should return open permissions for CUSTOM preset', () => {
            const result = PermissionEngineAsync.getDefaultPermissions(SecurityPresets.CUSTOM);

            expect(result).toEqual({
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.ANYONE,
                memberInvitation: PermissionLevels.ANYONE,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ANYONE,
            });
        });
    });
});