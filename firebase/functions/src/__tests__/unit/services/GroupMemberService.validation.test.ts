import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';
import { Errors } from '../../../utils/errors';
import type { GroupMemberDocument } from '@splitifyd/shared';
import type { GroupDocument } from '../../../schemas';
import { MemberRoles, MemberStatuses } from '@splitifyd/shared';

/**
 * Unit tests for GroupMemberService validation logic converted from integration tests
 * These tests focus on business logic validation without requiring Firebase emulator
 */
describe('GroupMemberService - Leave/Remove Validation Logic', () => {
    let groupMemberService: GroupMemberService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let mockUserService: any;
    let mockBalanceService: any;

    const testGroupId = 'test-group-123';
    const creatorUserId = 'creator-user-123';
    const memberUserId = 'member-user-123';
    const otherMemberUserId = 'other-member-123';

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();

        // Mock UserService
        mockUserService = {
            getUsers: vi.fn().mockResolvedValue(new Map()),
            getUser: vi.fn(),
            updateProfile: vi.fn(),
            changePassword: vi.fn(),
            deleteAccount: vi.fn(),
            registerUser: vi.fn(),
            createUserDirect: vi.fn(),
        };

        groupMemberService = new GroupMemberService(stubReader, stubWriter, mockUserService);

        // Mock the balance service that gets created internally
        mockBalanceService = {
            calculateGroupBalances: vi.fn(),
        };
        (groupMemberService as any).balanceService = mockBalanceService;
    });

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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const creatorMember: GroupMemberDocument = {
                userId: creatorUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMember);

            // Act & Assert
            await expect(
                groupMemberService.leaveGroup(creatorUserId, testGroupId)
            ).rejects.toThrow(/Invalid input data/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const memberDoc: GroupMemberDocument = {
                userId: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            // Mock balance calculation to return outstanding balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: -50.0, // Member owes $50
                            totalPaid: 0,
                            totalOwed: 50
                        }
                    }
                }
            });

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);

            // Act & Assert
            await expect(
                groupMemberService.leaveGroup(memberUserId, testGroupId)
            ).rejects.toThrow(/Invalid input data/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const memberDoc: GroupMemberDocument = {
                userId: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            // Mock balance calculation to return zero balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 0.0, // Member has settled balance
                            totalPaid: 25,
                            totalOwed: 25
                        }
                    }
                }
            });

            // Add another member so the group has multiple members (needed for leave validation)
            const otherMemberDoc: GroupMemberDocument = {
                userId: otherMemberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#0000FF', dark: '#0000FF', name: 'blue', pattern: 'solid', colorIndex: 2, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
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
                message: 'Successfully left the group'
            });
        });

        test('should reject unauthorized leave request', async () => {
            // Act & Assert
            await expect(
                groupMemberService.leaveGroup('', testGroupId)
            ).rejects.toThrow(/Authentication required/);
        });

        test('should reject leave request for non-existent group', async () => {
            // Setup: No group found
            stubReader.setDocument('groups', testGroupId, null);

            // Act & Assert
            await expect(
                groupMemberService.leaveGroup(memberUserId, testGroupId)
            ).rejects.toThrow(/Group not found/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, null); // Member doesn't exist

            // Act & Assert
            await expect(
                groupMemberService.leaveGroup(memberUserId, testGroupId)
            ).rejects.toThrow(/Invalid input data/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const targetMemberDoc: GroupMemberDocument = {
                userId: otherMemberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#0000FF', dark: '#0000FF', name: 'blue', pattern: 'solid', colorIndex: 2, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${otherMemberUserId}`, targetMemberDoc);

            // Act & Assert - Non-creator (memberUserId) trying to remove otherMemberUserId
            await expect(
                groupMemberService.removeGroupMember(memberUserId, testGroupId, otherMemberUserId)
            ).rejects.toThrow(/Access denied/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const creatorMemberDoc: GroupMemberDocument = {
                userId: creatorUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.ADMIN,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${creatorUserId}`, creatorMemberDoc);

            // Act & Assert
            await expect(
                groupMemberService.removeGroupMember(creatorUserId, testGroupId, creatorUserId)
            ).rejects.toThrow(/Invalid input data/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const memberDoc: GroupMemberDocument = {
                userId: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            // Mock balance calculation to return outstanding balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 25.0, // Member is owed $25
                            totalPaid: 50,
                            totalOwed: 25
                        }
                    }
                }
            });

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_${memberUserId}`, memberDoc);

            // Act & Assert
            await expect(
                groupMemberService.removeGroupMember(creatorUserId, testGroupId, memberUserId)
            ).rejects.toThrow(/Invalid input data/);
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    },
                    [memberUserId]: {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            const memberDoc: GroupMemberDocument = {
                userId: memberUserId,
                groupId: testGroupId,
                memberRole: MemberRoles.MEMBER,
                memberStatus: MemberStatuses.ACTIVE,
                joinedAt: new Date().toISOString(),
                theme: { light: '#00FF00', dark: '#00FF00', name: 'green', pattern: 'solid', colorIndex: 1, assignedAt: new Date().toISOString() },
                invitedBy: creatorUserId
            };

            // Mock balance calculation to return zero balance
            mockBalanceService.calculateGroupBalances.mockResolvedValue({
                balancesByCurrency: {
                    USD: {
                        [memberUserId]: {
                            netBalance: 0.0, // Member has settled balance
                            totalPaid: 25,
                            totalOwed: 25
                        }
                    }
                }
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
                message: 'Member removed successfully'
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
                        color: { light: '#FF0000', dark: '#FF0000', name: 'red', pattern: 'solid', colorIndex: 0 }
                    }
                },
                permissions: {
                    expenseEditing: 'anyone',
                    expenseDeletion: 'anyone',
                    memberInvitation: 'anyone',
                    memberApproval: 'automatic',
                    settingsManagement: 'anyone'
                },
                securityPreset: 'open'
            };

            stubReader.setDocument('groups', testGroupId, testGroup);
            stubReader.setDocument('group-members', `${testGroupId}_nonexistent-user`, null); // Member doesn't exist

            // Act & Assert
            await expect(
                groupMemberService.removeGroupMember(creatorUserId, testGroupId, 'nonexistent-user')
            ).rejects.toThrow(/Invalid input data/);
        });

        test('should require valid member ID for removal', async () => {
            // Act & Assert
            await expect(
                groupMemberService.removeGroupMember(creatorUserId, testGroupId, '')
            ).rejects.toThrow(/Missing required field.*memberId/);
        });
    });

    describe('Authorization Edge Cases', () => {
        test('should handle empty user ID in leave request', async () => {
            await expect(
                groupMemberService.leaveGroup('', testGroupId)
            ).rejects.toThrow(/Authentication required/);
        });

        test('should handle null user ID in leave request', async () => {
            await expect(
                groupMemberService.leaveGroup(null as any, testGroupId)
            ).rejects.toThrow(/Authentication required/);
        });

        test('should handle undefined user ID in leave request', async () => {
            await expect(
                groupMemberService.leaveGroup(undefined as any, testGroupId)
            ).rejects.toThrow(/Authentication required/);
        });
    });
});