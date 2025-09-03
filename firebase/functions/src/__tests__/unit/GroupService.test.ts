import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../services/GroupService';
import { MockFirestoreReader } from '../../services/firestore/MockFirestoreReader';
import type { GroupDocument, ExpenseDocument } from '../../schemas';
import { Timestamp } from 'firebase-admin/firestore';
import { SecurityPresets, MemberRoles, MemberStatuses, SplitTypes } from '@splitifyd/shared';
import { ApiError } from '../../utils/errors';

// Mock dependencies
vi.mock('../../firebase', () => ({
    firestoreDb: {
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                delete: vi.fn(),
                get: vi.fn(),
                set: vi.fn(),
            })),
        })),
    },
}));

vi.mock('../../utils/performance-monitor', () => ({
    PerformanceMonitor: {
        monitorServiceCall: vi.fn((service, method, fn) => fn()),
        monitorBatchOperation: vi.fn((operation, fn) => fn(() => {})),
    },
}));

vi.mock('../../utils/logger-context', () => ({
    LoggerContext: {
        update: vi.fn(),
        get: vi.fn(() => ({ userId: 'test-user' })),
        setBusinessContext: vi.fn(),
    },
}));

vi.mock('../../../src/services/serviceRegistration', () => ({
    getGroupMemberService: vi.fn(() => ({
        createMemberSubcollection: vi.fn(),
        getGroupMembersResponse: vi.fn(() => ({ members: [] })),
    })),
    getUserService: vi.fn(() => ({
        getUsers: vi.fn((userIds) => {
            const userMap = new Map();
            // Mock a user for the test
            userMap.set('test-user-123', {
                uid: 'test-user-123',
                email: 'test@example.com',
                displayName: 'Test User',
            });
            return Promise.resolve(userMap);
        }),
    })),
    getExpenseService: vi.fn(() => ({
        listGroupExpenses: vi.fn(),
    })),
    getSettlementService: vi.fn(() => ({
        _getGroupSettlementsData: vi.fn(),
    })),
}));

vi.mock('../../services/balanceCalculator', () => ({
    calculateGroupBalances: vi.fn((groupId) => Promise.resolve({
        groupId: groupId,
        balancesByCurrency: {},
        userBalances: {},
        simplifiedDebts: [],
        lastUpdated: Timestamp.now(),
    })),
}));

vi.mock('../../services/expenseMetadataService', () => ({
    calculateExpenseMetadata: vi.fn(() => Promise.resolve({
        count: 0,
        lastExpenseTime: undefined,
    })),
}));

vi.mock('../../utils/groupHelpers', () => ({
    isGroupOwner: vi.fn(() => true),
    isGroupMember: vi.fn(() => true),
    isGroupOwnerAsync: vi.fn(() => Promise.resolve(true)),
    isGroupMemberAsync: vi.fn(() => Promise.resolve(true)),
    getThemeColorForMember: vi.fn(() => ({ light: '#FF6B6B' })),
}));

vi.mock('../../user-management/assign-theme-color', () => ({
    assignThemeColor: vi.fn(() => Promise.resolve('#FF6B6B')),
}));

