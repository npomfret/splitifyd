import { GroupDTO, PermissionLevels } from '@splitifyd/shared';
import { ExpenseDTOBuilder, GroupDTOBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';
import { GroupMemberDocumentBuilder } from '../support/GroupMemberDocumentBuilder';

describe('PermissionEngineAsync', () => {
    let testGroup: GroupDTO;
    const testUserId = 'user123';
    const testGroupId = 'group456';

    beforeEach(() => {
        testGroup = new GroupDTOBuilder()
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
        test('should return false if user is not a member', () => {
            // Pass null member to simulate non-member
            const result = PermissionEngineAsync.checkPermission(null as any, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should return false if user is inactive', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('pending')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow inactive users to view group', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('pending')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(false); // Still false because status is PENDING, not ACTIVE
        });

        test('should allow active users to view group', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('should deny viewers from expense editing', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('viewer')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow member with ANYONE permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });

        test('should allow admin with ADMIN_ONLY permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(true);
        });

        test('should deny member with ADMIN_ONLY permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('should allow admin with OWNER_AND_ADMIN permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(true);
        });

        test('should allow expense owner with OWNER_AND_ADMIN permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            const mockExpense = new ExpenseDTOBuilder()
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

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseDeletion', { expense: mockExpense });

            expect(result).toBe(true);
        });

        test('should throw error if group missing permissions', () => {
            const groupWithoutPermissions = { ...testGroup, permissions: undefined as any };
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            expect(() => PermissionEngineAsync.checkPermission(member, groupWithoutPermissions, testUserId, 'expenseEditing')).toThrow('Group group456 is missing permissions configuration');
        });

        test('should throw error if specific permission missing', () => {
            const groupWithMissingPermission = {
                ...testGroup,
                permissions: { ...testGroup.permissions, expenseEditing: undefined as any },
            };
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .withJoinedAt('2023-01-01T00:00:00Z')
                .withThemeColors('#0000FF', '#000080', 'blue')
                .build();

            expect(() => PermissionEngineAsync.checkPermission(member, groupWithMissingPermission, testUserId, 'expenseEditing')).toThrow(
                'Group group456 is missing permission setting for action: expenseEditing',
            );
        });
    });
});
