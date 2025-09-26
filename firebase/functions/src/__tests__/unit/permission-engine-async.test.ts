import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Group, MemberRoles, MemberStatuses, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';
import { StubFirestoreReader } from './mocks/firestore-stubs';

let stubFirestoreReader: StubFirestoreReader;

// todo: use builders here !

describe('PermissionEngineAsync', () => {
    let testGroup: Group;
    const testUserId = 'user123';
    const testGroupId = 'group456';

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        vi.clearAllMocks();

        testGroup = {
            id: testGroupId,
            name: 'Test Group',
            description: 'Test Description',
            createdBy: 'creator123',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
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
            // No group member set in stub, so getGroupMember will return null

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should return false if user is inactive', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.PENDING,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow inactive users to view group', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.PENDING,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(false); // Still false because status is PENDING, not ACTIVE
        });

        test('should allow active users to view group', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('should deny viewers from expense editing', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.VIEWER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow member with ANYONE permission', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });

        test('should allow admin with ADMIN_ONLY permission', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(true);
        });

        test('should deny member with ADMIN_ONLY permission', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('should allow admin with OWNER_AND_ADMIN permission', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(true);
        });

        test('should allow expense owner with OWNER_AND_ADMIN permission', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
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
                splits: [{ uid: testUserId, amount: 100 }],
                deletedAt: null,
                deletedBy: null,
            };

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseDeletion', { expense: mockExpense });

            expect(result).toBe(true);
        });

        test('should throw error if group missing permissions', async () => {
            const groupWithoutPermissions = { ...testGroup, permissions: undefined as any };
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            await expect(PermissionEngineAsync.checkPermission(stubFirestoreReader, groupWithoutPermissions, testUserId, 'expenseEditing')).rejects.toThrow(
                'Group group456 is missing permissions configuration',
            );
        });

        test('should throw error if specific permission missing', async () => {
            const groupWithMissingPermission = {
                ...testGroup,
                permissions: { ...testGroup.permissions, expenseEditing: undefined as any },
            };
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            await expect(PermissionEngineAsync.checkPermission(stubFirestoreReader, groupWithMissingPermission, testUserId, 'expenseEditing')).rejects.toThrow(
                'Group group456 is missing permission setting for action: expenseEditing',
            );
        });
    });

    describe('canChangeRole', () => {
        test('should return false if actor member not found', async () => {
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce(null) // Actor not found
                .mockResolvedValueOnce({
                    // Target found
                    uid: 'target123',
                    groupId: testGroupId,
                    memberRole: MemberRoles.MEMBER,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                });

            const result = await PermissionEngineAsync.canChangeRole(stubFirestoreReader, testGroupId, 'creator123', testUserId, 'target123', MemberRoles.ADMIN);

            expect(result).toEqual({ allowed: false, reason: 'User not found in group' });
        });

        test('should return false if target member not found', async () => {
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce({
                    // Actor found
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                })
                .mockResolvedValueOnce(null); // Target not found

            const result = await PermissionEngineAsync.canChangeRole(stubFirestoreReader, testGroupId, 'creator123', testUserId, 'target123', MemberRoles.ADMIN);

            expect(result).toEqual({ allowed: false, reason: 'User not found in group' });
        });

        test('should return false if actor is not admin', async () => {
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce({
                    // Actor (not admin)
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.MEMBER,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                })
                .mockResolvedValueOnce({
                    // Target
                    uid: 'target123',
                    groupId: testGroupId,
                    memberRole: MemberRoles.MEMBER,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                });

            const result = await PermissionEngineAsync.canChangeRole(stubFirestoreReader, testGroupId, 'creator123', testUserId, 'target123', MemberRoles.ADMIN);

            expect(result).toEqual({ allowed: false, reason: 'Only admins can change member roles' });
        });

        test('should prevent last admin from demoting themselves', async () => {
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce({
                    // Actor (admin)
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                })
                .mockResolvedValueOnce({
                    // Target (same as actor)
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                });

            // Mock getAllGroupMembers to return only one admin
            stubFirestoreReader.getAllGroupMembers.mockResolvedValue([
                {
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                },
            ]);

            const result = await PermissionEngineAsync.canChangeRole(
                stubFirestoreReader,
                testGroupId,
                'creator123',
                testUserId, // Actor
                testUserId, // Target (same as actor)
                MemberRoles.MEMBER,
            );

            expect(result).toEqual({
                allowed: false,
                reason: 'Cannot remove last admin. Promote another member first.',
            });
        });

        test('should prevent changing creator to viewer', async () => {
            const creatorId = 'creator123';
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce({
                    // Actor (admin)
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                })
                .mockResolvedValueOnce({
                    // Target (creator)
                    uid: creatorId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                });

            const result = await PermissionEngineAsync.canChangeRole(
                stubFirestoreReader,
                testGroupId,
                creatorId, // Created by
                testUserId, // Actor
                creatorId, // Target (creator)
                MemberRoles.VIEWER,
            );

            expect(result).toEqual({
                allowed: false,
                reason: 'Changing creator permissions requires explicit confirmation',
            });
        });

        test('should allow valid role change', async () => {
            stubFirestoreReader.getGroupMember
                .mockResolvedValueOnce({
                    // Actor (admin)
                    uid: testUserId,
                    groupId: testGroupId,
                    memberRole: MemberRoles.ADMIN,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                })
                .mockResolvedValueOnce({
                    // Target
                    uid: 'target123',
                    groupId: testGroupId,
                    memberRole: MemberRoles.MEMBER,
                    memberStatus: MemberStatuses.ACTIVE,
                    joinedAt: '2023-01-01T00:00:00Z',
                    theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
                });

            const result = await PermissionEngineAsync.canChangeRole(stubFirestoreReader, testGroupId, 'creator123', testUserId, 'target123', MemberRoles.ADMIN);

            expect(result).toEqual({ allowed: true });
        });
    });

    describe('getUserPermissions', () => {
        test('should return user permissions for admin', async () => {
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.getUserPermissions(stubFirestoreReader, testGroup, testUserId);

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
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080' },
            });

            const result = await PermissionEngineAsync.getUserPermissions(stubFirestoreReader, testGroup, testUserId);

            expect(result).toEqual({
                canEditAnyExpense: true, // ANYONE permission
                canDeleteAnyExpense: true, // OWNER_AND_ADMIN allows members for creation
                canInviteMembers: false, // ADMIN_ONLY
                canManageSettings: false, // ADMIN_ONLY
                canApproveMembers: true, // 'automatic' permission
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
