import { ActivityFeedActions, ActivityFeedEventTypes, MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { TenantFirestoreTestDatabase } from '@splitifyd/test-support';
import { GroupBalanceDTOBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder, ThemeBuilder, UserBalanceBuilder } from '@splitifyd/test-support';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, test } from 'vitest';
import { ActivityFeedService } from '../../../services/ActivityFeedService';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { GroupMemberService } from '../../../services/GroupMemberService';

describe('GroupMemberService - Consolidated Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let db: TenantFirestoreTestDatabase;
    let firestoreReader: FirestoreReader;

    const testGroup = new GroupDTOBuilder()
        .withName('Test Group')
        .build();

    const defaultTheme = new ThemeBuilder()
        .build();

    beforeEach(async () => {
        // Create stub database
        db = new TenantFirestoreTestDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);
        const activityFeedService = new ActivityFeedService(firestoreReader, firestoreWriter);

        // GroupMemberService uses pre-computed balances from Firestore now (no balance service needed)
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter, activityFeedService);

        // Setup test group using builder
        db.seedGroup(testGroup.id, testGroup);

        // Initialize balance document for group
        db.initializeGroupBalance(testGroup.id);
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            // Arrange
            const member1 = new GroupMemberDocumentBuilder()
                .withUserId('user-1')
                .withGroupId(testGroup.id)
                .withTheme(defaultTheme)
                .buildDocument();

            const member2 = new GroupMemberDocumentBuilder()
                .withUserId('user-2')
                .withGroupId(testGroup.id)
                .withTheme(defaultTheme)
                .buildDocument();

            const member3 = new GroupMemberDocumentBuilder()
                .withUserId('user-3')
                .withGroupId(testGroup.id)
                .withTheme(defaultTheme)
                .asAdmin()
                .buildDocument();

            db.seedGroupMember(testGroup.id, 'user-1', member1);
            db.seedGroupMember(testGroup.id, 'user-2', member2);
            db.seedGroupMember(testGroup.id, 'user-3', member3);

            // Act
            const result = await firestoreReader.getAllGroupMembers(testGroup.id);

            // Assert
            expect(result).toHaveLength(3);
            expect(result[0].uid).toBe('user-1');
            expect(result[1].uid).toBe('user-2');
            expect(result[2].uid).toBe('user-3');
            expect(result[2].memberRole).toBe(MemberRoles.ADMIN);
        });

        it('should return empty array for group with no members', async () => {
            // Act
            const result = await firestoreReader.getAllGroupMembers(testGroup.id);

            // Assert
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle invalid group ID', async () => {
            // Arrange
            const invalidGroupId = toGroupId('');

            // Act
            const result = await firestoreReader.getAllGroupMembers(invalidGroupId);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('isGroupMemberAsync', () => {
        it('should return true for existing group member', async () => {
            // Arrange
            const testMember = new GroupMemberDocumentBuilder()
                .withUserId('user-1')
                .withGroupId(testGroup.id)
                .withTheme(defaultTheme)
                .buildDocument();

            db.seedGroupMember(testGroup.id, 'user-1', testMember);

            // Act
            const result = await groupMemberService.isGroupMemberAsync(testGroup.id, 'user-1');

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for non-existent group member', async () => {
            // Arrange
            const nonExistentUserId = 'nonexistent-user';

            // Act
            const result = await groupMemberService.isGroupMemberAsync(testGroup.id, nonExistentUserId);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid group ID', async () => {
            // Arrange
            const invalidGroupId = toGroupId('');

            // Act
            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, 'user-1');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            // Arrange
            const invalidUserId = '';

            // Act
            const result = await groupMemberService.isGroupMemberAsync(testGroup.id, invalidUserId);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('Security Role and Approval Workflow', () => {
        const adminUserId = 'admin-user';
        const memberUserId = 'member-user';
        const pendingUserId = 'pending-user';

        beforeEach(() => {
            const managedGroup = new GroupDTOBuilder()
                .withId(testGroup.id)
                .withCreatedBy(adminUserId)
                .withPermissions({
                    memberApproval: 'admin-required',
                    memberInvitation: 'admin-only',
                    expenseEditing: 'owner-and-admin',
                    expenseDeletion: 'owner-and-admin',
                    settingsManagement: 'admin-only',
                })
                .build();
            db.seedGroup(testGroup.id, managedGroup);
            db.initializeGroupBalance(testGroup.id);

            const adminMember = new GroupMemberDocumentBuilder()
                .withUserId(adminUserId)
                .withGroupId(testGroup.id)
                .withGroupDisplayName('Admin User')
                .asAdmin()
                .asActive()
                .buildDocument();
            const activeMember = new GroupMemberDocumentBuilder()
                .withUserId(memberUserId)
                .withGroupId(testGroup.id)
                .withGroupDisplayName('Active Member')
                .asMember()
                .asActive()
                .buildDocument();
            const pendingMember = new GroupMemberDocumentBuilder()
                .withUserId(pendingUserId)
                .withGroupId(testGroup.id)
                .withGroupDisplayName('Pending Member')
                .asMember()
                .asPending()
                .buildDocument();

            db.seedGroupMember(testGroup.id, adminUserId, adminMember);
            db.seedGroupMember(testGroup.id, memberUserId, activeMember);
            db.seedGroupMember(testGroup.id, pendingUserId, pendingMember);
        });

        it('should allow admin to promote a member to admin', async () => {
            const response = await groupMemberService.updateMemberRole(adminUserId, testGroup.id, memberUserId, MemberRoles.ADMIN);
            expect(response.message).toContain('Member role updated');

            const updatedMember = await firestoreReader.getGroupMember(testGroup.id, memberUserId);
            expect(updatedMember?.memberRole).toBe(MemberRoles.ADMIN);
        });

        it('should prevent removing the last active admin', async () => {
            await expect(
                groupMemberService.updateMemberRole(adminUserId, testGroup.id, adminUserId, MemberRoles.MEMBER),
            )
                .rejects
                .toMatchObject({
                    details: { message: expect.stringMatching(/last active admin/i) },
                });
        });

        it('should approve pending members', async () => {
            const response = await groupMemberService.approveMember(adminUserId, testGroup.id, pendingUserId);
            expect(response.message).toContain('Member approved');

            const approvedMember = await firestoreReader.getGroupMember(testGroup.id, pendingUserId);
            expect(approvedMember?.memberStatus).toBe(MemberStatuses.ACTIVE);

            const adminFeed = await firestoreReader.getActivityFeedForUser(adminUserId);
            expect(adminFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                action: ActivityFeedActions.JOIN,
                actorId: pendingUserId,
                details: expect.objectContaining({
                    targetUserId: pendingUserId,
                    targetUserName: 'Pending Member',
                }),
            });

            const pendingFeed = await firestoreReader.getActivityFeedForUser(pendingUserId);
            expect(pendingFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_JOINED,
                action: ActivityFeedActions.JOIN,
                actorId: pendingUserId,
            });
        });

        it('should reject pending members', async () => {
            const response = await groupMemberService.rejectMember(adminUserId, testGroup.id, pendingUserId);
            expect(response.message).toContain('Member rejected');

            const rejectedMember = await firestoreReader.getGroupMember(testGroup.id, pendingUserId);
            expect(rejectedMember).toBeNull();
        });

        it('should list pending members for admins', async () => {
            const pendingMembers = await groupMemberService.getPendingMembers(adminUserId, testGroup.id);
            expect(pendingMembers).toHaveLength(1);
            expect(pendingMembers[0].uid).toBe(pendingUserId);
            expect(pendingMembers[0].memberStatus).toBe(MemberStatuses.PENDING);
        });
    });

    // ================================
    // Validation Tests (from GroupMemberService.validation.test.ts)
    // ================================

    describe('Leave Group Validation', () => {
        test('should prevent group creator from leaving', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const creatorMember = new GroupMemberDocumentBuilder()
                .withUserId('creator-user-123')
                .withGroupId('test-group-id')
                .withRole(MemberRoles.ADMIN)
                .buildDocument();

            db.seedGroup(testGroup.id, testGroup);
            db.seedGroupMember(testGroup.id, 'creator-user-123', creatorMember);

            // Act & Assert
            await expect(groupMemberService.leaveGroup('creator-user-123', testGroup.id)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent leaving with outstanding balance', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Member To Remove')
                .buildDocument();

            // Set up balance document with outstanding balance
            const balanceWithDebt = new GroupBalanceDTOBuilder()
                .withGroupId(testGroup2.id)
                .withUserBalance(
                    'USD',
                    'member-user-123',
                    new UserBalanceBuilder()
                        .withUserId('member-user-123')
                        .withNetBalance(-50.0)
                        .build(), // Member owes $50
                )
                .withVersion(1)
                .build();

            // Convert ISO string to Timestamp for Firestore
            const balanceWithTimestamp = {
                ...balanceWithDebt,
                lastUpdatedAt: Timestamp.fromDate(new Date(balanceWithDebt.lastUpdatedAt)),
            };

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'member-user-123', memberDoc);
            db.seed(`groups/${testGroup2.id}/metadata/balance`, balanceWithTimestamp);

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', testGroup2.id)).rejects.toThrow(/Invalid input data/);
        });

        test('should allow member to leave when balance is settled', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Leaving Member')
                .buildDocument();

            // Add another member so the group has multiple members (needed for leave validation)
            const otherMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('other-member-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Remaining Member')
                .buildDocument();

            // Set up balance document with zero balance
            const settledBalance = new GroupBalanceDTOBuilder()
                .withGroupId(testGroup2.id)
                .withUserBalance(
                    'USD',
                    'member-user-123',
                    new UserBalanceBuilder()
                        .withUserId('member-user-123')
                        .withNetBalance(0.0)
                        .build(), // Member has settled balance
                )
                .withVersion(1)
                .build();

            // Convert ISO string to Timestamp for Firestore
            const settledBalanceWithTimestamp = {
                ...settledBalance,
                lastUpdatedAt: Timestamp.fromDate(new Date(settledBalance.lastUpdatedAt)),
            };

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'member-user-123', memberDoc);
            db.seedGroupMember(testGroup2.id, 'other-member-123', otherMemberDoc);
            db.seed(`groups/${testGroup2.id}/metadata/balance`, settledBalanceWithTimestamp);

            // Act
            const result = await groupMemberService.leaveGroup('member-user-123', testGroup2.id);

            // Assert
            expect(result).toEqual({
                message: 'Successfully left the group',
            });

            const remainingFeed = await firestoreReader.getActivityFeedForUser('other-member-123');
            expect(remainingFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: 'member-user-123',
                details: expect.objectContaining({
                    targetUserId: 'member-user-123',
                    targetUserName: 'Leaving Member',
                }),
            });

            const leavingFeed = await firestoreReader.getActivityFeedForUser('member-user-123');
            expect(leavingFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: 'member-user-123',
            });
        });

        test('should reject unauthorized leave request', async () => {
            // Act & Assert
            await expect(groupMemberService.leaveGroup('', testGroup.id)).rejects.toThrow(/Authentication required/);
        });

        test('should reject leave request for non-existent group', async () => {
            // Arrange - No group seeded, database has no group with this ID

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', toGroupId('nonexistent-group-id'))).rejects.toThrow(/Group not found/);
        });

        test('should reject leave request for non-member', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .build();

            db.seedGroup(testGroup2.id, testGroup2);
            // No member seeded - user is not a member

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', testGroup2.id)).rejects.toThrow(/Invalid input data/);
        });
    });

    describe('Remove Member Validation', () => {
        test('should prevent non-creator from removing members', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const targetMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('other-member-123')
                .withGroupId(testGroup2.id)
                .buildDocument();

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'other-member-123', targetMemberDoc);

            // Act & Assert - Non-creator (memberUserId) trying to remove otherMemberUserId
            await expect(groupMemberService.removeGroupMember('member-user-123', testGroup2.id, 'other-member-123')).rejects.toThrow(/Access denied/);
        });

        test('should prevent removing the group creator', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const creatorMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user-123')
                .withGroupId(testGroup2.id)
                .withRole(MemberRoles.ADMIN)
                .buildDocument();

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'creator-user-123', creatorMemberDoc);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', testGroup2.id, 'creator-user-123')).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent removing member with outstanding balance', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Member To Remove')
                .buildDocument();

            // Set up balance document with outstanding balance
            const balanceWithCredit = new GroupBalanceDTOBuilder()
                .withGroupId(testGroup2.id)
                .withUserBalance(
                    'USD',
                    'member-user-123',
                    new UserBalanceBuilder()
                        .withUserId('member-user-123')
                        .withNetBalance(25.0)
                        .build(), // Member is owed $25
                )
                .withVersion(1)
                .build();

            // Convert ISO string to Timestamp for Firestore
            const balanceWithCreditTimestamp = {
                ...balanceWithCredit,
                lastUpdatedAt: Timestamp.fromDate(new Date(balanceWithCredit.lastUpdatedAt)),
            };

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'member-user-123', memberDoc);
            db.seed(`groups/${testGroup2.id}/metadata/balance`, balanceWithCreditTimestamp);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', testGroup2.id, 'member-user-123')).rejects.toThrow(/Invalid input data/);
        });

        test('should allow creator to remove member with settled balance', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Member To Remove')
                .buildDocument();

            const creatorMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user-123')
                .withGroupId(testGroup2.id)
                .withGroupDisplayName('Group Owner')
                .asAdmin()
                .buildDocument();

            // Set up balance document with zero balance
            const settledBalance = new GroupBalanceDTOBuilder()
                .withGroupId(testGroup2.id)
                .withUserBalance(
                    'USD',
                    'member-user-123',
                    new UserBalanceBuilder()
                        .withUserId('member-user-123')
                        .withNetBalance(0.0)
                        .build(), // Member has settled balance
                )
                .withVersion(1)
                .build();

            // Convert ISO string to Timestamp for Firestore
            const settledBalanceWithTimestamp = {
                ...settledBalance,
                lastUpdatedAt: Timestamp.fromDate(new Date(settledBalance.lastUpdatedAt)),
            };

            db.seedGroup(testGroup2.id, testGroup2);
            db.seedGroupMember(testGroup2.id, 'member-user-123', memberDoc);
            db.seedGroupMember(testGroup2.id, 'creator-user-123', creatorMemberDoc);
            db.seed(`groups/${testGroup2.id}/metadata/balance`, settledBalanceWithTimestamp);

            // Act
            const result = await groupMemberService.removeGroupMember('creator-user-123', testGroup2.id, 'member-user-123');

            // Assert
            expect(result).toEqual({
                message: 'Member removed successfully',
            });

            const ownerFeed = await firestoreReader.getActivityFeedForUser('creator-user-123');
            expect(ownerFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: 'creator-user-123',
                details: expect.objectContaining({
                    targetUserId: 'member-user-123',
                    targetUserName: 'Member To Remove',
                }),
            });

            const removedFeed = await firestoreReader.getActivityFeedForUser('member-user-123');
            expect(removedFeed.items[0]).toMatchObject({
                eventType: ActivityFeedEventTypes.MEMBER_LEFT,
                action: ActivityFeedActions.LEAVE,
                actorId: 'creator-user-123',
            });
        });

        test('should reject removal of non-existent member', async () => {
            // Arrange
            const testGroup2 = new GroupDTOBuilder()
                .withCreatedBy('creator-user-123')
                .build();

            db.seedGroup(testGroup2.id, testGroup2);
            // No member seeded - user doesn't exist

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', testGroup2.id, 'nonexistent-user')).rejects.toThrow(/Invalid input data/);
        });

        test('should require valid member ID for removal', async () => {
            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', testGroup.id, '')).rejects.toThrow(/Missing required field.*memberId/);
        });
    });

    describe('Authorization Edge Cases', () => {
        test('should handle empty user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup('', testGroup.id)).rejects.toThrow(/Authentication required/);
        });

        test('should handle null user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(null as any, testGroup.id)).rejects.toThrow(/Authentication required/);
        });

        test('should handle undefined user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(undefined as any, testGroup.id)).rejects.toThrow(/Authentication required/);
        });
    });
});
