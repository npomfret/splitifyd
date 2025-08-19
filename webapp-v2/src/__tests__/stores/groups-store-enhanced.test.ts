import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced';
import { apiClient } from '@/app/apiClient';
import { ChangeDetector } from '@/utils/change-detector';
import type { Group } from '@shared/shared-types';

// Mock dependencies
vi.mock('@/app/apiClient');
vi.mock('@/utils/change-detector');
vi.mock('@/utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logInfo: vi.fn(),
}));

describe('EnhancedGroupsStore', () => {
    const mockGroups: any[] = [
        {
            id: 'group1',
            name: 'Test Group 1',
            description: 'Description 1',
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
        },
        {
            id: 'group2',
            name: 'Test Group 2',
            description: 'Description 2',
            memberIds: ['user1', 'user3'],
            balance: {
                balancesByCurrency: {
                    USD: {
                        currency: 'USD',
                        netBalance: -50,
                        totalOwed: 0,
                        totalOwing: 50,
                    },
                },
            },
            lastActivity: '1 week ago',
            lastActivityRaw: '2023-12-25T00:00:00Z',
            createdAt: '2023-12-25T00:00:00Z',
            updatedAt: '2023-12-25T00:00:00Z',
            createdBy: 'user1',
        },
    ];

    const mockMetadata = {
        lastChangeTimestamp: Date.now(),
        changeCount: 2,
        serverTime: Date.now(),
        hasRecentChanges: true,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        enhancedGroupsStore.reset();
    });

    afterEach(() => {
        enhancedGroupsStore.dispose();
    });

    describe('fetchGroups', () => {
        it('should fetch groups with metadata successfully', async () => {
            const mockResponse: any = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: mockMetadata,
            };

            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(apiClient.getGroups).toHaveBeenCalledWith({ includeMetadata: true });
            expect(enhancedGroupsStore.groups).toEqual(mockGroups);
            expect(enhancedGroupsStore.initialized).toBe(true);
            expect(enhancedGroupsStore.lastRefresh).toBe(mockMetadata.serverTime);
            expect(enhancedGroupsStore.error).toBeNull();
        });

        it('should skip update if no newer data available', async () => {
            // First fetch
            const firstResponse: any = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    ...mockMetadata,
                    serverTime: 1000,
                    lastChangeTimestamp: 1000,
                },
            };
            vi.mocked(apiClient.getGroups).mockResolvedValue(firstResponse);
            await enhancedGroupsStore.fetchGroups();

            // Second fetch with same timestamp
            const secondResponse: any = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    ...mockMetadata,
                    serverTime: 2000,
                    lastChangeTimestamp: 1000, // Same as before
                },
            };
            vi.mocked(apiClient.getGroups).mockResolvedValue(secondResponse);
            await enhancedGroupsStore.fetchGroups();

            // Groups should not be updated
            expect(enhancedGroupsStore.lastRefresh).toBe(1000); // Still the first timestamp
        });

        it('should handle fetch errors gracefully', async () => {
            const error = new Error('Network error');
            vi.mocked(apiClient.getGroups).mockRejectedValue(error);

            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow('Network error');
            expect(enhancedGroupsStore.error).toBe('Network error');
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('should fallback to timestamp comparison when no metadata', async () => {
            const mockResponse = {
                groups: [
                    {
                        ...mockGroups[0],
                        updatedAt: '2024-01-02T00:00:00Z', // Newer than initial
                    },
                ],
                count: 1,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
            };

            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups).toEqual(mockResponse.groups);
            expect(enhancedGroupsStore.initialized).toBe(true);
        });
    });

    describe('createGroup', () => {
        it('should create a group and add it to the list', async () => {
            const newGroup: any = {
                id: 'group3',
                name: 'New Group',
                description: 'New Description',
                memberIds: ['user1'],
                balance: {
                    balancesByCurrency: {},
                },
                lastActivity: 'just now',
                lastActivityRaw: '2024-01-03T00:00:00Z',
                createdAt: '2024-01-03T00:00:00Z',
                updatedAt: '2024-01-03T00:00:00Z',
            };

            vi.mocked(apiClient.createGroup).mockResolvedValue(newGroup);

            const createRequest = {
                name: 'New Group',
                description: 'New Description',
                memberEmails: ['user1@example.com'],
            };

            const result = await enhancedGroupsStore.createGroup(createRequest);

            expect(apiClient.createGroup).toHaveBeenCalledWith(createRequest);
            expect(result).toEqual(newGroup);
            expect(enhancedGroupsStore.groups).toContain(newGroup);
            expect(enhancedGroupsStore.groups[0]).toEqual(newGroup); // Should be at the beginning
        });

        it('should handle create errors', async () => {
            const error = new Error('Creation failed');
            vi.mocked(apiClient.createGroup).mockRejectedValue(error);

            const createRequest = {
                name: 'New Group',
                memberEmails: ['user1@example.com'],
            };

            await expect(enhancedGroupsStore.createGroup(createRequest)).rejects.toThrow('Creation failed');
            expect(enhancedGroupsStore.error).toBe('Creation failed');
        });
    });

    describe('refreshGroups', () => {
        it('should set isRefreshing flag during refresh', async () => {
            const mockResponse: any = {
                groups: mockGroups,
                metadata: mockMetadata,
            };
            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);

            const refreshPromise = enhancedGroupsStore.refreshGroups();
            expect(enhancedGroupsStore.isRefreshing).toBe(true);

            await refreshPromise;
            expect(enhancedGroupsStore.isRefreshing).toBe(false);
        });

        it('should reset isRefreshing even on error', async () => {
            vi.mocked(apiClient.getGroups).mockRejectedValue(new Error('Refresh failed'));

            const refreshPromise = enhancedGroupsStore.refreshGroups();
            expect(enhancedGroupsStore.isRefreshing).toBe(true);

            await expect(refreshPromise).rejects.toThrow('Refresh failed');
            expect(enhancedGroupsStore.isRefreshing).toBe(false);
        });
    });

    describe('subscribeToChanges', () => {
        it('should subscribe to group changes for a user', () => {
            const mockUnsubscribe = vi.fn();
            const mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);
            
            // Create a mock ChangeDetector instance
            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            
            // Replace the changeDetector instance
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            enhancedGroupsStore.subscribeToChanges('user1');

            expect(mockSubscribe).toHaveBeenCalledWith('user1', expect.any(Function));
        });

        it('should trigger refresh when change is detected', async () => {
            let changeCallback: (() => void) | undefined;
            const mockUnsubscribe = vi.fn();
            const mockSubscribe = vi.fn((userId, callback) => {
                changeCallback = callback;
                return mockUnsubscribe;
            });

            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            const mockResponse: any = {
                groups: mockGroups,
                metadata: mockMetadata,
            };
            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);

            enhancedGroupsStore.subscribeToChanges('user1');
            
            // Simulate a change detection
            if (changeCallback) {
                await changeCallback();
            }

            // Verify refresh was called
            expect(apiClient.getGroups).toHaveBeenCalledWith({ includeMetadata: true });
        });

        it('should unsubscribe previous listener when subscribing again', () => {
            const mockUnsubscribe1 = vi.fn();
            const mockUnsubscribe2 = vi.fn();
            let callCount = 0;
            
            const mockSubscribe = vi.fn(() => {
                callCount++;
                return callCount === 1 ? mockUnsubscribe1 : mockUnsubscribe2;
            });

            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            // First subscription
            enhancedGroupsStore.subscribeToChanges('user1');
            expect(mockSubscribe).toHaveBeenCalledTimes(1);

            // Second subscription should unsubscribe the first
            enhancedGroupsStore.subscribeToChanges('user2');
            expect(mockUnsubscribe1).toHaveBeenCalled();
            expect(mockSubscribe).toHaveBeenCalledTimes(2);
        });
    });

    describe('reset', () => {
        it('should reset all state to initial values', async () => {
            // Set up some state
            const mockResponse: any = {
                groups: mockGroups,
                metadata: mockMetadata,
            };
            vi.mocked(apiClient.getGroups).mockResolvedValue(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            // Reset
            enhancedGroupsStore.reset();

            expect(enhancedGroupsStore.groups).toEqual([]);
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.error).toBeNull();
            expect(enhancedGroupsStore.initialized).toBe(false);
            expect(enhancedGroupsStore.isRefreshing).toBe(false);
            expect(enhancedGroupsStore.lastRefresh).toBe(0);
        });
    });

    describe('dispose', () => {
        it('should clean up subscriptions', () => {
            const mockUnsubscribe = vi.fn();
            const mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);
            
            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            enhancedGroupsStore.subscribeToChanges('user1');
            enhancedGroupsStore.dispose();

            expect(mockUnsubscribe).toHaveBeenCalled();
        });
    });

    describe('Auto-refresh behavior', () => {
        it('should automatically refresh when a change is detected', async () => {
            let changeCallback: (() => void) | undefined;
            const mockSubscribe = vi.fn((userId, callback) => {
                changeCallback = callback;
                return vi.fn();
            });

            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            const initialResponse: any = {
                groups: mockGroups.slice(0, 1),
                count: 1,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    ...mockMetadata,
                    lastChangeTimestamp: 1000,
                    serverTime: 1000,
                },
            };

            const updatedResponse: any = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: {
                    ...mockMetadata,
                    lastChangeTimestamp: 2000,
                    serverTime: 2000,
                },
            };

            vi.mocked(apiClient.getGroups)
                .mockResolvedValueOnce(initialResponse)
                .mockResolvedValueOnce(updatedResponse);

            // Initial fetch
            await enhancedGroupsStore.fetchGroups();
            expect(enhancedGroupsStore.groups).toHaveLength(1);
            expect(enhancedGroupsStore.lastRefresh).toBe(1000);

            // Subscribe to changes
            enhancedGroupsStore.subscribeToChanges('user1');

            // Mock the refresh call with updated data
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(updatedResponse);

            // Trigger change which will call refreshGroups
            if (changeCallback) {
                await changeCallback();
            }

            // Wait a bit for async refresh to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should have refreshed with new data
            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.lastRefresh).toBe(2000);
        });

        it('should handle refresh errors silently in background', async () => {
            let changeCallback: (() => void) | undefined;
            const mockSubscribe = vi.fn((userId, callback) => {
                changeCallback = callback;
                return vi.fn();
            });

            const mockChangeDetector = {
                subscribeToGroupChanges: mockSubscribe,
            };
            (enhancedGroupsStore as any).changeDetector = mockChangeDetector;

            const initialResponse: any = {
                groups: mockGroups,
                count: 2,
                hasMore: false,
                pagination: { limit: 20, order: 'desc' },
                metadata: mockMetadata,
            };

            vi.mocked(apiClient.getGroups)
                .mockResolvedValueOnce(initialResponse);

            // Initial successful fetch
            await enhancedGroupsStore.fetchGroups();
            const initialGroups = enhancedGroupsStore.groups;
            
            // Clear any error from initial fetch
            enhancedGroupsStore.clearError();

            // Subscribe and set up failing refresh
            enhancedGroupsStore.subscribeToChanges('user1');
            
            // Mock the refresh to fail
            vi.mocked(apiClient.getGroups).mockRejectedValueOnce(new Error('Network error'));
            
            if (changeCallback) {
                // The callback is fire-and-forget, errors are caught internally
                await changeCallback();
                // Wait for async refresh attempt to complete
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Groups should remain unchanged after failed refresh
            expect(enhancedGroupsStore.groups).toEqual(initialGroups);
            // Error should not be set for background refresh (caught in refreshGroups)
            expect(enhancedGroupsStore.error).toBeNull();
        });
    });
});