import { GroupDTO, PermissionLevels, toUserId } from '@billsplit-wl/shared';
import { ExpenseDTOBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';

describe('PermissionEngineAsync', () => {
    let testGroup: GroupDTO;
    const testUserId = toUserId('user123');
    const testGroupId = 'group456';

    beforeEach(() => {
        testGroup = new GroupDTOBuilder()
            .withId(testGroupId)
            .withPermissions({
                expenseEditing: PermissionLevels.ANYONE,
                expenseDeletion: PermissionLevels.CREATOR_AND_ADMIN,
                memberInvitation: PermissionLevels.ADMIN_ONLY,
                memberApproval: 'automatic',
                settingsManagement: PermissionLevels.ADMIN_ONLY,
            })
            .build();
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
                .withStatus('pending')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow inactive users to view group', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withStatus('pending')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(false); // Still false because status is PENDING, not ACTIVE
        });

        test('should allow active users to view group', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('should deny viewers from expense editing', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('viewer')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('should allow member with ANYONE permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });

        test('should allow admin with ADMIN_ONLY permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(true);
        });

        test('should deny member with ADMIN_ONLY permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('should allow admin with CREATOR_AND_ADMIN permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(true);
        });

        test('should allow expense owner with CREATOR_AND_ADMIN permission', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            const mockExpense = new ExpenseDTOBuilder()
                .withExpenseId('expense123')
                .withCreatedBy(testUserId)
                .withGroupId(testGroupId)
                .withDescription('Test expense')
                .withAmount(100, 'USD')
                .withDate('2023-01-01')
                .withLabel('food')
                .withSplitType('equal')
                .withPaidBy(testUserId)
                .withParticipants([testUserId])
                .withSplits([{ uid: testUserId, amount: '100' }])
                .build();

            const result = PermissionEngineAsync.checkPermission(member, testGroup, testUserId, 'expenseDeletion', { expense: mockExpense });

            expect(result).toBe(true);
        });

        test('should throw error if group missing permissions', () => {
            const groupWithoutPermissions = new GroupDTOBuilder().withId(testGroupId).withoutPermissions().build() as any;
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            expect(() => PermissionEngineAsync.checkPermission(member, groupWithoutPermissions, testUserId, 'expenseEditing')).toThrow(
                'Group group456 is missing permission setting for action: expenseEditing',
            );
        });

        test('should throw error if specific permission missing', () => {
            const groupWithMissingPermission = new GroupDTOBuilder().withId(testGroupId).withoutPermission('expenseEditing').build() as any;
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            expect(() => PermissionEngineAsync.checkPermission(member, groupWithMissingPermission, testUserId, 'expenseEditing')).toThrow(
                'Group group456 is missing permission setting for action: expenseEditing',
            );
        });
    });

    describe('locked group behavior', () => {
        let lockedGroup: GroupDTO;

        beforeEach(() => {
            lockedGroup = new GroupDTOBuilder()
                .withId(testGroupId)
                .withLocked(true)
                .withPermissions({
                    expenseEditing: PermissionLevels.ANYONE,
                    expenseDeletion: PermissionLevels.ANYONE,
                    memberInvitation: PermissionLevels.ANYONE,
                    memberApproval: 'automatic',
                    settingsManagement: PermissionLevels.ANYONE,
                })
                .build();
        });

        test('locked group should block expenseEditing for admin', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('locked group should block expenseEditing for member', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'expenseEditing');

            expect(result).toBe(false);
        });

        test('locked group should block expenseDeletion for admin', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'expenseDeletion');

            expect(result).toBe(false);
        });

        test('locked group should block memberInvitation for admin', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'memberInvitation');

            expect(result).toBe(false);
        });

        test('locked group should block settingsManagement for admin', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'settingsManagement');

            expect(result).toBe(false);
        });

        test('locked group should still allow viewGroup for admin', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('admin')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('locked group should still allow viewGroup for member', () => {
            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, lockedGroup, testUserId, 'viewGroup');

            expect(result).toBe(true);
        });

        test('unlocked group should allow expenseEditing for member', () => {
            const unlockedGroup = new GroupDTOBuilder()
                .withId(testGroupId)
                .withLocked(false)
                .withPermissions({
                    expenseEditing: PermissionLevels.ANYONE,
                    expenseDeletion: PermissionLevels.ANYONE,
                    memberInvitation: PermissionLevels.ANYONE,
                    memberApproval: 'automatic',
                    settingsManagement: PermissionLevels.ANYONE,
                })
                .build();

            const member = new GroupMemberDocumentBuilder()
                .withUserId(testUserId)
                .withGroupId(testGroupId)
                .withRole('member')
                .withStatus('active')
                .build();

            const result = PermissionEngineAsync.checkPermission(member, unlockedGroup, testUserId, 'expenseEditing');

            expect(result).toBe(true);
        });
    });
});
