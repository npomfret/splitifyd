import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Group, PermissionLevels } from '@splitifyd/shared';
import { PermissionEngineAsync } from '../../permissions/permission-engine-async';
import { StubFirestoreReader } from './mocks/firestore-stubs';
import { GroupBuilder, GroupMemberDocumentBuilder, ExpenseBuilder } from '@splitifyd/test-support';

let stubFirestoreReader: StubFirestoreReader;

describe('PermissionEngineAsync', () => {
    let testGroup: Group;
    const testUserId = 'user123';
    const testGroupId = 'group456';

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        vi.clearAllMocks();

        testGroup = new GroupBuilder()
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

});
