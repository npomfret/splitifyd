import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { apiClient } from '@/app/apiClient';

// Mock dependencies
vi.mock('@/app/apiClient');
vi.mock('@/utils/change-detector');
vi.mock('@/utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logInfo: vi.fn(),
    logError: vi.fn(),
    logApiResponse: vi.fn(),
}));

describe('EnhancedGroupDetailStore - Simplified', () => {
    const mockGroup: any = {
        id: 'group1',
        name: 'Test Group',
        description: 'Test Description',
        memberIds: ['user1', 'user2'],
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
    };

    const mockFullDetails = {
        group: mockGroup,
        members: {
            members: [
                { uid: 'user1', email: 'user1@example.com', displayName: 'User One' },
                { uid: 'user2', email: 'user2@example.com', displayName: 'User Two' },
            ],
            hasMore: false,
        },
        expenses: {
            expenses: [
                {
                    id: 'exp1',
                    groupId: 'group1',
                    description: 'Dinner',
                    amount: 100,
                    currency: 'USD',
                    paidBy: 'user1',
                    category: 'Food',
                    date: '2024-01-01',
                    splitType: 'equal' as const,
                    participants: ['user1', 'user2'],
                    splits: [],
                    createdBy: 'user1',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                    deletedAt: null,
                    deletedBy: null,
                },
            ],
            count: 1,
            hasMore: false,
            nextCursor: undefined,
        },
        balances: {
            groupId: 'group1',
            userBalances: {},
            simplifiedDebts: [],
            lastUpdated: '2024-01-01T00:00:00Z',
            balancesByCurrency: {},
        },
        settlements: {
            settlements: [],
            count: 0,
            hasMore: false,
            nextCursor: undefined,
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        enhancedGroupDetailStore.reset();
    });

    afterEach(() => {
        enhancedGroupDetailStore.dispose();
    });

    describe('Core functionality', () => {
        it('should load group data using consolidated endpoint', async () => {
            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValue(mockFullDetails);

            await enhancedGroupDetailStore.loadGroup('group1');

            expect(apiClient.getGroupFullDetails).toHaveBeenCalledWith('group1');
            expect(enhancedGroupDetailStore.group).toEqual(mockGroup);
            expect(enhancedGroupDetailStore.members).toHaveLength(2);
            expect(enhancedGroupDetailStore.expenses).toHaveLength(1);
            expect(enhancedGroupDetailStore.loading).toBe(false);
        });

        it('should handle errors properly', async () => {
            const error = new Error('Network error');
            vi.mocked(apiClient.getGroupFullDetails).mockRejectedValue(error);

            await expect(enhancedGroupDetailStore.loadGroup('group1')).rejects.toThrow('Network error');
            expect(enhancedGroupDetailStore.error).toBe('Network error');
            expect(enhancedGroupDetailStore.loading).toBe(false);
        });

        it('should handle pagination for expenses', async () => {
            // Initial load
            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValueOnce({
                ...mockFullDetails,
                expenses: {
                    ...mockFullDetails.expenses,
                    hasMore: true,
                    nextCursor: 'cursor1',
                },
            });

            await enhancedGroupDetailStore.loadGroup('group1');
            expect(enhancedGroupDetailStore.hasMoreExpenses).toBe(true);
            expect(enhancedGroupDetailStore.expenseCursor).toBe('cursor1');

            // Load more
            const moreExpenses = {
                ...mockFullDetails,
                expenses: {
                    expenses: [
                        {
                            ...mockFullDetails.expenses.expenses[0],
                            id: 'exp2',
                            description: 'Lunch',
                        },
                    ],
                    count: 1,
                    hasMore: false,
                    nextCursor: undefined,
                },
            };

            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValueOnce(moreExpenses);
            await enhancedGroupDetailStore.loadMoreExpenses();

            expect(enhancedGroupDetailStore.expenses).toHaveLength(2);
            expect(enhancedGroupDetailStore.hasMoreExpenses).toBe(false);
        });

        it('should reset state properly', () => {
            // Set some state
            (enhancedGroupDetailStore as any).groupSignal.value = mockGroup;
            (enhancedGroupDetailStore as any).membersSignal.value = mockFullDetails.members.members;

            // Reset
            enhancedGroupDetailStore.reset();

            expect(enhancedGroupDetailStore.group).toBeNull();
            expect(enhancedGroupDetailStore.members).toEqual([]);
            expect(enhancedGroupDetailStore.expenses).toEqual([]);
            expect(enhancedGroupDetailStore.balances).toBeNull();
        });
    });

    describe('Individual fetch methods', () => {
        it('should fetch expenses separately', async () => {
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';
            
            const mockExpenseResponse = {
                expenses: mockFullDetails.expenses.expenses,
                hasMore: false,
                nextCursor: undefined,
            };

            vi.mocked(apiClient.getExpenses).mockResolvedValue(mockExpenseResponse);
            await enhancedGroupDetailStore.fetchExpenses();

            expect(apiClient.getExpenses).toHaveBeenCalledWith('group1', undefined, undefined, false);
            expect(enhancedGroupDetailStore.expenses).toEqual(mockFullDetails.expenses.expenses);
        });

        it('should fetch balances separately', async () => {
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';
            
            vi.mocked(apiClient.getGroupBalances).mockResolvedValue(mockFullDetails.balances);
            await enhancedGroupDetailStore.fetchBalances();

            expect(apiClient.getGroupBalances).toHaveBeenCalledWith('group1');
            expect(enhancedGroupDetailStore.balances).toEqual(mockFullDetails.balances);
        });

        it('should fetch members separately', async () => {
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';
            
            vi.mocked(apiClient.getGroupMembers).mockResolvedValue(mockFullDetails.members);
            await enhancedGroupDetailStore.fetchMembers();

            expect(apiClient.getGroupMembers).toHaveBeenCalledWith('group1');
            expect(enhancedGroupDetailStore.members).toEqual(mockFullDetails.members.members);
        });

        it('should fetch settlements separately', async () => {
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';
            
            const mockSettlementResponse = {
                settlements: [],
                count: 0,
                hasMore: false,
                nextCursor: undefined,
            };

            vi.mocked(apiClient.listSettlements).mockResolvedValue(mockSettlementResponse);
            await enhancedGroupDetailStore.fetchSettlements();

            expect(apiClient.listSettlements).toHaveBeenCalledWith('group1', 20, undefined, undefined);
            expect(enhancedGroupDetailStore.settlements).toEqual([]);
        });
    });

    describe('Real-time updates', () => {
        it('should subscribe to changes when group is loaded', () => {
            const mockChangeDetector = {
                subscribeToExpenseChanges: vi.fn().mockReturnValue(vi.fn()),
                subscribeToBalanceChanges: vi.fn().mockReturnValue(vi.fn()),
            };

            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';

            enhancedGroupDetailStore.subscribeToChanges('user1');

            expect(mockChangeDetector.subscribeToExpenseChanges).toHaveBeenCalledWith('group1', expect.any(Function));
            expect(mockChangeDetector.subscribeToBalanceChanges).toHaveBeenCalledWith('group1', expect.any(Function));
        });

        it('should refresh data when changes are detected', async () => {
            let expenseCallback: (() => void) | undefined;
            const mockChangeDetector = {
                subscribeToExpenseChanges: vi.fn((_, callback) => {
                    expenseCallback = callback;
                    return vi.fn();
                }),
                subscribeToBalanceChanges: vi.fn().mockReturnValue(vi.fn()),
            };

            (enhancedGroupDetailStore as any).changeDetector = mockChangeDetector;
            (enhancedGroupDetailStore as any).currentGroupId = 'group1';

            // Mock refresh responses
            vi.mocked(apiClient.getExpenses).mockResolvedValue({
                expenses: [...mockFullDetails.expenses.expenses],
                hasMore: false,
                nextCursor: undefined,
            });
            vi.mocked(apiClient.listSettlements).mockResolvedValue({
                settlements: [],
                count: 0,
                hasMore: false,
                nextCursor: undefined,
            });

            enhancedGroupDetailStore.subscribeToChanges('user1');

            // Trigger change
            if (expenseCallback) {
                await expenseCallback();
                // Wait for async operations
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            expect(apiClient.getExpenses).toHaveBeenCalled();
            expect(apiClient.listSettlements).toHaveBeenCalled();
        });
    });

    describe('Group management', () => {
        it('should leave group', async () => {
            const mockResponse = { success: true, message: 'Left group' };
            vi.mocked(apiClient.leaveGroup).mockResolvedValue(mockResponse);

            const result = await enhancedGroupDetailStore.leaveGroup('group1');

            expect(apiClient.leaveGroup).toHaveBeenCalledWith('group1');
            expect(result).toEqual(mockResponse);
        });

        it('should remove member', async () => {
            const mockResponse = { success: true, message: 'Member removed' };
            vi.mocked(apiClient.removeGroupMember).mockResolvedValue(mockResponse);

            const result = await enhancedGroupDetailStore.removeMember('group1', 'user2');

            expect(apiClient.removeGroupMember).toHaveBeenCalledWith('group1', 'user2');
            expect(result).toEqual(mockResponse);
        });
    });
});