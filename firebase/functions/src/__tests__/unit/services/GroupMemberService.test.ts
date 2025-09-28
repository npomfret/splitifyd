import { describe, it, test, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService
} from '../mocks/firestore-stubs';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { GroupDocument } from '../../../schemas';
import { MemberRoles, MemberStatuses } from '@splitifyd/shared';

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

    const defaultTheme = {
        light: '#FF6B6B',
        dark: '#FF6B6B',
        name: 'Test Theme',
        pattern: 'solid' as const,
        assignedAt: new Date().toISOString(),
        colorIndex: 0,
    };

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
        const testGroup = new FirestoreGroupBuilder().withId(testGroupId).withName('Test Group').build();
        stubReader.setDocument('groups', testGroupId, testGroup);

        vi.clearAllMocks();
    });

    describe('getGroupMember', () => {
        it('should return member if exists', async () => {
            const testMember = {
                uid: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString(),
            };

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
                {
                    uid: testUserId1,
                    groupId: testGroupId,
                    memberRole: 'member',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString(),
                },
                {
                    uid: testUserId2,
                    groupId: testGroupId,
                    memberRole: 'member',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString(),
                },
                {
                    uid: testUserId3,
                    groupId: testGroupId,
                    memberRole: 'admin',
                    memberStatus: 'active',
                    theme: defaultTheme,
                    joinedAt: new Date().toISOString(),
                },
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
            const testMember = {
                uid: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString(),
            };

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
            const completeMember = {
                uid: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString(),
            };

            stubReader.setDocument('group-members', `${testGroupId}_${testUserId1}`, completeMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.uid).toBe(testUserId1);
            expect(result?.groupId).toBe(testGroupId);
            expect(result?.memberRole).toBe('member');
            expect(result?.joinedAt).toBeDefined();
        });

        it('should handle member documents with admin role', async () => {
            const adminMember = {
                uid: testUserId1,
                groupId: testGroupId,
                memberRole: 'admin',
                memberStatus: 'active',
                theme: defaultTheme,
                joinedAt: new Date().toISOString(),
            };

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
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const creatorMember: GroupMemberDocument = {
                uid: creatorUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMember);

            // Act & Assert
            await expect(groupMemberService.leaveGroup(creatorUserId, testGroupId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent leaving with outstanding balance', async () => {
            // Setup: Member with outstanding balance trying to leave
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const memberDoc: GroupMemberDocument = {
                uid: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

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
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const memberDoc: GroupMemberDocument = {
                uid: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

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
            const otherMemberDoc: GroupMemberDocument = {
                uid: otherMemberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#0000FF', dark: '#0000FF', name: 'blue', pattern: 'solid', colorIndex: 2, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

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
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, null); // Member doesn't exist

            // Act & Assert
            await expect(groupMemberService.leaveGroup(memberUserId, testGroupId)).rejects.toThrow(/Invalid input data/);
        });
    });

    describe('Remove Member Validation', () => {
        test('should prevent non-creator from removing members', async () => {
            // Setup: Non-creator trying to remove another member
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const targetMemberDoc: GroupMemberDocument = {
                uid: otherMemberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#0000FF', dark: '#0000FF', name: 'blue', pattern: 'solid', colorIndex: 2, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${otherMemberUserId}`, targetMemberDoc);

            // Act & Assert - Non-creator (memberUserId) trying to remove otherMemberUserId
            await expect(groupMemberService.removeGroupMember(memberUserId, testGroupId, otherMemberUserId)).rejects.toThrow(/Access denied/);
        });

        test('should prevent removing the group creator', async () => {
            // Setup: Creator trying to remove themselves via removeGroupMember
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const creatorMemberDoc: GroupMemberDocument = {
                uid: creatorUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMemberDoc);

            // Act & Assert
            await expect(groupMemberService.removeGroupMember(creatorUserId, testGroupId, creatorUserId)).rejects.toThrow(/Invalid input data/);
        });

        test('should prevent removing member with outstanding balance', async () => {
            // Setup: Creator trying to remove member with debt
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const memberDoc: GroupMemberDocument = {
                uid: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

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
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

            const memberDoc: GroupMemberDocument = {
                uid: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId,
            };

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
            const testGroup: GroupDocument = {
                id: testGroupId,
                name: 'Test Group',
                description: 'Test group for validation',
                createdBy: creatorUserId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: {
                    [creatorUserId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 },
                    },
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone',
                },
                securityPreset: 'open',
            };

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
