import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced';
import { enhancedGroupDetailStore } from '@/app/stores/group-detail-store-enhanced';
import { apiClient } from '@/app/apiClient';

// Mock dependencies
vi.mock('@/app/apiClient');
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

describe('Enhanced Stores UI Integration', () => {
    const mockGroups: any[] = [
        {
            id: 'group1',
            name: 'Family Expenses',
            description: 'Shared family expenses',
            memberIds: ['user1', 'user2', 'user3'],
            balance: {
                balancesByCurrency: {
                    USD: {
                        currency: 'USD',
                        netBalance: 150,
                        totalOwed: 150,
                        totalOwing: 0,
                    },
                },
            },
            lastActivity: '2 hours ago',
            lastActivityRaw: new Date().toISOString(),
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: new Date().toISOString(),
            createdBy: 'user1',
        },
        {
            id: 'group2',
            name: 'Trip to Paris',
            description: 'Vacation expenses',
            memberIds: ['user1', 'user4'],
            balance: {
                balancesByCurrency: {
                    EUR: {
                        currency: 'EUR',
                        netBalance: -75,
                        totalOwed: 0,
                        totalOwing: 75,
                    },
                },
            },
            lastActivity: '1 day ago',
            lastActivityRaw: new Date(Date.now() - 86400000).toISOString(),
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
            createdBy: 'user1',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        enhancedGroupsStore.reset();
        enhancedGroupDetailStore.reset();
    });

    describe('Dashboard Integration', () => {
        it('should initialize and fetch groups on mount', async () => {
            const mockResponse = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    lastChangeTimestamp: Date.now(),
                    changeCount: 0,
                    serverTime: Date.now(),
                    hasRecentChanges: false,
                },
            };

            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);

            // Simulate component mount behavior
            expect(enhancedGroupsStore.initialized).toBe(false);

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.initialized).toBe(true);
            expect(enhancedGroupsStore.groups).toEqual(mockGroups);
            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.groups[0].name).toBe('Family Expenses');
            expect(enhancedGroupsStore.groups[1].name).toBe('Trip to Paris');
        });

        it('should handle real-time updates in dashboard', async () => {
            // Initial load
            const initialResponse = {
                groups: [mockGroups[0]],
                metadata: {
                    lastChangeTimestamp: 1000,
                    changeCount: 0,
                    serverTime: 1000,
                },
            };

            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(initialResponse as any);
            await enhancedGroupsStore.fetchGroups();
            expect(enhancedGroupsStore.groups).toHaveLength(1);

            // Simulate real-time update with new group
            const updatedResponse = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    lastChangeTimestamp: 2000,
                    changeCount: 1,
                    serverTime: 2000,
                    hasRecentChanges: true,
                },
            };

            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(updatedResponse as any);
            await enhancedGroupsStore.refreshGroups();

            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.lastRefresh).toBe(2000);
        });

        it('should display correct balance information', async () => {
            const mockResponse = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    lastChangeTimestamp: Date.now(),
                    changeCount: 0,
                    serverTime: Date.now(),
                    hasRecentChanges: false,
                },
            };

            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            // Verify balance data is accessible for UI
            const familyGroup = enhancedGroupsStore.groups.find((g) => g.id === 'group1');
            expect(familyGroup?.balance?.balancesByCurrency.USD).toBeDefined();
            expect(familyGroup?.balance?.balancesByCurrency.USD?.netBalance).toBe(150);
            expect(familyGroup?.balance?.balancesByCurrency.USD?.totalOwed).toBe(150);

            const tripGroup = enhancedGroupsStore.groups.find((g) => g.id === 'group2');
            expect(tripGroup?.balance?.balancesByCurrency.EUR).toBeDefined();
            expect(tripGroup?.balance?.balancesByCurrency.EUR?.netBalance).toBe(-75);
            expect(tripGroup?.balance?.balancesByCurrency.EUR?.totalOwing).toBe(75);
        });
    });

    describe('Group Detail Page Integration', () => {
        it('should load complete group details using consolidated endpoint', async () => {
            const mockGroup = mockGroups[0];
            const mockMembers = [
                { uid: 'user1', email: 'user1@example.com', displayName: 'John Doe' },
                { uid: 'user2', email: 'user2@example.com', displayName: 'Jane Doe' },
            ];
            const mockExpenses = [
                {
                    id: 'exp1',
                    groupId: 'group1',
                    description: 'Groceries',
                    amount: 100,
                    currency: 'USD',
                    paidBy: 'user1',
                    category: 'Food',
                    date: '2024-01-15',
                    splitType: 'equal' as const,
                    participants: ['user1', 'user2'],
                    splits: [
                        { userId: 'user1', amount: 50 },
                        { userId: 'user2', amount: 50 },
                    ],
                    createdBy: 'user1',
                    createdAt: '2024-01-15T00:00:00Z',
                    updatedAt: '2024-01-15T00:00:00Z',
                    deletedAt: null,
                    deletedBy: null,
                },
            ];
            const mockBalances = {
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
                lastUpdated: '2024-01-15T00:00:00Z',
                balancesByCurrency: {},
            };

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
                    settlements: [],
                    count: 0,
                    hasMore: false,
                    nextCursor: undefined,
                },
            };

            vi.mocked(apiClient.getGroupFullDetails).mockResolvedValue(mockFullDetails);

            await enhancedGroupDetailStore.loadGroup('group1');

            // Verify all data is loaded for UI display
            expect(enhancedGroupDetailStore.group).toEqual(mockGroup);
            expect(enhancedGroupDetailStore.members).toEqual(mockMembers);
            expect(enhancedGroupDetailStore.expenses).toEqual(mockExpenses);
            expect(enhancedGroupDetailStore.balances).toEqual(mockBalances);

            // Verify UI can access simplified debts for display
            expect(enhancedGroupDetailStore.balances?.simplifiedDebts).toHaveLength(1);
            expect(enhancedGroupDetailStore.balances?.simplifiedDebts[0].amount).toBe(50);
        });
    });



    describe('Error Handling in UI', () => {
        it('should show error state when fetch fails', async () => {
            const error = new Error('Network error');
            vi.mocked(apiClient.getGroups).mockRejectedValue(error);

            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow('Network error');

            expect(enhancedGroupsStore.error).toBe('Network error');
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.groups).toEqual([]);
        });

        it('should recover from errors on retry', async () => {
            // First attempt fails
            vi.mocked(apiClient.getGroups).mockRejectedValueOnce(new Error('Network error'));

            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow();
            expect(enhancedGroupsStore.error).toBe('Network error');

            // Second attempt succeeds
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce({
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    lastChangeTimestamp: Date.now(),
                    changeCount: 0,
                    serverTime: Date.now(),
                    hasRecentChanges: false,
                },
            });

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.error).toBeNull();
            expect(enhancedGroupsStore.groups).toEqual(mockGroups);
        });
    });
});
