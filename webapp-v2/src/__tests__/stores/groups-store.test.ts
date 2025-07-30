import { vi } from 'vitest';
import { groupsStore } from '../../app/stores/groups-store';
import { apiClient } from '../../app/apiClient';
import type { CreateGroupRequest, Group, User, ListGroupsResponse } from '@shared/types/webapp-shared-types';

// Mock the API client
vi.mock('../../app/apiClient');
const mockApiClient = vi.mocked(apiClient);

// Helper to create test groups
function createTestGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: `group-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Group',
    memberCount: 1,
    balance: {
      userBalance: {
        userId: 'test-user',
        netBalance: 0,
        owes: {},
        owedBy: {}
      },
      totalOwed: 0,
      totalOwing: 0
    },
    lastActivity: 'Just created',
    lastActivityRaw: new Date().toISOString(),
    expenseCount: 0,
    ...overrides
  };
}

// Helper to create test users
function createTestUser(overrides: Partial<User> = {}): User {
  const id = Math.random().toString(36).substr(2, 9);
  return {
    uid: `user-${id}`,
    email: `test-${id}@example.com`,
    displayName: `Test User ${id}`,
    ...overrides
  };
}

describe('GroupsStore', () => {
  beforeEach(() => {
    // Reset store state
    groupsStore.reset();
    vi.clearAllMocks();
  });

  describe('fetchGroups', () => {
    it('loads groups successfully', async () => {
      const testGroups: Group[] = [
        {
          id: 'group-1',
          name: 'Group 1',
          memberCount: 3,
          balance: {
            userBalance: {
              userId: 'test-user',
              netBalance: 0,
              owes: {},
              owedBy: {}
            },
            totalOwed: 0,
            totalOwing: 0
          },
          lastActivity: 'Just created',
          lastActivityRaw: new Date().toISOString(),
          expenseCount: 0
        },
        {
          id: 'group-2',
          name: 'Group 2',
          memberCount: 2,
          balance: {
            userBalance: {
              userId: 'test-user',
              netBalance: 50,
              owes: {},
              owedBy: { 'user-2': 50 }
            },
            totalOwed: 50,
            totalOwing: 0
          },
          lastActivity: '2 hours ago',
          lastActivityRaw: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          expenseCount: 5
        }
      ];

      const mockResponse: ListGroupsResponse = {
        groups: testGroups,
        count: testGroups.length,
        hasMore: false,
        pagination: {
          limit: 100,
          order: 'desc'
        }
      };

      mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);

      await groupsStore.fetchGroups();

      expect(groupsStore.groups).toEqual(testGroups);
      expect(groupsStore.initialized).toBe(true);
      expect(groupsStore.error).toBeNull();
    });

    it('sets loading state during fetch', async () => {
      const testGroups = [createTestGroup()];
      const mockResponse: ListGroupsResponse = {
        groups: testGroups,
        count: testGroups.length,
        hasMore: false,
        pagination: {
          limit: 100,
          order: 'desc'
        }
      };

      // Create a promise we can control
      let resolvePromise: (value: ListGroupsResponse) => void;
      const controllablePromise = new Promise<ListGroupsResponse>((resolve) => {
        resolvePromise = resolve;
      });

      mockApiClient.getGroups.mockReturnValueOnce(controllablePromise);

      // Start the fetch
      const fetchPromise = groupsStore.fetchGroups();

      // Should be loading
      expect(groupsStore.loading).toBe(true);

      // Resolve the promise
      resolvePromise!(mockResponse);
      await fetchPromise;

      // Should no longer be loading
      expect(groupsStore.loading).toBe(false);
    });

    it('handles fetch errors', async () => {
      const error = new Error('Network error');
      mockApiClient.getGroups.mockRejectedValueOnce(error);

      try {
        await groupsStore.fetchGroups();
        fail('Expected fetchGroups to throw an error');
      } catch (e) {
        // Expected to throw
      }

      expect(groupsStore.error).toBe('Network error');
      expect(groupsStore.groups).toEqual([]);
      expect(groupsStore.loading).toBe(false);
    });

    it('prevents concurrent fetches', async () => {
      const mockResponse: ListGroupsResponse = {
        groups: [],
        count: 0,
        hasMore: false,
        pagination: {
          limit: 100,
          order: 'desc'
        }
      };

      // Make getGroups return a long-running promise
      mockApiClient.getGroups.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      );

      // Start two fetches
      const fetch1 = groupsStore.fetchGroups();
      const fetch2 = groupsStore.fetchGroups();

      // Second fetch should return immediately
      await expect(fetch2).resolves.toBeUndefined();

      // Only one API call should have been made
      expect(mockApiClient.getGroups).toHaveBeenCalledTimes(1);

      // Clean up
      await fetch1;
    });
  });

  describe('createGroup', () => {
    it('creates a new group and adds it to the store', async () => {
      const groupRequest: CreateGroupRequest = {
        name: 'New Group',
        description: 'Test description'
      };

      const mockCreatedGroup = createTestGroup({
        id: 'group-123',
        name: 'New Group',
        description: 'Test description',
        createdBy: 'user-123'
      });

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      const result = await groupsStore.createGroup(groupRequest);

      expect(result).toMatchObject({
        id: 'group-123',
        name: 'New Group',
        description: 'Test description'
      });

      // Should be added to the store's groups
      expect(groupsStore.groups).toContainEqual(mockCreatedGroup);
    });

    it('prepends new group to existing groups', async () => {
      // Set up existing groups by fetching first
      const existingGroup = createTestGroup({ id: 'existing-1', name: 'Existing Group' });
      const mockResponse: ListGroupsResponse = {
        groups: [existingGroup],
        count: 1,
        hasMore: false,
        pagination: { limit: 100, order: 'desc' }
      };
      mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);
      await groupsStore.fetchGroups();

      const groupRequest: CreateGroupRequest = {
        name: 'Newest Group'
      };

      const mockCreatedGroup = createTestGroup({
        id: 'new-group',
        name: 'Newest Group'
      });

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      await groupsStore.createGroup(groupRequest);

      // New group should be first
      expect(groupsStore.groups[0].id).toBe('new-group');
      expect(groupsStore.groups[1].id).toBe('existing-1');
      expect(groupsStore.groups).toHaveLength(2);
    });

    it('handles creation errors', async () => {
      const groupRequest: CreateGroupRequest = {
        name: 'Transform Test'
      };

      const member1 = createTestUser({
        uid: 'user-1',
        email: 'alice@test.com',
        displayName: 'Alice'
      });
      
      const member2 = createTestUser({
        uid: 'user-2',
        email: 'bob@test.com',
        displayName: 'Bob'
      });
      
      const mockCreatedGroup = createTestGroup({
        name: 'Transform Test',
        members: [member1, member2],
        memberCount: 2
      });

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      const result = await groupsStore.createGroup(groupRequest);

      expect(result.members).toEqual([member1, member2]);
      expect(result.memberCount).toBe(2);
    });

    it('sets error state on creation failure', async () => {
      const error = new Error('Creation failed');
      mockApiClient.createGroup.mockRejectedValueOnce(error);

      await expect(groupsStore.createGroup({ name: 'Test' }))
        .rejects.toThrow('Creation failed');

      expect(groupsStore.error).toBe('Creation failed');
      expect(groupsStore.loading).toBe(false);
    });
  });

  describe('refreshGroups', () => {
    it('forces a refresh of groups', async () => {
      const mockResponse: ListGroupsResponse = {
        groups: [],
        count: 0,
        hasMore: false,
        pagination: { limit: 100, order: 'desc' }
      };

      mockApiClient.getGroups.mockResolvedValue(mockResponse);

      // Fetch groups first to set initialized to true
      await groupsStore.fetchGroups();

      await groupsStore.refreshGroups();

      // Should have called API
      expect(mockApiClient.getGroups).toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      // Set an error by triggering a failed fetch
      mockApiClient.getGroups.mockRejectedValueOnce(new Error('Some error'));
      try {
        await groupsStore.fetchGroups();
        fail('Expected fetchGroups to throw an error');
      } catch (e) {
        // Expected to throw
      }

      groupsStore.clearError();

      expect(groupsStore.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', async () => {
      // Set some state by fetching groups
      const mockResponse: ListGroupsResponse = {
        groups: [createTestGroup()],
        count: 1,
        hasMore: false,
        pagination: { limit: 100, order: 'desc' }
      };
      mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);
      await groupsStore.fetchGroups();
      
      // Verify state was set
      expect(groupsStore.groups.length).toBe(1);
      expect(groupsStore.initialized).toBe(true);

      groupsStore.reset();

      expect(groupsStore.groups).toEqual([]);
      expect(groupsStore.loading).toBe(false);
      expect(groupsStore.error).toBeNull();
      expect(groupsStore.initialized).toBe(false);
    });
  });
});