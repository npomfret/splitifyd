import { getGroupOwner, isGroupOwner, isGroupMember } from '../../utils/groupHelpers';
import { Group, MemberRoles, MemberStatuses } from '../../shared/shared-types';

describe('Group Helpers', () => {
    const mockGroup: Group = {
        id: 'test-group-id',
        name: 'Test Group',
        createdBy: 'user-alice',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        securityPreset: 'open',
        presetAppliedAt: '2024-01-01T00:00:00Z',
        permissions: {
            expenseEditing: 'anyone',
            expenseDeletion: 'anyone',
            memberInvitation: 'anyone',
            memberApproval: 'automatic',
            settingsManagement: 'anyone',
        },
        members: {
            'user-alice': {
                role: MemberRoles.ADMIN,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2024-01-01T00:00:00Z',
                theme: {
                    light: '#FF0000',
                    dark: '#800000',
                    name: 'red',
                    pattern: 'solid',
                    assignedAt: '2024-01-01T00:00:00Z',
                    colorIndex: 0,
                },
            },
            'user-bob': {
                role: MemberRoles.MEMBER,
                status: MemberStatuses.ACTIVE,
                joinedAt: '2024-01-02T00:00:00Z',
                theme: {
                    light: '#00FF00',
                    dark: '#008000',
                    name: 'green',
                    pattern: 'solid',
                    assignedAt: '2024-01-02T00:00:00Z',
                    colorIndex: 1,
                },
            },
        },
    };

    describe('getGroupOwner', () => {
        it('should return the owner user ID', () => {
            const owner = getGroupOwner(mockGroup);
            expect(owner).toBe('user-alice');
        });

        it('should throw error when no admins exist (invalid state)', () => {
            const groupWithNoOwner: Group = {
                ...mockGroup,
                members: {
                    'user-bob': {
                        role: MemberRoles.MEMBER,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: '2024-01-02T00:00:00Z',
                        theme: mockGroup.members['user-bob'].theme,
                    },
                },
            };
            expect(() => getGroupOwner(groupWithNoOwner)).toThrow('Group test-group-id has no admin - invalid state');
        });
    });

    describe('isGroupOwner', () => {
        it('should return true for group owner', () => {
            const result = isGroupOwner(mockGroup, 'user-alice');
            expect(result).toBe(true);
        });

        it('should return false for non-owner member', () => {
            const result = isGroupOwner(mockGroup, 'user-bob');
            expect(result).toBe(false);
        });

        it('should return false for non-member', () => {
            const result = isGroupOwner(mockGroup, 'user-charlie');
            expect(result).toBe(false);
        });
    });

    describe('isGroupMember', () => {
        it('should return true for owner', () => {
            const result = isGroupMember(mockGroup, 'user-alice');
            expect(result).toBe(true);
        });

        it('should return true for member', () => {
            const result = isGroupMember(mockGroup, 'user-bob');
            expect(result).toBe(true);
        });

        it('should return false for non-member', () => {
            const result = isGroupMember(mockGroup, 'user-charlie');
            expect(result).toBe(false);
        });
    });
});