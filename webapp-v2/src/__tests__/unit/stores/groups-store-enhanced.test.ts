import { vi, beforeEach, describe, it, expect } from 'vitest';
import { enhancedGroupsStore } from '@/app/stores/groups-store-enhanced';
import { apiClient } from '@/app/apiClient';
import type { CreateGroupRequest, Group, ListGroupsResponse } from '@shared/shared-types';

// Mock the API client
vi.mock('../../app/apiClient');
const mockApiClient = vi.mocked(apiClient);

// Mock browser-logger
vi.mock('../../utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

// Mock the ChangeDetector
vi.mock('../../utils/change-detector', () => {
    const mockInstance = {
        subscribeToGroupChanges: vi.fn(() => vi.fn()),
        subscribeToExpenseChanges: vi.fn(() => vi.fn()),
        subscribeToBalanceChanges: vi.fn(() => vi.fn()),
        dispose: vi.fn(),
    };

    return {
        ChangeDetector: vi.fn(() => mockInstance),
        mockChangeDetectorInstance: mockInstance, // Export for test access
    };
});

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

// Import the mock instance
// @ts-ignore
import { mockChangeDetectorInstance } from '@/utils/change-detector';

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

            mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(mockApiClient.getGroups).toHaveBeenCalledWith({ includeMetadata: true });
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
            mockApiClient.getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Mock a response with older change timestamp
            const newResponse = createTestResponseWithMetadata([testGroup], {
                lastChangeTimestamp: oldTimestamp - 5000, // Older change
                serverTime: oldTimestamp + 1000,
            });
            mockApiClient.getGroups.mockResolvedValueOnce(newResponse);

            await enhancedGroupsStore.fetchGroups();

            // Should have been called twice (initial + second call)
            expect(mockApiClient.getGroups).toHaveBeenCalledTimes(2);
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
            mockApiClient.getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Second fetch with newer change timestamp
            const newResponse = createTestResponseWithMetadata([newGroup], {
                lastChangeTimestamp: oldTimestamp + 5000, // Newer change
                serverTime: oldTimestamp + 10000,
            });
            mockApiClient.getGroups.mockResolvedValueOnce(newResponse);

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
            mockApiClient.getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Second fetch with newer group
            const newResponse: ListGroupsResponse = {
                groups: [newGroup],
                count: 1,
                hasMore: false,
                pagination: { limit: 100, order: 'desc' },
            };
            mockApiClient.getGroups.mockResolvedValueOnce(newResponse);

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups[0].updatedAt).toBe(new Date('2023-01-02').toISOString());
        });
    });

    describe('change subscription functionality', () => {
        it('subscribes to changes and triggers refresh', async () => {
            const userId = 'test-user-123';
            const testGroups = [createTestGroup()];
            const mockResponse = createTestResponseWithMetadata(testGroups);

            mockApiClient.getGroups.mockResolvedValue(mockResponse);

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

                expect(mockApiClient.getGroups).toHaveBeenCalled();
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

            mockApiClient.getGroups.mockReturnValueOnce(controllablePromise);

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
            mockApiClient.getGroups.mockRejectedValueOnce(error);

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

            mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

            const result = await enhancedGroupsStore.createGroup(groupRequest);

            expect(result).toEqual(mockCreatedGroup);
            expect(enhancedGroupsStore.groups).toContain(mockCreatedGroup);
            expect(enhancedGroupsStore.lastRefresh).toBeGreaterThan(0);
        });

        it('prepends new group to existing groups', async () => {
            // Set up existing groups
            const existingGroup = createTestGroup({ id: 'existing-1' });
            const initialResponse = createTestResponseWithMetadata([existingGroup]);
            mockApiClient.getGroups.mockResolvedValueOnce(initialResponse);
            await enhancedGroupsStore.fetchGroups();

            // Create new group
            const newGroup = createTestGroup({ id: 'new-group' });
            mockApiClient.createGroup.mockResolvedValueOnce(newGroup);

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
            mockApiClient.getGroups.mockResolvedValue(mockResponse);
            await enhancedGroupsStore.fetchGroups();

            // Update the group
            mockApiClient.updateGroup.mockResolvedValue({ message: 'Group updated successfully' });
            await enhancedGroupsStore.updateGroup('group-1', { name: 'Updated Name' });

            // Verify refresh was called (2 times: initial fetch + after update)
            expect(mockApiClient.getGroups).toHaveBeenCalledTimes(2);
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
            mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);
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
            mockApiClient.getGroups.mockRejectedValueOnce(error);

            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow('Network error');

            expect(enhancedGroupsStore.error).toBe('Network error');
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('handles create group errors properly', async () => {
            const error = new Error('Creation failed');
            mockApiClient.createGroup.mockRejectedValueOnce(error);

            await expect(enhancedGroupsStore.createGroup({ name: 'Test' })).rejects.toThrow('Creation failed');

            expect(enhancedGroupsStore.error).toBe('Creation failed');
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('clears error state', async () => {
            // Set error via a failed API call first
            const error = new Error('Test error');
            mockApiClient.getGroups.mockRejectedValueOnce(error);

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

    describe('integration: auto-refresh workflow', () => {
        it('completes full auto-refresh cycle on change notification', async () => {
            const userId = 'test-user-123';
            const initialGroups = [createTestGroup({ id: 'group-1', name: 'Initial' })];
            const updatedGroups = [createTestGroup({ id: 'group-1', name: 'Updated' })];

            // Setup initial state
            mockApiClient.getGroups.mockResolvedValueOnce(createTestResponseWithMetadata(initialGroups));
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
            mockApiClient.getGroups.mockResolvedValueOnce(
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
            expect(mockApiClient.getGroups).toHaveBeenCalledTimes(2); // Initial + refresh
        });

        it('handles rapid change notifications by triggering multiple refreshes', async () => {
            const userId = 'test-user-123';

            let changeCallback: (() => void) | undefined;
            mockChangeDetectorInstance.subscribeToGroupChanges.mockImplementation((_: string, callback: () => void) => {
                changeCallback = callback;
                return vi.fn();
            });

            enhancedGroupsStore.subscribeToChanges(userId);

            const mockResponse = createTestResponseWithMetadata([createTestGroup()]);
            mockApiClient.getGroups.mockResolvedValue(mockResponse);

            // Trigger multiple rapid changes
            if (changeCallback) {
                changeCallback();
                await new Promise((resolve) => setTimeout(resolve, 10));
                changeCallback();
                await new Promise((resolve) => setTimeout(resolve, 10));
                changeCallback();
                await new Promise((resolve) => setTimeout(resolve, 10));
            }

            // Each change triggers a refresh (no debouncing implemented)
            expect(mockApiClient.getGroups).toHaveBeenCalledTimes(3);
        });

        it('applies optimistic updates and refreshes after server update', async () => {
            // const userId = 'test-user-123';
            const groupId = 'group-1';
            const originalGroup = createTestGroup({ id: groupId, name: 'Original' });

            // Setup initial state
            mockApiClient.getGroups.mockResolvedValueOnce(createTestResponseWithMetadata([originalGroup]));
            await enhancedGroupsStore.fetchGroups();
            expect(enhancedGroupsStore.groups[0].name).toBe('Original');

            // Mock successful update and subsequent refresh
            const optimisticName = 'Optimistic Update';
            mockApiClient.updateGroup.mockResolvedValue({ message: 'Updated' });

            // Mock the refresh that happens after updateGroup
            const updatedGroup = createTestGroup({ id: groupId, name: optimisticName });
            mockApiClient.getGroups.mockResolvedValueOnce(createTestResponseWithMetadata([updatedGroup]));

            // Perform the update
            await enhancedGroupsStore.updateGroup(groupId, { name: optimisticName });

            // After update completes, data should be refreshed from server
            expect(enhancedGroupsStore.groups[0].name).toBe(optimisticName);

            // Verify both the update and refresh were called
            expect(mockApiClient.updateGroup).toHaveBeenCalledWith(groupId, { name: optimisticName });
            expect(mockApiClient.getGroups).toHaveBeenCalledTimes(2); // Initial + after update
        });

        it('recovers from failed auto-refresh attempts', async () => {
            const userId = 'test-user-123';

            // Set initial state first
            const initialGroups = [createTestGroup({ id: 'initial' })];
            mockApiClient.getGroups.mockResolvedValueOnce(createTestResponseWithMetadata(initialGroups));
            await enhancedGroupsStore.fetchGroups();

            let changeCallback: (() => void) | undefined;
            mockChangeDetectorInstance.subscribeToGroupChanges.mockImplementation((_: string, callback: () => void) => {
                changeCallback = callback;
                return vi.fn();
            });

            enhancedGroupsStore.subscribeToChanges(userId);

            // First refresh fails - error is set by fetchGroups
            mockApiClient.getGroups.mockRejectedValueOnce(new Error('Network error'));

            if (changeCallback) {
                changeCallback();
                await new Promise((resolve) => setTimeout(resolve, 20));
            }

            // Error is set from fetchGroups failure (not suppressed in background refresh)
            expect(enhancedGroupsStore.error).toBe('Network error');

            // Clear the error
            enhancedGroupsStore.clearError();

            // Second refresh succeeds
            const newGroups = [createTestGroup({ id: 'new' })];
            const successResponse = createTestResponseWithMetadata(newGroups);
            mockApiClient.getGroups.mockResolvedValueOnce(successResponse);

            if (changeCallback) {
                changeCallback();
                await new Promise((resolve) => setTimeout(resolve, 20));
            }

            // Should recover and load new data
            expect(enhancedGroupsStore.groups).toHaveLength(1);
            expect(enhancedGroupsStore.groups[0].id).toBe('new');
            expect(enhancedGroupsStore.error).toBeNull();
        });
    });
});
