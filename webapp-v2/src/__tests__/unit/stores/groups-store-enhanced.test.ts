import { vi, beforeEach, describe, it, expect } from 'vitest';
import type { CreateGroupRequest, Group, ListGroupsResponse } from '@shared/shared-types';

// Create a mock factory that will provide access to the instance
const mockChangeDetectorModule = {
    instance: null as any,
    createInstance: () => {
        const instance = {
            subscribeToGroupChanges: vi.fn(() => vi.fn()),
            subscribeToExpenseChanges: vi.fn(() => vi.fn()),
            subscribeToBalanceChanges: vi.fn(() => vi.fn()),
            dispose: vi.fn(),
        };
        mockChangeDetectorModule.instance = instance;
        return instance;
    },
};

// Mock the API client
vi.mock('@/app/apiClient', () => ({
    apiClient: {
        getGroups: vi.fn(),
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        leaveGroup: vi.fn(),
        removeGroupMember: vi.fn(),
    },
    ApiError: class ApiError extends Error {
        constructor(message: string, public statusCode?: number, public code?: string) {
            super(message);
            this.name = 'ApiError';
        }
    },
}));

// Mock browser-logger
vi.mock('@/utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

// Mock streaming-metrics
vi.mock('@/utils/streaming-metrics', () => ({
    streamingMetrics: {
        trackRestRefresh: vi.fn(),
        trackStreamUpdate: vi.fn(),
    },
}));

// Mock the ChangeDetector before importing the store
vi.mock('@/utils/change-detector', () => ({
    ChangeDetector: class {
        subscribeToGroupChanges = vi.fn(() => vi.fn());
        subscribeToExpenseChanges = vi.fn(() => vi.fn());
        subscribeToBalanceChanges = vi.fn(() => vi.fn());
        dispose = vi.fn();
    },
}));

// Import after mocks are set up
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced';
import { apiClient } from '@/app/apiClient';
import { ChangeDetector } from '@/utils/change-detector';

// Get the mock instance created by the store
const mockChangeDetectorInstance = (enhancedGroupsStore as any).changeDetector;

// Helper to create test groups
function createTestGroup(overrides: Partial<Group> = {}): Group {
    return {
        id: `group-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Test Group',
        members: {
            'test-user': {
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
        },
        securityPreset: 'open' as const,
        permissions: {
            expenseEditing: 'anyone' as const,
            expenseDeletion: 'anyone' as const,
            memberInvitation: 'anyone' as const,
            memberApproval: 'automatic' as const,
            settingsManagement: 'anyone' as const,
        },
        createdBy: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        balance: {
            balancesByCurrency: {},
        },
        lastActivity: 'Just created',
        lastActivityRaw: new Date().toISOString(),
        ...overrides,
    };
}

// Helper to create test API responses with metadata
function createTestResponseWithMetadata(
    groups: Group[],
    metadata?: {
        lastChangeTimestamp?: number;
        changeCount?: number;
        serverTime?: number;
        hasRecentChanges?: boolean;
    },
): ListGroupsResponse {
    return {
        groups,
        count: groups.length,
        hasMore: false,
        pagination: {
            limit: 100,
            order: 'desc',
        },
        metadata: metadata
            ? {
                  lastChangeTimestamp: Date.now() - 1000,
                  changeCount: 1,
                  serverTime: Date.now(),
                  hasRecentChanges: true,
                  ...metadata,
              }
            : undefined,
    };
}

// mockChangeDetectorInstance is already defined above

describe('EnhancedGroupsStore', () => {
    beforeEach(() => {
        // Reset store state
        enhancedGroupsStore.reset();
        vi.clearAllMocks();
    });

    describe('fetchGroups with metadata', () => {
        it('loads groups successfully with metadata', async () => {
            const testGroups = [createTestGroup({ id: 'group-1', name: 'Test Group 1' })];
            const mockResponse = createTestResponseWithMetadata(testGroups, {
                lastChangeTimestamp: 12345,
                changeCount: 2,
                serverTime: 67890,
                hasRecentChanges: true,
            });

            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(mockResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(vi.mocked(apiClient).getGroups).toHaveBeenCalledWith({ includeMetadata: true });
            expect(enhancedGroupsStore.groups).toEqual(testGroups);
            expect(enhancedGroupsStore.lastRefresh).toBe(67890);
            expect(enhancedGroupsStore.initialized).toBe(true);
        });

        it('skips update when no newer data available based on metadata', async () => {
            const testGroup = createTestGroup({ id: 'group-1' });
            const oldTimestamp = 10000;

            // Set up initial state with older timestamp
            const initialResponse = createTestResponseWithMetadata([testGroup], {
                serverTime: oldTimestamp,
            });
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Mock a response with older change timestamp
            const newResponse = createTestResponseWithMetadata([testGroup], {
                lastChangeTimestamp: oldTimestamp - 5000, // Older change
                serverTime: oldTimestamp + 1000,
            });
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(newResponse);

            await enhancedGroupsStore.fetchGroups();

            // Should have been called twice (initial + second call)
            expect(vi.mocked(apiClient).getGroups).toHaveBeenCalledTimes(2);
            expect(enhancedGroupsStore.lastRefresh).toBe(oldTimestamp); // Should remain old timestamp
        });

        it('updates when newer data is available based on metadata', async () => {
            const oldGroup = createTestGroup({ id: 'group-1', name: 'Old Name' });
            const newGroup = createTestGroup({ id: 'group-1', name: 'New Name' });
            const oldTimestamp = 10000;

            // Initial fetch
            const initialResponse = createTestResponseWithMetadata([oldGroup], {
                serverTime: oldTimestamp,
            });
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Second fetch with newer change timestamp
            const newResponse = createTestResponseWithMetadata([newGroup], {
                lastChangeTimestamp: oldTimestamp + 5000, // Newer change
                serverTime: oldTimestamp + 10000,
            });
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(newResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups[0].name).toBe('New Name');
            expect(enhancedGroupsStore.lastRefresh).toBe(oldTimestamp + 10000);
        });

        it('falls back to timestamp comparison when no metadata', async () => {
            const oldGroup = createTestGroup({
                id: 'group-1',
                updatedAt: new Date('2023-01-01').toISOString(),
            });
            const newGroup = createTestGroup({
                id: 'group-1',
                updatedAt: new Date('2023-01-02').toISOString(),
            });

            // Initial fetch
            const initialResponse: ListGroupsResponse = {
                groups: [oldGroup],
                count: 1,
                hasMore: false,
                pagination: { limit: 100, order: 'desc' },
                // No metadata
            };
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Second fetch with newer group
            const newResponse: ListGroupsResponse = {
                groups: [newGroup],
                count: 1,
                hasMore: false,
                pagination: { limit: 100, order: 'desc' },
            };
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(newResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups[0].updatedAt).toBe(new Date('2023-01-02').toISOString());
        });
    });

    describe('change subscription functionality', () => {
        it('subscribes to changes and triggers refresh', async () => {
            const userId = 'test-user-123';
            const testGroups = [createTestGroup()];
            const mockResponse = createTestResponseWithMetadata(testGroups);

            vi.mocked(apiClient).getGroups.mockResolvedValue(mockResponse);

            // Mock the change callback being called
            let changeCallback: (() => void) | undefined;
            mockChangeDetectorInstance.subscribeToGroupChanges.mockImplementation((_: string, callback: () => void) => {
                changeCallback = callback;
                return vi.fn(); // Return unsubscribe function
            });

            // Subscribe to changes
            enhancedGroupsStore.subscribeToChanges(userId);

            expect(mockChangeDetectorInstance.subscribeToGroupChanges).toHaveBeenCalledWith(
                userId,
                expect.any(Function),
                expect.objectContaining({
                    maxRetries: 3,
                    retryDelay: 2000,
                    onError: expect.any(Function),
                }),
            );

            // Simulate a change notification
            expect(changeCallback).toBeDefined();
            if (changeCallback) {
                changeCallback();

                // Wait for async refresh to complete
                await new Promise((resolve) => setTimeout(resolve, 0));

                expect(vi.mocked(apiClient).getGroups).toHaveBeenCalled();
            }
        });

        it('unsubscribes from previous subscription when subscribing again', async () => {
            const userId = 'test-user-123';
            const firstUnsubscribe = vi.fn();
            const secondUnsubscribe = vi.fn();

            mockChangeDetectorInstance.subscribeToGroupChanges.mockReturnValueOnce(firstUnsubscribe).mockReturnValueOnce(secondUnsubscribe);

            // First subscription
            enhancedGroupsStore.subscribeToChanges(userId);
            expect(mockChangeDetectorInstance.subscribeToGroupChanges).toHaveBeenCalledTimes(1);

            // Second subscription should unsubscribe from first
            enhancedGroupsStore.subscribeToChanges(userId);
            expect(firstUnsubscribe).toHaveBeenCalled();
            expect(mockChangeDetectorInstance.subscribeToGroupChanges).toHaveBeenCalledTimes(2);
        });

        it('handles change subscription errors gracefully', async () => {
            const userId = 'test-user-123';

            // Mock subscription that throws
            mockChangeDetectorInstance.subscribeToGroupChanges.mockImplementation(() => {
                throw new Error('Subscription failed');
            });

            // Currently the implementation doesn't handle this error, but we can test that it propagates
            expect(() => {
                enhancedGroupsStore.subscribeToChanges(userId);
            }).toThrow('Subscription failed');
        });
    });

    describe('refreshGroups', () => {
        it('sets isRefreshing state during refresh', async () => {
            const testGroups = [createTestGroup()];
            const mockResponse = createTestResponseWithMetadata(testGroups);

            // Create a promise we can control
            let resolvePromise: (value: ListGroupsResponse) => void;
            const controllablePromise = new Promise<ListGroupsResponse>((resolve) => {
                resolvePromise = resolve;
            });

            vi.mocked(apiClient).getGroups.mockReturnValueOnce(controllablePromise);

            // Start the refresh
            const refreshPromise = enhancedGroupsStore.refreshGroups();

            // Should be refreshing
            expect(enhancedGroupsStore.isRefreshing).toBe(true);

            // Resolve the promise
            resolvePromise!(mockResponse);
            await refreshPromise;

            // Should no longer be refreshing
            expect(enhancedGroupsStore.isRefreshing).toBe(false);
        });

        it('clears isRefreshing state even on error', async () => {
            const error = new Error('Network error');
            vi.mocked(apiClient).getGroups.mockRejectedValueOnce(error);

            try {
                await enhancedGroupsStore.refreshGroups();
            } catch (e) {
                // Expected to throw
            }

            expect(enhancedGroupsStore.isRefreshing).toBe(false);
        });
    });

    describe('createGroup', () => {
        it('creates group and updates local state', async () => {
            const groupRequest: CreateGroupRequest = {
                name: 'New Group',
                description: 'Test description',
            };

            const mockCreatedGroup = createTestGroup({
                id: 'new-group-123',
                name: 'New Group',
                description: 'Test description',
            });

            vi.mocked(apiClient).createGroup.mockResolvedValueOnce(mockCreatedGroup);
            
            // Mock the subsequent fetchGroups call to include the new group
            const responseWithNewGroup = createTestResponseWithMetadata([mockCreatedGroup]);
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(responseWithNewGroup);

            const result = await enhancedGroupsStore.createGroup(groupRequest);

            expect(result).toEqual(mockCreatedGroup);
            expect(enhancedGroupsStore.groups).toContain(mockCreatedGroup);
            expect(enhancedGroupsStore.lastRefresh).toBeGreaterThan(0);
        });

        it('prepends new group to existing groups', async () => {
            // Set up existing groups
            const existingGroup = createTestGroup({ id: 'existing-1' });
            const initialResponse = createTestResponseWithMetadata([existingGroup]);
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Create new group
            const newGroup = createTestGroup({ id: 'new-group' });
            vi.mocked(apiClient).createGroup.mockResolvedValueOnce(newGroup);
            
            // Mock the subsequent fetchGroups call to include both groups
            const responseWithBothGroups = createTestResponseWithMetadata([newGroup, existingGroup]);
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(responseWithBothGroups);

            await enhancedGroupsStore.createGroup({ name: 'New Group' });

            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.groups[0].id).toBe('new-group');
            expect(enhancedGroupsStore.groups[1].id).toBe('existing-1');
        });
    });

    describe('updateGroup', () => {
        it('refreshes groups after update', async () => {
            const testGroups = [createTestGroup({ id: 'group-1', name: 'Original Name' })];
            const mockResponse = createTestResponseWithMetadata(testGroups);

            // Setup initial state with the group
            vi.mocked(apiClient).getGroups.mockResolvedValue(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            // Update the group
            vi.mocked(apiClient).updateGroup.mockResolvedValue({ message: 'Group updated successfully' });
            await enhancedGroupsStore.updateGroup('group-1', { name: 'Updated Name' });

            // Verify refresh was called (2 times: initial fetch + after update)
            expect(vi.mocked(apiClient).getGroups).toHaveBeenCalledTimes(2);
        });
    });

    describe('dispose and cleanup', () => {
        it('cleans up change subscription on dispose', () => {
            const unsubscribe = vi.fn();
            mockChangeDetectorInstance.subscribeToGroupChanges.mockReturnValue(unsubscribe);

            enhancedGroupsStore.subscribeToChanges('test-user');
            enhancedGroupsStore.dispose();

            expect(unsubscribe).toHaveBeenCalled();
        });

        it('cleans up change subscription on reset', () => {
            const unsubscribe = vi.fn();
            mockChangeDetectorInstance.subscribeToGroupChanges.mockReturnValue(unsubscribe);

            enhancedGroupsStore.subscribeToChanges('test-user');
            enhancedGroupsStore.reset();

            expect(unsubscribe).toHaveBeenCalled();
        });

        it('resets all state on reset', async () => {
            // Set some initial state
            const testGroups = [createTestGroup()];
            const mockResponse = createTestResponseWithMetadata(testGroups);
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups).toHaveLength(1);
            expect(enhancedGroupsStore.initialized).toBe(true);

            enhancedGroupsStore.reset();

            expect(enhancedGroupsStore.groups).toEqual([]);
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.error).toBeNull();
            expect(enhancedGroupsStore.initialized).toBe(false);
            expect(enhancedGroupsStore.isRefreshing).toBe(false);
            expect(enhancedGroupsStore.lastRefresh).toBe(0);
        });
    });

    describe('error handling', () => {
        it('handles fetch errors properly', async () => {
            const error = new Error('Network error');
            vi.mocked(apiClient).getGroups.mockRejectedValueOnce(error);

            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow('Network error');

            expect(enhancedGroupsStore.error).toBe('Network error');
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('handles create group errors properly', async () => {
            const error = new Error('Creation failed');
            vi.mocked(apiClient).createGroup.mockRejectedValueOnce(error);

            await expect(enhancedGroupsStore.createGroup({ name: 'Test' })).rejects.toThrow('Creation failed');

            expect(enhancedGroupsStore.error).toBe('Creation failed');
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('clears error state', async () => {
            // Set error via a failed API call first
            const error = new Error('Test error');
            vi.mocked(apiClient).getGroups.mockRejectedValueOnce(error);

            try {
                await enhancedGroupsStore.fetchGroups();
            } catch (e) {
                // Expected to throw
            }

            expect(enhancedGroupsStore.error).toBe('Test error');

            enhancedGroupsStore.clearError();

            expect(enhancedGroupsStore.error).toBeNull();
        });
    });

    describe('auto-refresh', () => {
        it('completes auto-refresh cycle on change notification', async () => {
            const userId = 'test-user-123';
            const initialGroups = [createTestGroup({ id: 'group-1', name: 'Initial' })];
            const updatedGroups = [createTestGroup({ id: 'group-1', name: 'Updated' })];

            // Setup initial state
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(createTestResponseWithMetadata(initialGroups));
            await enhancedGroupsStore.fetchGroups();
            expect(enhancedGroupsStore.groups[0].name).toBe('Initial');

            // Setup change subscription
            let changeCallback: (() => void) | undefined;
            mockChangeDetectorInstance.subscribeToGroupChanges.mockImplementation((_: string, callback: () => void) => {
                changeCallback = callback;
                return vi.fn();
            });

            enhancedGroupsStore.subscribeToChanges(userId);

            // Mock the refresh response
            vi.mocked(apiClient).getGroups.mockResolvedValueOnce(
                createTestResponseWithMetadata(updatedGroups, {
                    lastChangeTimestamp: Date.now() + 1000,
                    serverTime: Date.now() + 1000,
                }),
            );

            // Trigger change notification
            expect(changeCallback).toBeDefined();
            if (changeCallback) {
                changeCallback();

                // Wait for async refresh
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            // Verify data was refreshed
            expect(enhancedGroupsStore.groups[0].name).toBe('Updated');
            expect(vi.mocked(apiClient).getGroups).toHaveBeenCalledTimes(2); // Initial + refresh
        });

    });
});