describe('GroupService - Unit Tests', () => {
    let groupService: GroupService;
    let mockFirestoreReader: MockFirestoreReader;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        groupService = new GroupService(mockFirestoreReader);

        // Reset all mocks
        vi.clearAllMocks();
        mockFirestoreReader.resetAllMocks();
    });

    describe('fetchGroupWithAccess', () => {
        it('should return group data when group exists and user has access', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            const mockGroupData: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                description: 'Test Description',
                createdBy: userId,
                members: {
                    [userId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: {
                            light: '#FF6B6B',
                            dark: '#FF6B6B',
                            name: 'red',
                            pattern: 'solid',
                            assignedAt: new Date().toISOString(),
                            colorIndex: 0,
                        },
                    },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                securityPreset: SecurityPresets.OPEN,
                presetAppliedAt: new Date().toISOString(),
                permissions: {
                    expenseEditing: 'all-members',
                    expenseDeletion: 'creator-and-admins',
                    memberInvitation: 'admins-only',
                    memberApproval: 'automatic',
                    settingsManagement: 'admins-only',
                },
            };

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);

            // Access the private method via type assertion
            const result = await (groupService as any).fetchGroupWithAccess(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.group).toBeDefined();
            expect(result.group.id).toBe(groupId);
            expect(result.group.name).toBe('Test Group');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (groupService as any).fetchGroupWithAccess(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('deleteGroup', () => {
        it('should delete group when no expenses exist', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                description: 'Test Description',
                createdBy: userId,
                members: {
                    [userId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: {
                            light: '#FF6B6B',
                            dark: '#FF6B6B',
                            name: 'red',
                            pattern: 'solid',
                            assignedAt: new Date().toISOString(),
                            colorIndex: 0,
                        },
                    },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                securityPreset: SecurityPresets.OPEN,
                presetAppliedAt: new Date().toISOString(),
                permissions: {
                    expenseEditing: 'all-members',
                    expenseDeletion: 'creator-and-admins',
                    memberInvitation: 'admins-only',
                    memberApproval: 'automatic',
                    settingsManagement: 'admins-only',
                },
            };

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([]);

            const result = await groupService.deleteGroup(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledWith(groupId, { limit: 1 });
            expect(result.message).toBe('Group deleted successfully');
        });

        it('should throw error when group has expenses', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                description: 'Test Description',
                createdBy: userId,
                members: {
                    [userId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: {
                            light: '#FF6B6B',
                            dark: '#FF6B6B',
                            name: 'red',
                            pattern: 'solid',
                            assignedAt: new Date().toISOString(),
                            colorIndex: 0,
                        },
                    },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                securityPreset: SecurityPresets.OPEN,
                presetAppliedAt: new Date().toISOString(),
                permissions: {
                    expenseEditing: 'all-members',
                    expenseDeletion: 'creator-and-admins',
                    memberInvitation: 'admins-only',
                    memberApproval: 'automatic',
                    settingsManagement: 'admins-only',
                },
            };

            const mockExpense: ExpenseDocument = {
                id: 'expense-1',
                groupId: groupId,
                createdBy: userId,
                paidBy: userId,
                amount: 100,
                currency: 'USD',
                description: 'Test Expense',
                category: 'general',
                date: Timestamp.now(),
                splitType: SplitTypes.EQUAL,
                participants: [userId],
                splits: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);
            mockFirestoreReader.getExpensesForGroup.mockResolvedValue([mockExpense]);

            await expect(
                groupService.deleteGroup(groupId, userId)
            ).rejects.toThrow('Invalid input data');
        });
    });

    describe('getGroupBalances', () => {
        it('should return group balances for valid group and user', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-123';
            
            const mockGroupData: GroupDocument = {
                id: groupId,
                name: 'Test Group',
                description: 'Test Description',
                createdBy: userId,
                members: {
                    [userId]: {
                        role: MemberRoles.ADMIN,
                        status: MemberStatuses.ACTIVE,
                        joinedAt: new Date().toISOString(),
                        color: {
                            light: '#FF6B6B',
                            dark: '#FF6B6B',
                            name: 'red',
                            pattern: 'solid',
                            assignedAt: new Date().toISOString(),
                            colorIndex: 0,
                        },
                    },
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                securityPreset: SecurityPresets.OPEN,
                presetAppliedAt: new Date().toISOString(),
                permissions: {
                    expenseEditing: 'all-members',
                    expenseDeletion: 'creator-and-admins',
                    memberInvitation: 'admins-only',
                    memberApproval: 'automatic',
                    settingsManagement: 'admins-only',
                },
            };

            mockFirestoreReader.getGroup.mockResolvedValue(mockGroupData);

            const result = await groupService.getGroupBalances(groupId, userId);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith(groupId);
            expect(result.groupId).toBe(groupId);
            expect(result).toHaveProperty('userBalances');
            expect(result).toHaveProperty('simplifiedDebts');
            expect(result).toHaveProperty('lastUpdated');
            expect(result).toHaveProperty('balancesByCurrency');
        });

        it('should throw NOT_FOUND error when group does not exist', async () => {
            const groupId = 'nonexistent-group';
            const userId = 'test-user-123';

            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                groupService.getGroupBalances(groupId, userId)
            ).rejects.toThrow('Group not found');
        });
    });

    describe('batchFetchGroupData', () => {
        it('should return empty maps for empty group list', async () => {
            const result = await (groupService as any).batchFetchGroupData([]);

            expect(result.expensesByGroup.size).toBe(0);
            expect(result.settlementsByGroup.size).toBe(0);
            expect(result.expenseMetadataByGroup.size).toBe(0);
        });

        it('should batch fetch expenses and settlements for multiple groups', async () => {
            const groupIds = ['group1', 'group2'];
            
            const mockExpense1: ExpenseDocument = {
                id: 'expense-1',
                groupId: 'group1',
                createdBy: 'user1',
                paidBy: 'user1',
                amount: 100,
                currency: 'USD',
                description: 'Test Expense 1',
                category: 'general',
                date: Timestamp.now(),
                splitType: SplitTypes.EQUAL,
                participants: ['user1'],
                splits: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                deletedBy: null,
            };

            mockFirestoreReader.getExpensesForGroup
                .mockResolvedValueOnce([mockExpense1])
                .mockResolvedValueOnce([]);

            mockFirestoreReader.getSettlementsForGroup
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await (groupService as any).batchFetchGroupData(groupIds);

            expect(mockFirestoreReader.getExpensesForGroup).toHaveBeenCalledTimes(2);
            expect(mockFirestoreReader.getSettlementsForGroup).toHaveBeenCalledTimes(2);
            expect(result.expensesByGroup.has('group1')).toBe(true);
            expect(result.expensesByGroup.get('group1')).toHaveLength(1);
            expect(result.expenseMetadataByGroup.has('group1')).toBe(true);
            expect(result.expenseMetadataByGroup.get('group1')?.count).toBe(1);
        });
    });
});