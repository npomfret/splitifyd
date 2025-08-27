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

// Test builders - only specify what's needed for each test
class GroupBuilder {
    private group: any = {
        id: 'group1',
        name: 'Test Group',
        description: 'Test description',
        memberIds: ['user1'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: new Date().toISOString(),
        createdBy: 'user1',
    };

    withId(id: string): GroupBuilder {
        this.group.id = id;
        return this;
    }

    withName(name: string): GroupBuilder {
        this.group.name = name;
        return this;
    }

    withDescription(description: string): GroupBuilder {
        this.group.description = description;
        return this;
    }

    withMemberIds(memberIds: string[]): GroupBuilder {
        this.group.memberIds = memberIds;
        return this;
    }

    withBalance(currency: string, netBalance: number, totalOwed: number = 0, totalOwing: number = 0): GroupBuilder {
        if (!this.group.balance) {
            this.group.balance = { balancesByCurrency: {} };
        }
        this.group.balance.balancesByCurrency[currency] = {
            currency,
            netBalance,
            totalOwed,
            totalOwing,
        };
        return this;
    }

    withLastActivity(activity: string, raw?: string): GroupBuilder {
        this.group.lastActivity = activity;
        this.group.lastActivityRaw = raw || new Date().toISOString();
        return this;
    }

    build(): any {
        return { ...this.group };
    }
}

class GroupsResponseBuilder {
    private response: any = {
        groups: [],
        count: 0,
        hasMore: false,
        pagination: { limit: 20, order: 'desc' },
        metadata: {
            lastChangeTimestamp: Date.now(),
            changeCount: 0,
            serverTime: Date.now(),
            hasRecentChanges: false,
        },
    };

    withGroups(groups: any[]): GroupsResponseBuilder {
        this.response.groups = groups;
        this.response.count = groups.length;
        return this;
    }

    withMetadata(timestamp: number, changeCount: number = 0, hasRecentChanges: boolean = false): GroupsResponseBuilder {
        this.response.metadata = {
            lastChangeTimestamp: timestamp,
            changeCount,
            serverTime: timestamp,
            hasRecentChanges,
        };
        return this;
    }

    build(): any {
        return { ...this.response };
    }
}

class MemberBuilder {
    private member: any = {
        uid: 'user1',
        email: 'user@example.com',
        displayName: 'Test User',
    };

    withUid(uid: string): MemberBuilder {
        this.member.uid = uid;
        return this;
    }

    withEmail(email: string): MemberBuilder {
        this.member.email = email;
        return this;
    }

    withDisplayName(name: string): MemberBuilder {
        this.member.displayName = name;
        return this;
    }

    build(): any {
        return { ...this.member };
    }
}

class ExpenseBuilder {
    private expense: any = {
        id: 'exp1',
        groupId: 'group1',
        description: 'Test expense',
        amount: 100,
        currency: 'USD',
        paidBy: 'user1',
        category: 'General',
        date: '2024-01-15',
        splitType: 'equal' as const,
        participants: ['user1'],
        createdBy: 'user1',
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
    };

    withDescription(description: string): ExpenseBuilder {
        this.expense.description = description;
        return this;
    }

    withAmount(amount: number): ExpenseBuilder {
        this.expense.amount = amount;
        return this;
    }

    withCategory(category: string): ExpenseBuilder {
        this.expense.category = category;
        return this;
    }

    withParticipants(participants: string[]): ExpenseBuilder {
        this.expense.participants = participants;
        return this;
    }

    withSplits(splits: any[]): ExpenseBuilder {
        this.expense.splits = splits;
        return this;
    }

    build(): any {
        return { ...this.expense };
    }
}

describe('Enhanced Stores UI Integration', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        enhancedGroupsStore.reset();
        enhancedGroupDetailStore.reset();
    });

    describe('Dashboard Integration', () => {
        it('should initialize and fetch groups on mount', async () => {
            const mockGroups = [
                new GroupBuilder()
                    .withName('Family Expenses')
                    .withDescription('Shared family expenses')
                    .withMemberIds(['user1', 'user2', 'user3'])
                    .withBalance('USD', 150, 150, 0)
                    .withLastActivity('2 hours ago')
                    .build(),
                new GroupBuilder()
                    .withId('group2')
                    .withName('Trip to Paris')
                    .withDescription('Vacation expenses')
                    .withMemberIds(['user1', 'user4'])
                    .withBalance('EUR', -75, 0, 75)
                    .withLastActivity('1 day ago', new Date(Date.now() - 86400000).toISOString())
                    .build(),
            ];
            
            const mockResponse = new GroupsResponseBuilder()
                .withGroups(mockGroups)
                .build();

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
            const firstGroup = new GroupBuilder()
                .withName('Family Expenses')
                .withBalance('USD', 150, 150, 0)
                .build();
                
            const initialResponse = new GroupsResponseBuilder()
                .withGroups([firstGroup])
                .withMetadata(1000)
                .build();

            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(initialResponse as any);
            await enhancedGroupsStore.fetchGroups();
            expect(enhancedGroupsStore.groups).toHaveLength(1);

            // Simulate real-time update with new group
            const secondGroup = new GroupBuilder()
                .withId('group2')
                .withName('Trip to Paris')
                .withBalance('EUR', -75, 0, 75)
                .build();
                
            const updatedResponse = new GroupsResponseBuilder()
                .withGroups([firstGroup, secondGroup])
                .withMetadata(2000, 1, true)
                .build();

            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(updatedResponse as any);
            await enhancedGroupsStore.refreshGroups();

            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.lastRefresh).toBe(2000);
        });

        it('should display correct balance information', async () => {
            const mockGroups = [
                new GroupBuilder()
                    .withBalance('USD', 150, 150, 0)
                    .build(),
                new GroupBuilder()
                    .withId('group2')
                    .withBalance('EUR', -75, 0, 75)
                    .build(),
            ];
            
            const mockResponse = new GroupsResponseBuilder()
                .withGroups(mockGroups)
                .build();

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
            const mockGroup = new GroupBuilder()
                .withName('Family Expenses')
                .build();
            
            const mockMembers = [
                new MemberBuilder()
                    .withEmail('user1@example.com')
                    .withDisplayName('John Doe')
                    .build(),
                new MemberBuilder()
                    .withUid('user2')
                    .withEmail('user2@example.com')
                    .withDisplayName('Jane Doe')
                    .build(),
            ];
            
            const mockExpenses = [
                new ExpenseBuilder()
                    .withDescription('Groceries')
                    .withCategory('Food')
                    .withParticipants(['user1', 'user2'])
                    .withSplits([
                        { userId: 'user1', amount: 50 },
                        { userId: 'user2', amount: 50 },
                    ])
                    .build(),
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
            const mockGroups = [
                new GroupBuilder().withName('Test Group').build(),
            ];
            
            const mockResponse = new GroupsResponseBuilder()
                .withGroups(mockGroups)
                .build();
            
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(mockResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.error).toBeNull();
            expect(enhancedGroupsStore.groups).toEqual(mockGroups);
        });
    });
});
