import { MemberRoles } from '@splitifyd/shared';
import { GroupBalanceDTOBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder, ThemeBuilder, UserBalanceBuilder } from '@splitifyd/test-support';
import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it, test } from 'vitest';
import { FirestoreReader } from '../../../services/firestore';
import { FirestoreWriter } from '../../../services/firestore';
import { GroupMemberService } from '../../../services/GroupMemberService';

describe('GroupMemberService - Consolidated Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let db: StubFirestoreDatabase;
    let firestoreReader: FirestoreReader;

    const defaultTheme = new ThemeBuilder()
        .build();

    beforeEach(async () => {
        // Create stub database
        db = new StubFirestoreDatabase();

        // Create real services using stub database
        firestoreReader = new FirestoreReader(db);
        const firestoreWriter = new FirestoreWriter(db);

        // GroupMemberService uses pre-computed balances from Firestore now (no balance service needed)
        groupMemberService = new GroupMemberService(firestoreReader, firestoreWriter);

        // Setup test group using builder
        const testGroup = new GroupDTOBuilder()
            .withId('test-group-id')
            .withName('Test Group')
            .build();
        db.seedGroup('test-group-id', testGroup);

        // Initialize balance document for group
        db.initializeGroupBalance('test-group-id');
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            // Arrange
            const member1 = new GroupMemberDocumentBuilder()
                .withUserId('user-1')
                .withGroupId('test-group-id')
                .withTheme(defaultTheme)
                .buildDocument();

            const member2 = new GroupMemberDocumentBuilder()
                .withUserId('user-2')
                .withGroupId('test-group-id')
                .withTheme(defaultTheme)
                .buildDocument();

            const member3 = new GroupMemberDocumentBuilder()
                .withUserId('user-3')
                .withGroupId('test-group-id')
                .withTheme(defaultTheme)
                .asAdmin()
                .buildDocument();

            db.seedGroupMember('test-group-id', 'user-1', member1);
            db.seedGroupMember('test-group-id', 'user-2', member2);
            db.seedGroupMember('test-group-id', 'user-3', member3);

            // Act
            const result = await firestoreReader.getAllGroupMembers('test-group-id');

            // Assert
            expect(result).toHaveLength(3);
            expect(result[0].uid).toBe('user-1');
            expect(result[1].uid).toBe('user-2');
            expect(result[2].uid).toBe('user-3');
            expect(result[2].memberRole).toBe(MemberRoles.ADMIN);
        });

        it('should return empty array for group with no members', async () => {
            // Act
            const result = await firestoreReader.getAllGroupMembers('test-group-id');

            // Assert
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle invalid group ID', async () => {
            // Arrange
            const invalidGroupId = '';

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
                .withGroupId('test-group-id')
                .withTheme(defaultTheme)
                .buildDocument();

            db.seedGroupMember('test-group-id', 'user-1', testMember);

            // Act
            const result = await groupMemberService.isGroupMemberAsync('test-group-id', 'user-1');

            // Assert
            expect(result).toBe(true);
        });

        it('should return false for non-existent group member', async () => {
            // Arrange
            const nonExistentUserId = 'nonexistent-user';

            // Act
            const result = await groupMemberService.isGroupMemberAsync('test-group-id', nonExistentUserId);

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid group ID', async () => {
            // Arrange
            const invalidGroupId = '';

            // Act
            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, 'user-1');

            // Assert
            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            // Arrange
            const invalidUserId = '';

            // Act
            const result = await groupMemberService.isGroupMemberAsync('test-group-id', invalidUserId);

            // Assert
            expect(result).toBe(false);
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

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'creator-user-123', creatorMember);

            // Act & Assert
            await expect(groupMemberService.leaveGroup('creator-user-123', 'test-group-id')).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent leaving with outstanding balance', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId('test-group-id')
                .buildDocument();

            // Set up balance document with outstanding balance
            const balanceWithDebt = new GroupBalanceDTOBuilder('test-group-id')
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

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'member-user-123', memberDoc);
            db.seed(`groups/test-group-id/metadata/balance`, balanceWithTimestamp);

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', 'test-group-id')).rejects.toThrow(/Invalid input data/);
        });

        test('should allow member to leave when balance is settled', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId('test-group-id')
                .buildDocument();

            // Add another member so the group has multiple members (needed for leave validation)
            const otherMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('other-member-123')
                .withGroupId('test-group-id')
                .buildDocument();

            // Set up balance document with zero balance
            const settledBalance = new GroupBalanceDTOBuilder('test-group-id')
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

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'member-user-123', memberDoc);
            db.seedGroupMember('test-group-id', 'other-member-123', otherMemberDoc);
            db.seed(`groups/test-group-id/metadata/balance`, settledBalanceWithTimestamp);

            // Act
            const result = await groupMemberService.leaveGroup('member-user-123', 'test-group-id');

            // Assert
            expect(result).toEqual({
                message: 'Successfully left the group',
            });
        });

        test('should reject unauthorized leave request', async () => {
            // Act & Assert
            await expect(groupMemberService.leaveGroup('', 'test-group-id')).rejects.toThrow(/Authentication required/);
        });

        test('should reject leave request for non-existent group', async () => {
            // Arrange - No group seeded, database has no group with this ID

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', 'nonexistent-group-id')).rejects.toThrow(/Group not found/);
        });

        test('should reject leave request for non-member', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .build();

            db.seedGroup('test-group-id', testGroup);
            // No member seeded - user is not a member

            // Act & Assert
            await expect(groupMemberService.leaveGroup('member-user-123', 'test-group-id')).rejects.toThrow(/Invalid input data/);
        });
    });

    describe('Remove Member Validation', () => {
        test('should prevent non-creator from removing members', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const targetMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('other-member-123')
                .withGroupId('test-group-id')
                .buildDocument();

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'other-member-123', targetMemberDoc);

            // Act & Assert - Non-creator (memberUserId) trying to remove otherMemberUserId
            await expect(groupMemberService.removeGroupMember('member-user-123', 'test-group-id', 'other-member-123')).rejects.toThrow(/Access denied/);
        });

        test('should prevent removing the group creator', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const creatorMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId('creator-user-123')
                .withGroupId('test-group-id')
                .withRole(MemberRoles.ADMIN)
                .buildDocument();

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'creator-user-123', creatorMemberDoc);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', 'test-group-id', 'creator-user-123')).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent removing member with outstanding balance', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId('test-group-id')
                .buildDocument();

            // Set up balance document with outstanding balance
            const balanceWithCredit = new GroupBalanceDTOBuilder('test-group-id')
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

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'member-user-123', memberDoc);
            db.seed(`groups/test-group-id/metadata/balance`, balanceWithCreditTimestamp);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', 'test-group-id', 'member-user-123')).rejects.toThrow(/Invalid input data/);
        });

        test('should allow creator to remove member with settled balance', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId('member-user-123')
                .withGroupId('test-group-id')
                .buildDocument();

            // Set up balance document with zero balance
            const settledBalance = new GroupBalanceDTOBuilder('test-group-id')
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

            db.seedGroup('test-group-id', testGroup);
            db.seedGroupMember('test-group-id', 'member-user-123', memberDoc);
            db.seed(`groups/test-group-id/metadata/balance`, settledBalanceWithTimestamp);

            // Act
            const result = await groupMemberService.removeGroupMember('creator-user-123', 'test-group-id', 'member-user-123');

            // Assert
            expect(result).toEqual({
                message: 'Member removed successfully',
            });
        });

        test('should reject removal of non-existent member', async () => {
            // Arrange
            const testGroup = new GroupDTOBuilder()
                .withId('test-group-id')
                .withCreatedBy('creator-user-123')
                .build();

            db.seedGroup('test-group-id', testGroup);
            // No member seeded - user doesn't exist

            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', 'test-group-id', 'nonexistent-user')).rejects.toThrow(/Invalid input data/);
        });

        test('should require valid member ID for removal', async () => {
            // Act & Assert
            await expect(groupMemberService.removeGroupMember('creator-user-123', 'test-group-id', '')).rejects.toThrow(/Missing required field.*memberId/);
        });
    });

    describe('Authorization Edge Cases', () => {
        test('should handle empty user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup('', 'test-group-id')).rejects.toThrow(/Authentication required/);
        });

        test('should handle null user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(null as any, 'test-group-id')).rejects.toThrow(/Authentication required/);
        });

        test('should handle undefined user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(undefined as any, 'test-group-id')).rejects.toThrow(/Authentication required/);
        });
    });
});
