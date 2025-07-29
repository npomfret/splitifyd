import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient } from './utils';
import { 
  createTestUser, 
  createOtherTestUser,
  createTestGroup,
  INVALID_TEST_DATA 
} from '../shared/test-data-fixtures';

describe('Groups CRUD API Integration', () => {
  let apiClient: ApiClient;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    apiClient = new ApiClient();

    // Create and authenticate test user
    const userData = createTestUser();

    testUser = await apiClient.post('/auth/register', userData);
    
    const loginResponse = await apiClient.post('/auth/login', {
      email: testUser.email,
      password: userData.password,
    });
    
    authToken = loginResponse.token;
  });

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('Group Creation', () => {
    it('should create a new group successfully', async () => {
      const groupData = createTestGroup();

      const response = await apiClient.post('/groups', groupData, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('name', groupData.name);
      expect(response).toHaveProperty('description', groupData.description);
      expect(response).toHaveProperty('currency', groupData.currency);
      expect(response).toHaveProperty('createdBy', testUser.uid);
      expect(response).toHaveProperty('members');
      expect(response.members).toContain(testUser.uid);
      expect(response).toHaveProperty('createdAt');
    });

    it('should reject group creation without authentication', async () => {
      const groupData = createTestGroup();

      await expect(
        apiClient.post('/groups', groupData)
      ).rejects.toThrow(/unauthorized|token/i);
    });

    it('should reject group creation with invalid data', async () => {
      const groupData = createTestGroup({
        name: INVALID_TEST_DATA.EMPTY_NAME,
      });

      await expect(
        apiClient.post('/groups', groupData, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/name|required/i);
    });
  });

  describe('Group Retrieval', () => {
    let testGroup: any;

    beforeEach(async () => {
      const groupData = createTestGroup({
        name: 'Test Group for Retrieval',
      });

      testGroup = await apiClient.post('/groups', groupData, {
        headers: getAuthHeaders(),
      });
    });

    it('should retrieve user groups', async () => {
      const response = await apiClient.get('/groups', {
        headers: getAuthHeaders(),
      });

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(0);
      
      const foundGroup = response.find((g: any) => g.id === testGroup.id);
      expect(foundGroup).toBeDefined();
      expect(foundGroup.name).toBe(testGroup.name);
    });

    it('should retrieve specific group by ID', async () => {
      const response = await apiClient.get(`/groups/${testGroup.id}`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id', testGroup.id);
      expect(response).toHaveProperty('name', testGroup.name);
      expect(response).toHaveProperty('members');
      expect(response.members).toContain(testUser.uid);
    });

    it('should reject access to non-existent group', async () => {
      const fakeGroupId = 'non-existent-group-id';

      await expect(
        apiClient.get(`/groups/${fakeGroupId}`, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/not found|404/i);
    });
  });

  describe('Group Updates', () => {
    let testGroup: any;

    beforeEach(async () => {
      const groupData = createTestGroup({
        name: 'Test Group for Updates',
        description: 'Original description',
      });

      testGroup = await apiClient.post('/groups', groupData, {
        headers: getAuthHeaders(),
      });
    });

    it('should update group name and description', async () => {
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
      };

      const response = await apiClient.put(`/groups/${testGroup.id}`, updateData, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('id', testGroup.id);
      expect(response).toHaveProperty('name', updateData.name);
      expect(response).toHaveProperty('description', updateData.description);
      expect(response).toHaveProperty('currency', testGroup.currency); // Should remain unchanged
    });

    it('should reject updates by non-members', async () => {
      // Create another user
      const otherUserData = createOtherTestUser();

      await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });

      const updateData = {
        name: 'Unauthorized Update',
      };

      await expect(
        apiClient.put(`/groups/${testGroup.id}`, updateData, {
          headers: {
            Authorization: `Bearer ${otherLoginResponse.token}`,
          },
        })
      ).rejects.toThrow(/forbidden|unauthorized|403/i);
    });
  });

  describe('Group Member Management', () => {
    let testGroup: any;
    let otherUser: any;
    let otherUserToken: string;

    beforeEach(async () => {
      // Create test group
      const groupData = createTestGroup({
        name: 'Test Group for Members',
      });

      testGroup = await apiClient.post('/groups', groupData, {
        headers: getAuthHeaders(),
      });

      // Create another user
      const otherUserData = createOtherTestUser();

      otherUser = await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });
      otherUserToken = otherLoginResponse.token;
    });

    it('should add member to group', async () => {
      const response = await apiClient.post(
        `/groups/${testGroup.id}/members`,
        { userId: otherUser.uid },
        { headers: getAuthHeaders() }
      );

      expect(response).toHaveProperty('members');
      expect(response.members).toContain(testUser.uid);
      expect(response.members).toContain(otherUser.uid);
    });

    it('should remove member from group', async () => {
      // First add the member
      await apiClient.post(
        `/groups/${testGroup.id}/members`,
        { userId: otherUser.uid },
        { headers: getAuthHeaders() }
      );

      // Then remove them
      const response = await apiClient.delete(
        `/groups/${testGroup.id}/members/${otherUser.uid}`,
        { headers: getAuthHeaders() }
      );

      expect(response).toHaveProperty('members');
      expect(response.members).toContain(testUser.uid);
      expect(response.members).not.toContain(otherUser.uid);
    });

    it('should allow member to leave group', async () => {
      // Add member first
      await apiClient.post(
        `/groups/${testGroup.id}/members`,
        { userId: otherUser.uid },
        { headers: getAuthHeaders() }
      );

      // Member leaves themselves
      const response = await apiClient.delete(
        `/groups/${testGroup.id}/members/${otherUser.uid}`,
        {
          headers: {
            Authorization: `Bearer ${otherUserToken}`,
          },
        }
      );

      expect(response).toHaveProperty('members');
      expect(response.members).not.toContain(otherUser.uid);
    });
  });

  describe('Group Deletion', () => {
    let testGroup: any;

    beforeEach(async () => {
      const groupData = createTestGroup({
        name: 'Test Group for Deletion',
        description: 'Will be deleted',
      });

      testGroup = await apiClient.post('/groups', groupData, {
        headers: getAuthHeaders(),
      });
    });

    it('should delete group successfully', async () => {
      const response = await apiClient.delete(`/groups/${testGroup.id}`, {
        headers: getAuthHeaders(),
      });

      expect(response).toHaveProperty('success', true);

      // Verify group is deleted
      await expect(
        apiClient.get(`/groups/${testGroup.id}`, {
          headers: getAuthHeaders(),
        })
      ).rejects.toThrow(/not found|404/i);
    });

    it('should reject deletion by non-creator', async () => {
      // Create another user and add them to group
      const otherUserData = createOtherTestUser();

      await apiClient.post('/auth/register', otherUserData);
      const otherLoginResponse = await apiClient.post('/auth/login', {
        email: otherUserData.email,
        password: otherUserData.password,
      });

      await expect(
        apiClient.delete(`/groups/${testGroup.id}`, {
          headers: {
            Authorization: `Bearer ${otherLoginResponse.token}`,
          },
        })
      ).rejects.toThrow(/forbidden|unauthorized|403/i);
    });
  });
});