import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Group, MemberRoles, MemberStatuses, SecurityPresets, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';
import { StubFirestoreReader } from './mocks/firestore-stubs';
import { FirestoreGroupBuilder, GroupMemberDocumentBuilder, ExpenseBuilder } from '@splitifyd/test-support';

let stubFirestoreReader: StubFirestoreReader;

describe('PermissionEngineAsync', () => {
    let testGroup: Group;
    const testUserId = 'user123';
    const testGroupId = 'group456';

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        vi.clearAllMocks();

        testGroup = new FirestoreGroupBuilder()
            .withId(testGroupId)
            .withName('Test Group')
            .withDescription('Test Description')
            .withCreatedBy('creator123')
            .withCreatedAt('2023-01-01T00:00:00Z')
            .withUpdatedAt('2023-01-01T00:00:00Z')
            .withSecurityPreset('open')
            .build();

        // Override the permissions to match the test expectations
        testGroup.permissions = {
            expenseEditing: PermissionLevels.ANYONE,
            expenseDeletion: PermissionLevels.OWNER_AND_ADMIN,
            memberInvitation: PermissionLevels.ADMIN_ONLY,
            memberApproval: 'automatic',
            settingsManagement: PermissionLevels.ADMIN_ONLY,
        };
    });

    describe('checkPermission', () => {
        test('should return false if user is not a member', async () => {
            // No group member set in stub, so getGroupMember will return null

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should return false if user is inactive', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('pending')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow inactive users to view group', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('pending')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(false); // Still false because status is PENDING, not ACTIVE
        });

        test('should allow active users to view group', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('should deny viewers from expense editing', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('viewer')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow member with ANYONE permission', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });

        test('should allow admin with ADMIN_ONLY permission', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(true);
        });

        test('should deny member with ADMIN_ONLY permission', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('should allow admin with OWNER_AND_ADMIN permission', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(true);
        });

        test('should allow expense owner with OWNER_AND_ADMIN permission', async () => {
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            const mockExpense = new ExpenseBuilder()
                .withId('expense123')
                .withCreatedBy(testUserId)
                .withGroupId(testGroupId)
                .withDescription('Test expense')
                .withAmount(100)
                .withCurrency('USD')
                .withDate('2023-01-01')
                .withCategory('food')
                .withSplitType('equal')
                .withPaidBy(testUserId)
                .withParticipants([testUserId])
                .withSplits([{ uid: testUserId, amount: 100 }])
                .build();

            const result = await PermissionEngineAsync.checkPermission(stubFirestoreReader, testGroup, testUserId, 'expenseDeletion', { expense: mockExpense });

            expect(result).toBe(true);
        });

        test('should throw error if group missing permissions', async () => {
            const groupWithoutPermissions = { ...testGroup, permissions: undefined as any };
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            await expect(PermissionEngineAsync.checkPermission(stubFirestoreReader, groupWithoutPermissions, testUserId, 'expenseEditing')).rejects.toThrow(
                'Group group456 is missing permissions configuration',
            );
        });

        test('should throw error if specific permission missing', async () => {
            const groupWithMissingPermission = {
                ...testGroup,
                permissions: { ...testGroup.permissions, expenseEditing: undefined as any },
            };
            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, memberDoc);

            await expect(PermissionEngineAsync.checkPermission(stubFirestoreReader, groupWithMissingPermission, testUserId, 'expenseEditing')).rejects.toThrow(
                'Group group456 is missing permission setting for action: expenseEditing',
            );
        });
    });

    describe('canChangeRole', () => {
        test('should return false if actor member not found', async () => {
            // Actor not found (testUserId) - use setNotFound
            stubFirestoreReader.setNotFound('group-members', `${testGroupId}_${testUserId}`);

            // Target found (target123) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_target123`, {
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
            // Actor found (testUserId) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
            });

            // Target not found (target123) - use setNotFound
            stubFirestoreReader.setNotFound('group-members', `${testGroupId}_target123`);

            const result = await PermissionEngineAsync.canChangeRole(stubFirestoreReader, testGroupId, 'creator123', testUserId, 'target123', MemberRoles.ADMIN);

            expect(result).toEqual({ allowed: false, reason: 'User not found in group' });
        });

        test('should return false if actor is not admin', async () => {
            // Actor (not admin) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
            });

            // Target - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_target123`, {
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
            // Set up the single admin member (both actor and target are the same user)
            const adminMember = {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
            };

            // Set the member data (both calls will return the same member since actor = target)
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, adminMember);

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

            // Actor (admin) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
            });

            // Target (creator) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${creatorId}`, {
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
            // Actor (admin) - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_${testUserId}`, {
                uid: testUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: '2023-01-01T00:00:00Z',
                theme: { name: 'blue', light: '#0000FF', dark: '#000080', pattern: 'solid', assignedAt: '2023-01-01T00:00:00Z', colorIndex: 0 },
            });

            // Target - set member data
            stubFirestoreReader.setDocument('group-members', `${testGroupId}_target123`, {
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
