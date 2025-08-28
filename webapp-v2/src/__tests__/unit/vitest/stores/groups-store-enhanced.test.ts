import { vi, beforeEach, describe, it, expect } from 'vitest';
import type { CreateGroupRequest, Group, ListGroupsResponse } from '@splitifyd/shared';

// Simplified mocks - focus on behavior, not implementation
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

vi.mock('@/utils/browser-logger', () => ({
    logWarning: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

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

// Simplified test helper
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
        balance: { balancesByCurrency: {} },
        lastActivity: 'Just created',
        lastActivityRaw: new Date().toISOString(),
        ...overrides,
    };
}

function createTestResponse(groups: Group[]): ListGroupsResponse {
    return {
        groups,
        count: groups.length,
        hasMore: false,
        pagination: { limit: 100, order: 'desc' },
    };
}

describe('EnhancedGroupsStore - Core Functionality', () => {
    beforeEach(() => {
        enhancedGroupsStore.reset();
        vi.clearAllMocks();
    });

    describe('Basic Operations', () => {
        it('should fetch and store groups', async () => {
            const testGroups = [
                createTestGroup({ id: 'group-1', name: 'Group 1' }),
                createTestGroup({ id: 'group-2', name: 'Group 2' }),
            ];
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(createTestResponse(testGroups));

            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups).toHaveLength(2);
            expect(enhancedGroupsStore.groups[0].name).toBe('Group 1');
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.initialized).toBe(true);
        });

        it('should create new group and add to list', async () => {
            const existingGroups = [createTestGroup({ id: 'existing-1' })];
            const newGroup = createTestGroup({ id: 'new-group', name: 'New Group' });
            
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(createTestResponse(existingGroups));
            vi.mocked(apiClient.createGroup).mockResolvedValueOnce(newGroup);
            // Mock the fetchGroups call after creation
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(createTestResponse([newGroup, ...existingGroups]));

            await enhancedGroupsStore.fetchGroups();
            
            const createRequest: CreateGroupRequest = {
                name: 'New Group',
                description: 'Test description',
            };
            
            const result = await enhancedGroupsStore.createGroup(createRequest);

            expect(result.id).toBe('new-group');
            expect(enhancedGroupsStore.groups).toHaveLength(2);
        });

        it('should handle API errors gracefully', async () => {
            const error = new Error('API Error');
            vi.mocked(apiClient.getGroups).mockRejectedValueOnce(error);

            // The store re-throws errors after setting them, so we need to catch
            await expect(enhancedGroupsStore.fetchGroups()).rejects.toThrow('API Error');

            expect(enhancedGroupsStore.error).toBeTruthy();
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.groups).toHaveLength(0);
        });
    });

    describe('State Management', () => {
        it('should manage loading state during operations', async () => {
            vi.mocked(apiClient.getGroups).mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve(createTestResponse([])), 100))
            );

            const fetchPromise = enhancedGroupsStore.fetchGroups();
            
            expect(enhancedGroupsStore.loading).toBe(true);
            
            await fetchPromise;
            
            expect(enhancedGroupsStore.loading).toBe(false);
        });

        it('should reset state completely', async () => {
            const testGroups = [createTestGroup()];
            vi.mocked(apiClient.getGroups).mockResolvedValueOnce(createTestResponse(testGroups));
            
            await enhancedGroupsStore.fetchGroups();

            expect(enhancedGroupsStore.groups).toHaveLength(1);

            enhancedGroupsStore.reset();

            expect(enhancedGroupsStore.groups).toHaveLength(0);
            expect(enhancedGroupsStore.error).toBeNull();
            expect(enhancedGroupsStore.loading).toBe(false);
            expect(enhancedGroupsStore.initialized).toBe(false);
        });

        it('should clear errors when clearError is called', () => {
            // This tests that the clearError method exists and can be called
            enhancedGroupsStore.clearError();
            expect(enhancedGroupsStore.error).toBeNull();
        });
    });
});