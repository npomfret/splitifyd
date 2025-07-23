import { vi } from 'vitest';
import { groupsStore } from '../../app/stores/groups-store';
import { apiClient } from '../../app/apiClient';
import { TransformedGroupAdapter, GroupDetailAdapter } from '../support/test-adapters';
import type { CreateGroupRequest } from '@shared/apiTypes';
import type { ListGroupsResponse } from '@shared/apiContract';
import { GroupBuilder } from "../../../../firebase/functions/__tests__/support/builders";
import { MemberBuilder } from '../support/builders';

// Mock the API client
vi.mock('../../app/apiClient');
const mockApiClient = vi.mocked(apiClient);

describe('GroupsStore', () => {
  beforeEach(() => {
    // Reset store state
    groupsStore.reset();
    vi.clearAllMocks();
  });

  describe('fetchGroups', () => {
    it('loads groups successfully', async () => {
      const testGroups = [
        TransformedGroupAdapter.fromTestGroup(new GroupBuilder().withName('Group 1').build()),
        TransformedGroupAdapter.fromTestGroup(new GroupBuilder().withName('Group 2').build())
      ];

      const mockResponse: ListGroupsResponse = {
        groups: testGroups
      };

      mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);

      await groupsStore.fetchGroups();

      expect(groupsStore.groups).toEqual(testGroups);
      expect(groupsStore.initialized).toBe(true);
      expect(groupsStore.loading).toBe(false);
      expect(groupsStore.error).toBe(null);
    });

    it('sets loading state during fetch', async () => {
      const testGroups = [TransformedGroupAdapter.fromTestGroup(new GroupBuilder().build())];
      const mockResponse: ListGroupsResponse = { groups: testGroups };

      // Create a promise we can control
      let resolvePromise: (value: ListGroupsResponse) => void;
      const controllablePromise = new Promise<ListGroupsResponse>((resolve) => {
        resolvePromise = resolve;
      });

      mockApiClient.getGroups.mockReturnValueOnce(controllablePromise);

      // Start the fetch
      const fetchPromise = groupsStore.fetchGroups();

      // Check loading state is true
      expect(groupsStore.loading).toBe(true);
      expect(groupsStore.initialized).toBe(false);

      // Resolve the promise
      resolvePromise!(mockResponse);
      await fetchPromise;

      // Check final state
      expect(groupsStore.loading).toBe(false);
      expect(groupsStore.initialized).toBe(true);
    });

    it('prevents concurrent requests', async () => {
      const mockResponse: ListGroupsResponse = { groups: [] };
      mockApiClient.getGroups.mockResolvedValue(mockResponse);

      // Start two concurrent fetches
      const promise1 = groupsStore.fetchGroups();
      const promise2 = groupsStore.fetchGroups();

      await Promise.all([promise1, promise2]);

      // Should only call the API once
      expect(mockApiClient.getGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('createGroup', () => {
    it('creates group successfully and updates store', async () => {
      const groupRequest: CreateGroupRequest = {
        name: 'New Group',
        description: 'Test description'
      };

      const mockCreatedGroup = GroupDetailAdapter.fromTestGroup(
        new GroupBuilder().withName('New Group').withDescription('Test description').build(),
        { id: 'group-123', createdBy: 'user-123' }
      );

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      const result = await groupsStore.createGroup(groupRequest);

      expect(result).toMatchObject({
        id: 'group-123',
        name: 'New Group',
        memberCount: 0,
        yourBalance: 0,
        lastActivity: 'Just created',
        expenseCount: 0
      });

      // Check that the group was added to the store
      expect(groupsStore.groups).toHaveLength(1);
      expect(groupsStore.groups[0]).toEqual(result);
    });

    it('adds new group to beginning of existing groups list', async () => {
      // Set up existing groups
      const existingGroups = [
        TransformedGroupAdapter.fromTestGroup(new GroupBuilder().withName('Existing Group').build())
      ];
      // Set up existing groups by directly calling the store
      const existingResponse: ListGroupsResponse = { groups: existingGroups };
      mockApiClient.getGroups.mockResolvedValueOnce(existingResponse);
      await groupsStore.fetchGroups();
      vi.clearAllMocks(); // Clear the setup call

      const groupRequest: CreateGroupRequest = {
        name: 'Newest Group'
      };

      const mockCreatedGroup = GroupDetailAdapter.fromTestGroup(
        new GroupBuilder().withName('Newest Group').build(),
        { id: 'group-456', createdBy: 'user-123' }
      );

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      await groupsStore.createGroup(groupRequest);

      // New group should be first in the list
      expect(groupsStore.groups).toHaveLength(2);
      expect(groupsStore.groups[0].name).toBe('Newest Group');
      expect(groupsStore.groups[1].name).toBe('Existing Group');
    });

    it('transforms GroupDetail to TransformedGroup correctly', async () => {
      const groupRequest: CreateGroupRequest = {
        name: 'Transform Test'
      };

      const member1 = new MemberBuilder()
        .withUid('user-1')
        .withEmail('alice@test.com')
        .withName('Alice')
        .build();
      const member2 = new MemberBuilder()
        .withUid('user-2')
        .withEmail('bob@test.com')
        .withName('Bob')
        .build();
      
      const mockCreatedGroup = GroupDetailAdapter.fromTestGroup(
        new GroupBuilder()
          .withName('Transform Test')
          .build(),
        { 
          id: 'group-789', 
          createdBy: 'user-1',
          members: [member1, member2]
        }
      );

      mockApiClient.createGroup.mockResolvedValueOnce(mockCreatedGroup);

      const result = await groupsStore.createGroup(groupRequest);

      expect(result).toMatchObject({
        id: 'group-789',
        name: 'Transform Test',
        memberCount: 2,
        yourBalance: 0,
        lastActivity: 'Just created',
        lastExpense: null,
        members: mockCreatedGroup.members,
        expenseCount: 0,
        lastExpenseTime: null
      });
    });
  });

  describe('refreshGroups', () => {
    it('calls fetchGroups', async () => {
      const spy = vi.spyOn(groupsStore, 'fetchGroups');
      const mockResponse: ListGroupsResponse = { groups: [] };
      mockApiClient.getGroups.mockResolvedValueOnce(mockResponse);

      await groupsStore.refreshGroups();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearError', () => {
    it('clears the error state', async () => {
      // Set an error state
      // Set error state by causing an API failure
      mockApiClient.getGroups.mockRejectedValueOnce(new Error('Test error'));
      await groupsStore.fetchGroups().catch(() => {}); // Ignore the error for setup
      vi.clearAllMocks();

      groupsStore.clearError();

      expect(groupsStore.error).toBe(null);
    });
  });
});