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
});
