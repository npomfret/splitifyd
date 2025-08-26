import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { apiClient } from '@/app/apiClient';
import type { Group, User, ExpenseData, GroupBalances, SettlementListItem } from '@splitifyd/shared';

// Mock dependencies
vi.mock('@/app/apiClient');

// Mock ChangeDetector properly
vi.mock('@/utils/change-detector', () => ({
    ChangeDetector: class {
        subscribeToGroupChanges = vi.fn(() => vi.fn());
        subscribeToExpenseChanges = vi.fn(() => vi.fn());
        subscribeToBalanceChanges = vi.fn(() => vi.fn());
        dispose = vi.fn();
    },
}));

vi.mock('@/utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logInfo: vi.fn(),
    logError: vi.fn(),
    logApiResponse: vi.fn(),
}));

describe('EnhancedGroupDetailStore', () => {
    const mockGroup: Group = {
        id: 'group1',
        name: 'Test Group',
        description: 'Test Description',
        members: {
            user1: {
                joinedAt: new Date().toISOString(),
                role: 'admin' as const,
                status: 'active' as const,
                theme: {
                    light: '#ff0000',
                    dark: '#cc0000',
                    name: 'red',
                    pattern: 'solid' as const,
                    assignedAt: new Date().toISOString(),
                    colorIndex: 0,
                },
            },
            user2: {
                joinedAt: new Date().toISOString(),
                role: 'member' as const,
                status: 'active' as const,
                theme: {
                    light: '#00ff00',
                    dark: '#00cc00',
                    name: 'green',
                    pattern: 'solid' as const,
                    assignedAt: new Date().toISOString(),
                    colorIndex: 1,
                },
            },
            user3: {
                joinedAt: new Date().toISOString(),
                role: 'member' as const,
                status: 'active' as const,
                theme: {
                    light: '#0000ff',
                    dark: '#0000cc',
                    name: 'blue',
                    pattern: 'solid' as const,
                    assignedAt: new Date().toISOString(),
                    colorIndex: 2,
                },
            },
        },
        balance: {
            balancesByCurrency: {
                USD: {
                    currency: 'USD',
                    netBalance: 100,
                    totalOwed: 100,
                    totalOwing: 0,
                },
            },
        },
        lastActivity: '2 days ago',
        lastActivityRaw: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user1',
        securityPreset: 'open' as const,
        permissions: {
            expenseEditing: 'anyone' as const,
            expenseDeletion: 'anyone' as const,
            memberInvitation: 'anyone' as const,
            memberApproval: 'automatic' as const,
            settingsManagement: 'anyone' as const,
        },
    };

    const mockMembers: User[] = [
        {
            uid: 'user1',
            email: 'user1@example.com',
            displayName: 'User One',
        },
        {
            uid: 'user2',
            email: 'user2@example.com',
            displayName: 'User Two',
        },
    ];

    const mockExpenses: ExpenseData[] = [
        {
            id: 'expense1',
            groupId: 'group1',
            description: 'Dinner',
            amount: 100,
            currency: 'USD',
            paidBy: 'user1',
            category: 'Food',
            date: '2024-01-01',
            splitType: 'equal' as const,
            participants: ['user1', 'user2'],
            splits: [
                { userId: 'user1', amount: 50 },
                { userId: 'user2', amount: 50 },
            ],
            createdBy: 'user1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            deletedAt: null,
            deletedBy: null,
        },
    ];

    const mockBalances: GroupBalances = {
        groupId: 'group1',
        userBalances: {},
        simplifiedDebts: [
            {
                from: { userId: 'user2' },
                to: { userId: 'user1' },
                amount: 50,
                currency: 'USD',
            },
        ],
        lastUpdated: '2024-01-01T00:00:00Z',
        balancesByCurrency: {},
    };

    const mockSettlements: SettlementListItem[] = [
        {
            id: 'settlement1',
            groupId: 'group1',
            payer: {
                uid: 'user2',
                displayName: 'User Two',
                email: 'user2@example.com',
            },
            payee: {
                uid: 'user1',
                displayName: 'User One',
                email: 'user1@example.com',
            },
            amount: 25,
            currency: 'USD',
            date: '2024-01-02',
            note: 'Partial payment',
            createdAt: '2024-01-02T00:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        enhancedGroupDetailStore.reset();
    });

    afterEach(() => {
        enhancedGroupDetailStore.dispose();
    });

    describe('loadGroup', () => {
        it('should load all group data successfully', async () => {
            const mockFullDetails = {
                group: mockGroup,
                members: {
                    members: mockMembers,
                    hasMore: false,
                },
                expenses: {
                    expenses: mockExpenses,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
                balances: mockBalances,
                settlements: {
                    settlements: mockSettlements,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
            };

            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValue(mockFullDetails);

            await enhancedGroupDetailStore.loadGroup('group1');

            expect(enhancedGroupDetailStore.group).toEqual(mockGroup);
            expect(enhancedGroupDetailStore.members).toEqual(mockMembers);
            expect(enhancedGroupDetailStore.expenses).toEqual(mockExpenses);
            expect(enhancedGroupDetailStore.balances).toEqual(mockBalances);
            expect(enhancedGroupDetailStore.settlements).toEqual(mockSettlements);
            expect(enhancedGroupDetailStore.loading).toBe(false);
            expect(enhancedGroupDetailStore.error).toBeNull();
        });

        it('should handle load errors gracefully', async () => {
            const error = new Error('Failed to load group');
            vi.mocked(apiClient.getGroupFullDetails).mockRejectedValue(error);

            await expect(enhancedGroupDetailStore.loadGroup('group1')).rejects.toThrow('Failed to load group');

            expect(enhancedGroupDetailStore.group).toBeNull();
            expect(enhancedGroupDetailStore.error).toBe('Failed to load group');
            expect(enhancedGroupDetailStore.loading).toBe(false);
        });
    });

    describe('subscribeToChanges', () => {
        it('should subscribe to changes when group is loaded', async () => {
            const mockFullDetails = {
                group: mockGroup,
                members: {
                    members: mockMembers,
                    hasMore: false,
                },
                expenses: {
                    expenses: mockExpenses,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
                balances: mockBalances,
                settlements: {
                    settlements: mockSettlements,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
            };

            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValue(mockFullDetails);
            await enhancedGroupDetailStore.loadGroup('group1');

            const mockChangeDetector = (enhancedGroupDetailStore as any).changeDetector;
            enhancedGroupDetailStore.subscribeToChanges('user1');

            expect(mockChangeDetector.subscribeToExpenseChanges).toHaveBeenCalledWith('group1', expect.any(Function));
            expect(mockChangeDetector.subscribeToGroupChanges).toHaveBeenCalledWith('user1', expect.any(Function));
        });
    });



    describe('group management', () => {
        it('should leave a group successfully', async () => {
            const mockResponse = { success: true, message: 'Left group successfully' };
            vi.mocked(apiClient.leaveGroup).mockResolvedValue(mockResponse);

            const result = await enhancedGroupDetailStore.leaveGroup('group1');

            expect(apiClient.leaveGroup).toHaveBeenCalledWith('group1');
            expect(result).toEqual(mockResponse);
        });

        it('should remove a member successfully', async () => {
            const mockResponse = { success: true, message: 'Member removed' };
            vi.mocked(apiClient.removeGroupMember).mockResolvedValue(mockResponse);

            const result = await enhancedGroupDetailStore.removeMember('group1', 'user2');

            expect(apiClient.removeGroupMember).toHaveBeenCalledWith('group1', 'user2');
            expect(result).toEqual(mockResponse);
        });
    });

    describe('reset and dispose', () => {
        it('should reset all state to initial values', async () => {
            // Load some data first
            const mockFullDetails = {
                group: mockGroup,
                members: {
                    members: mockMembers,
                    hasMore: false,
                },
                expenses: {
                    expenses: mockExpenses,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
                balances: mockBalances,
                settlements: {
                    settlements: mockSettlements,
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
            };
            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValue(mockFullDetails);
            await enhancedGroupDetailStore.loadGroup('group1');

            // Reset
            enhancedGroupDetailStore.reset();

            expect(enhancedGroupDetailStore.group).toBeNull();
            expect(enhancedGroupDetailStore.members).toEqual([]);
            expect(enhancedGroupDetailStore.expenses).toEqual([]);
            expect(enhancedGroupDetailStore.balances).toBeNull();
            expect(enhancedGroupDetailStore.settlements).toEqual([]);
            expect(enhancedGroupDetailStore.loading).toBe(false);
            expect(enhancedGroupDetailStore.error).toBeNull();
        });
    });

});
