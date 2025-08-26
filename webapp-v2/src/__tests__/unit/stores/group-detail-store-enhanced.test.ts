import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { apiClient } from '@/app/apiClient';
import type { Group, User, ExpenseData, GroupBalances, SettlementListItem } from '@splitifyd/shared';

// Mock dependencies
vi.mock('@/app/apiClient');
vi.mock('@/utils/change-detector');
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
        it('should subscribe to expense and balance changes', () => {
            const mockUnsubscribeExpense = vi.fn();
            const mockUnsubscribeBalance = vi.fn();
            const mockSubscribeExpense = vi.fn().mockReturnValue(mockUnsubscribeExpense);
            const mockSubscribeBalance = vi.fn().mockReturnValue(mockUnsubscribeBalance);

            const mockChangeDetector = {
                subscribeToExpenseChanges: mockSubscribeExpense,
                subscribeToBalanceChanges: mockSubscribeBalance,
            };
            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;

            // Set a group first
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;

            enhancedGroupDetailStore.subscribeToChanges('user1');

            expect(mockSubscribeExpense).toHaveBeenCalledWith('group1', expect.any(Function));
            expect(mockSubscribeBalance).toHaveBeenCalledWith('group1', expect.any(Function));
        });

        it('should trigger refresh when expense change is detected', async () => {
            let expenseCallback: (() => void) | undefined;
            const mockSubscribeExpense = vi.fn((_, callback) => {
                expenseCallback = callback;
                return vi.fn();
            });
            const mockSubscribeBalance = vi.fn().mockReturnValue(vi.fn());

            const mockChangeDetector = {
                subscribeToExpenseChanges: mockSubscribeExpense,
                subscribeToBalanceChanges: mockSubscribeBalance,
            };
            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;

            // Set initial state
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;

            // Mock refresh responses
            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: [
                    ...mockExpenses,
                    {
                        ...mockExpenses[0],
                        id: 'expense2',
                        description: 'Lunch',
                    },
                ],
                hasMore: false,
            });
            vi.mocked(apiClient.listSettlements).mockResolvedValue({
                settlements: mockSettlements,
                count: 1,
                hasMore: false,
            });

            enhancedGroupDetailStore.subscribeToChanges('user1');

            // Trigger expense change
            if (expenseCallback) {
                await expenseCallback();
            }

            // Should have refreshed expenses
            expect(apiClient.getExpenses).toHaveBeenCalled();
            expect(enhancedGroupDetailStore.expenses).toHaveLength(2);
        });

        it('should trigger refresh when balance change is detected', async () => {
            let balanceCallback: (() => void) | undefined;
            const mockSubscribeExpense = vi.fn().mockReturnValue(vi.fn());
            const mockSubscribeBalance = vi.fn((_, callback) => {
                balanceCallback = callback;
                return vi.fn();
            });

            const mockChangeDetector = {
                subscribeToExpenseChanges: mockSubscribeExpense,
                subscribeToBalanceChanges: mockSubscribeBalance,
            };
            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;

            // Set initial state
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;

            // Mock refresh response
            const updatedBalances = {
                ...mockBalances,
                lastUpdated: '2024-01-02T00:00:00Z',
            };
            vi.mocked(apiClient.getGroupBalances).mockResolvedValue(updatedBalances);

            enhancedGroupDetailStore.subscribeToChanges('user1');

            // Trigger balance change
            if (balanceCallback) {
                await balanceCallback();
            }

            // Should have refreshed balances
            expect(apiClient.getGroupBalances).toHaveBeenCalled();
            expect(enhancedGroupDetailStore.balances).toEqual(updatedBalances);
        });
    });

    describe('pagination', () => {
        it('should load more expenses with cursor', async () => {
            const firstBatch = mockExpenses;
            const secondBatch = [
                {
                    ...mockExpenses[0],
                    id: 'expense2',
                    description: 'Lunch',
                },
            ];

            // First load
            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: firstBatch,
                hasMore: true,
                nextCursor: 'cursor1',
            });

            await enhancedGroupDetailStore.fetchExpenses();
            expect(enhancedGroupDetailStore.expenses).toEqual(firstBatch);
            expect(enhancedGroupDetailStore.hasMoreExpenses).toBe(true);
            expect(enhancedGroupDetailStore.expenseCursor).toBe('cursor1');

            // Load more
            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: secondBatch,
                hasMore: false,
            });

            await enhancedGroupDetailStore.loadMoreExpenses();
            expect(enhancedGroupDetailStore.expenses).toEqual([...firstBatch, ...secondBatch]);
            expect(enhancedGroupDetailStore.hasMoreExpenses).toBe(false);
        });

        it('should load more settlements with cursor', async () => {
            const firstBatch = mockSettlements;
            const secondBatch = [
                {
                    ...mockSettlements[0],
                    id: 'settlement2',
                    note: 'Final payment',
                },
            ];

            // First load
            vi.mocked(apiClient.listSettlements).mockResolvedValueOnce({
                settlements: firstBatch,
                count: 1,
                hasMore: true,
                nextCursor: 'cursor1',
            });

            await enhancedGroupDetailStore.fetchSettlements();
            expect(enhancedGroupDetailStore.settlements).toEqual(firstBatch);
            expect(enhancedGroupDetailStore.hasMoreSettlements).toBe(true);
            expect(enhancedGroupDetailStore.settlementsCursor).toBe('cursor1');

            // Load more
            vi.mocked(apiClient.listSettlements).mockResolvedValueOnce({
                settlements: secondBatch,
                count: 1,
                hasMore: false,
            });

            await enhancedGroupDetailStore.loadMoreSettlements();
            expect(enhancedGroupDetailStore.settlements).toEqual([...firstBatch, ...secondBatch]);
            expect(enhancedGroupDetailStore.hasMoreSettlements).toBe(false);
        });
    });

    describe('refreshAll', () => {
        it('should refresh all data concurrently', async () => {
            // Set initial group
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;

            vi.mocked(apiClient.getGroup).mockResolvedValue(mockGroup);
            vi.mocked(apiClient.getGroupMembers).mockResolvedValue({
                members: mockMembers,
                hasMore: false,
            });
            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: mockExpenses,
                hasMore: false,
            });
            vi.mocked(apiClient.getGroupBalances).mockResolvedValue(mockBalances);
            vi.mocked(apiClient.listSettlements).mockResolvedValue({
                settlements: mockSettlements,
                count: 1,
                hasMore: false,
            });

            await enhancedGroupDetailStore.refreshAll();

            // All endpoints should be called
            expect(apiClient.getGroup).toHaveBeenCalledWith('group1');
            expect(apiClient.getGroupMembers).toHaveBeenCalledWith('group1');
            expect(apiClient.getExpenses).toHaveBeenCalled();
            expect(apiClient.getGroupBalances).toHaveBeenCalledWith('group1');
            expect(apiClient.listSettlements).toHaveBeenCalled();

            // Data should be updated
            expect(enhancedGroupDetailStore.group).toEqual(mockGroup);
            expect(enhancedGroupDetailStore.members).toEqual(mockMembers);
            expect(enhancedGroupDetailStore.expenses).toEqual(mockExpenses);
            expect(enhancedGroupDetailStore.balances).toEqual(mockBalances);
            expect(enhancedGroupDetailStore.settlements).toEqual(mockSettlements);
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
            vi.mocked(apiClient.getGroup).mockResolvedValue(mockGroup);
            vi.mocked(apiClient.getGroupMembers).mockResolvedValue({
                members: mockMembers,
                hasMore: false,
            });
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

        it('should dispose subscriptions properly', () => {
            const mockUnsubscribeExpense = vi.fn();
            const mockUnsubscribeBalance = vi.fn();

            (enhancedGroupDetailStore as any).expenseUnsubscribe = mockUnsubscribeExpense;
            (enhancedGroupDetailStore as any).balanceUnsubscribe = mockUnsubscribeBalance;

            enhancedGroupDetailStore.dispose();

            expect(mockUnsubscribeExpense).toHaveBeenCalled();
            expect(mockUnsubscribeBalance).toHaveBeenCalled();
        });
    });

    describe('Auto-refresh behavior', () => {
        it('should handle background refresh errors silently', async () => {
            let expenseCallback: (() => void) | undefined;
            const mockSubscribeExpense = vi.fn((_, callback) => {
                expenseCallback = callback;
                return vi.fn();
            });

            const mockChangeDetector = {
                subscribeToExpenseChanges: mockSubscribeExpense,
                subscribeToBalanceChanges: vi.fn().mockReturnValue(vi.fn()),
            };
            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;

            // Set initial state
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;
            (enhancedGroupDetailStore as any).expensesSignal.value = mockExpenses;

            // Mock failed refresh
            vi.mocked(apiClient.getExpenses).mockRejectedValue(new Error('Network error'));
            vi.mocked(apiClient.listSettlements).mockRejectedValue(new Error('Network error'));

            enhancedGroupDetailStore.subscribeToChanges('user1');

            // Trigger change that will fail
            if (expenseCallback) {
                await expenseCallback();
            }

            // Expenses should remain unchanged
            expect(enhancedGroupDetailStore.expenses).toEqual(mockExpenses);
            // No error should be set for background refresh
            expect(enhancedGroupDetailStore.error).toBeNull();
        });

        it('should refresh data when changes are detected in real-time', async () => {
            let expenseCallback: (() => void) | undefined;
            let balanceCallback: (() => void) | undefined;

            const mockSubscribeExpense = vi.fn((_, callback) => {
                expenseCallback = callback;
                return vi.fn();
            });
            const mockSubscribeBalance = vi.fn((_, callback) => {
                balanceCallback = callback;
                return vi.fn();
            });

            const mockChangeDetector = {
                subscribeToExpenseChanges: mockSubscribeExpense,
                subscribeToBalanceChanges: mockSubscribeBalance,
            };
            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;

            // Set initial state
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;

            // Mock updated data
            const updatedExpenses = [
                ...mockExpenses,
                {
                    ...mockExpenses[0],
                    id: 'expense3',
                    description: 'Coffee',
                },
            ];
            const updatedBalances = {
                ...mockBalances,
                lastUpdated: '2024-01-03T00:00:00Z',
            };

            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: updatedExpenses,
                hasMore: false,
            });
            vi.mocked(apiClient.getGroupBalances).mockResolvedValue(updatedBalances);
            vi.mocked(apiClient.listSettlements).mockResolvedValue({
                settlements: mockSettlements,
                count: 1,
                hasMore: false,
            });

            enhancedGroupDetailStore.subscribeToChanges('user1');

            // Trigger both changes
            if (expenseCallback) await expenseCallback();
            if (balanceCallback) await balanceCallback();

            // Data should be updated
            expect(enhancedGroupDetailStore.expenses).toEqual(updatedExpenses);
            expect(enhancedGroupDetailStore.balances).toEqual(updatedBalances);
        });
    });
});
