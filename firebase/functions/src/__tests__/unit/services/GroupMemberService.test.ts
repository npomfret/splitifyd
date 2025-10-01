import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService
} from '../mocks/firestore-stubs';
import { GroupBuilder, GroupMemberDocumentBuilder, ThemeBuilder } from '@splitifyd/test-support';
import type { GroupMemberDocument } from '@splitifyd/shared';
import { MemberRoles } from '@splitifyd/shared';

describe('GroupMemberService - Consolidated Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;
    let mockBalanceService: any;

    // Test data
    const testGroupId = 'test-group-id';
    const testUserId1 = 'user-1';
    const testUserId2 = 'user-2';
    const testUserId3 = 'user-3';
    const creatorUserId = 'creator-user-123';
    const memberUserId = 'member-user-123';
    const otherMemberUserId = 'other-member-123';

    const defaultTheme = new ThemeBuilder()
        .withLight('#FF6B6B')
        .withDark('#FF6B6B')
        .withName('Test Theme')
        .withPattern('solid')
        .withColorIndex(0)
        .build();

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Create a mock balance service for tests that need to control balance calculations
        mockBalanceService = {
            calculateGroupBalances: vi.fn(),
        };

        // Create ApplicationBuilder and GroupMemberService
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);

        // For tests that need to control balance calculations, create with mock balance service
        // For others, use the ApplicationBuilder version
        groupMemberService = new GroupMemberService(
            stubReader,
            stubWriter,
            mockBalanceService
        );

        // Setup test group using builder
        const testGroup = new GroupBuilder().withId(testGroupId).withName('Test Group').build();
        stubReader.setDocument('groups', testGroupId, testGroup);

        vi.clearAllMocks();
    });

    describe('getGroupMember', () => {
        it('should return member if exists', async () => {
            const testMember = new GroupMemberDocumentBuilder().withUserId(testUserId1).withGroupId(testGroupId)
                .withTheme(defaultTheme)
                .build();

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, testMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toEqual(testMember);
        });

        it('should return null if member does not exist', async () => {
            const nonExistentUserId = 'nonexistent-user';

            const result = await groupMemberService.getGroupMember(testGroupId, nonExistentUserId);

            expect(result).toBeNull();
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.getGroupMember(invalidGroupId, testUserId1);

            expect(result).toBeNull();
        });

        it('should handle invalid user ID', async () => {
            const invalidUserId = '';

            const result = await groupMemberService.getGroupMember(testGroupId, invalidUserId);

            expect(result).toBeNull();
        });
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            const testMembers: GroupMemberDocument[] = [
                new GroupMemberDocumentBuilder().withUserId(testUserId1).withGroupId(testGroupId)
                    .withTheme(defaultTheme)
                    .build(),
                new GroupMemberDocumentBuilder().withUserId(testUserId2).withGroupId(testGroupId)
                    .withTheme(defaultTheme)
                    .build(),
                new GroupMemberDocumentBuilder().withUserId(testUserId3).withGroupId(testGroupId)
                    .withTheme(defaultTheme)
                    .asAdmin()
                    .build(),
            ];

            // Set up group members in stub
            testMembers.forEach((member) => {
                stubReader.setDocument('group-members', `${testGroupId}_${member.uid}`, member);
            });

            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual(testMembers);
            expect(result).toHaveLength(3);
        });

        it('should return empty array for group with no members', async () => {
            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.getAllGroupMembers(invalidGroupId);

            expect(result).toEqual([]);
        });
    });

    describe('isGroupMemberAsync', () => {
        it('should return true for existing group member', async () => {
            const testMember = new GroupMemberDocumentBuilder().withUserId(testUserId1).withGroupId(testGroupId)
                .withTheme(defaultTheme)
                .build();

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, testMember);

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, testUserId1);

            expect(result).toBe(true);
        });

        it('should return false for non-existent group member', async () => {
            const nonExistentUserId = 'nonexistent-user';

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, nonExistentUserId);

            expect(result).toBe(false);
        });

        it('should return false for invalid group ID', async () => {
            const invalidGroupId = '';

            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, testUserId1);

            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            const invalidUserId = '';

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, invalidUserId);

            expect(result).toBe(false);
        });
    });

    describe('member document structure validation', () => {
        it('should handle member documents with all required fields', async () => {
            const completeMember = new GroupMemberDocumentBuilder().withUserId(testUserId1).withGroupId(testGroupId)
                .withTheme(defaultTheme)
                .build();

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, completeMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.uid).toBe(testUserId1);
            expect(result?.groupId).toBe(testGroupId);
            expect(result?.memberRole).toBe('member');
            expect(result?.joinedAt).toBeDefined();
        });

        it('should handle member documents with admin role', async () => {
            const adminMember = new GroupMemberDocumentBuilder().withUserId(testUserId1).withGroupId(testGroupId)
                .withTheme(defaultTheme)
                .asAdmin()
                .build();

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, adminMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.memberRole).toBe('admin');
        });
    });

    // ================================
    // Validation Tests (from GroupMemberService.validation.test.ts)
    // ================================

    describe('Leave Group Validation', () => {
        test('should prevent group creator from leaving', async () => {
            // Setup: Creator trying to leave their own group
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const creatorMember = new GroupMemberDocumentBuilder()
                .withUserId(creatorUserId)
                .withGroupId(testGroupId)
                .withRole(MemberRoles.ADMIN)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMember);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(creatorUserId, testGroupId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent leaving with outstanding balance', async () => {
            // Setup: Member with outstanding balance trying to leave
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(memberUserId)
                .withGroupId(testGroupId)
                .build();

            // Mock balance calculation to return outstanding balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: -50.0, // Member owes $50
                            totalPaid: 0,
                            totalOwed: 50,
                        },
                    },
                },
            });

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(memberUserId, testGroupId)).rejects.toThrow(/Invalid input data/);
        });

        test('should allow member to leave when balance is settled', async () => {
            // Setup: Member with settled balance leaving
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(memberUserId)
                .withGroupId(testGroupId)
                .build();

            // Mock balance calculation to return zero balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 0.0, // Member has settled balance
                            totalPaid: 25,
                            totalOwed: 25,
                        },
                    },
                },
            });

            // Add another member so the group has multiple members (needed for leave validation)
            const otherMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId(otherMemberUserId)
                .withGroupId(testGroupId)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);
            stubReader.setDocument('group-members', `${testGroupId}_${otherMemberUserId}`, otherMemberDoc);

            // Mock successful write operations
            stubWriter.setWriteResult('delete-success', true);

            // Act
            const result = await groupMemberService.leaveGroup(memberUserId, testGroupId);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Successfully left the group',
            });
        });

        test('should reject unauthorized leave request', async () => {
            // Act & Assert
            await expect(groupMemberService.leaveGroup('', testGroupId)).rejects.toThrow(/Authentication required/);
        });

        test('should reject leave request for non-existent group', async () => {
            // Setup: No group found
            stubReader.setDocument('groups', testGroupId, null);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(memberUserId, testGroupId)).rejects.toThrow(/Group not found/);
        });

        test('should reject leave request for non-member', async () => {
            // Setup: Group exists but user is not a member
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, null); // Member doesn't exist

            // Act & Assert
            await expect(groupMemberService.leaveGroup(memberUserId, testGroupId)).rejects.toThrow(/Invalid input data/);
        });
    });

    describe('Remove Member Validation', () => {
        test('should prevent non-creator from removing members', async () => {
            // Setup: Non-creator trying to remove another member
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const targetMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId(otherMemberUserId)
                .withGroupId(testGroupId)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${otherMemberUserId}`, targetMemberDoc);

            // Act & Assert - Non-creator (memberUserId) trying to remove otherMemberUserId
            await expect(groupMemberService.removeGroupMember(memberUserId, testGroupId, otherMemberUserId)).rejects.toThrow(/Access denied/);
        });

        test('should prevent removing the group creator', async () => {
            // Setup: Creator trying to remove themselves via removeGroupMember
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const creatorMemberDoc = new GroupMemberDocumentBuilder()
                .withUserId(creatorUserId)
                .withGroupId(testGroupId)
                .withRole(MemberRoles.ADMIN)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMemberDoc);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember(creatorUserId, testGroupId, creatorUserId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent removing member with outstanding balance', async () => {
            // Setup: Creator trying to remove member with debt
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(memberUserId)
                .withGroupId(testGroupId)
                .build();

            // Mock balance calculation to return outstanding balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 25.0, // Member is owed $25
                            totalPaid: 50,
                            totalOwed: 25,
                        },
                    },
                },
            });

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember(creatorUserId, testGroupId, memberUserId)).rejects.toThrow(/Invalid input data/);
        });

        test('should allow creator to remove member with settled balance', async () => {
            // Setup: Creator removing member with zero balance
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            const memberDoc = new GroupMemberDocumentBuilder()
                .withUserId(memberUserId)
                .withGroupId(testGroupId)
                .build();

            // Mock balance calculation to return zero balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 0.0, // Member has settled balance
                            totalPaid: 25,
                            totalOwed: 25,
                        },
                    },
                },
            });

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);

            // Mock successful write operations
            stubWriter.setWriteResult('remove-success', true);

            // Act
            const result = await groupMemberService.removeGroupMember(creatorUserId, testGroupId, memberUserId);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Member removed successfully',
            });
        });

        test('should reject removal of non-existent member', async () => {
            // Setup: Creator trying to remove non-existent member
            const testGroup = new GroupBuilder()
                .withId(testGroupId)
                .withCreatedBy(creatorUserId)
                .build();

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_nonexistent-user`, null); // Member doesn't exist

            // Act & Assert
            await expect(groupMemberService.removeGroupMember(creatorUserId, testGroupId, 'nonexistent-user')).rejects.toThrow(/Invalid input data/);
        });

        test('should require valid member ID for removal', async () => {
            // Act & Assert
            await expect(groupMemberService.removeGroupMember(creatorUserId, testGroupId, '')).rejects.toThrow(/Missing required field.*memberId/);
        });
    });

    describe('Authorization Edge Cases', () => {
        test('should handle empty user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup('', testGroupId)).rejects.toThrow(/Authentication required/);
        });

        test('should handle null user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(null as any, testGroupId)).rejects.toThrow(/Authentication required/);
        });

        test('should handle undefined user ID in leave request', async () => {
            await expect(groupMemberService.leaveGroup(undefined as any, testGroupId)).rejects.toThrow(/Authentication required/);
        });
    });
});