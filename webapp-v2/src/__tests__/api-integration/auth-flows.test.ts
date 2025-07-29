import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient } from './utils';
import { 
  createTestUser, 
  INVALID_TEST_DATA 
} from '../shared/test-data-fixtures';

describe('Auth Flow API Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = createTestUser();

      const response = await apiClient.post('/auth/register', userData);

      expect(response).toHaveProperty('uid');
      expect(response).toHaveProperty('email', userData.email);
      expect(response).toHaveProperty('name', userData.name);
      expect(response).not.toHaveProperty('password');
    });

    it('should reject registration with invalid email', async () => {
      const userData = createTestUser({
        email: INVALID_TEST_DATA.INVALID_EMAIL,
      });

      await expect(
        apiClient.post('/auth/register', userData)
      ).rejects.toThrow(/email/i);
    });

    it('should reject registration with weak password', async () => {
      const userData = createTestUser({
        password: INVALID_TEST_DATA.WEAK_PASSWORD,
      });

      await expect(
        apiClient.post('/auth/register', userData)
      ).rejects.toThrow(/password/i);
    });
  });

  describe('User Login', () => {
    let testUser: any;
    let userData: any;

    beforeEach(async () => {
      // Create a test user for login tests
      userData = createTestUser();

      testUser = await apiClient.post('/auth/register', userData);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: userData.password,
      };

      const response = await apiClient.post('/auth/login', loginData);

      expect(response).toHaveProperty('uid', testUser.uid);
      expect(response).toHaveProperty('email', testUser.email);
      expect(response).toHaveProperty('token');
      expect(typeof response.token).toBe('string');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      await expect(
        apiClient.post('/auth/login', loginData)
      ).rejects.toThrow(/password|credentials/i);
    });

    it('should reject login with non-existent email', async () => {
      const loginData = createTestUser({
        email: 'nonexistent@example.com',
      });

      await expect(
        apiClient.post('/auth/login', loginData)
      ).rejects.toThrow(/user|credentials/i);
    });
  });

  describe('Token Validation', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      // Create and login test user
      const userData = createTestUser();

      testUser = await apiClient.post('/auth/register', userData);
      
      const loginResponse = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: userData.password,
      });
      
      authToken = loginResponse.token;
    });

    it('should validate valid token', async () => {
      const response = await apiClient.get('/auth/verify', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response).toHaveProperty('uid', testUser.uid);
      expect(response).toHaveProperty('email', testUser.email);
    });

    it('should reject invalid token', async () => {
      await expect(
        apiClient.get('/auth/verify', {
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        })
      ).rejects.toThrow(/token|unauthorized/i);
    });

    it('should reject missing token', async () => {
      await expect(
        apiClient.get('/auth/verify')
      ).rejects.toThrow(/token|unauthorized/i);
    });
  });

  describe('Password Reset', () => {
    let testUser: any;

    beforeEach(async () => {
      const userData = createTestUser();

      testUser = await apiClient.post('/auth/register', userData);
    });

    it('should initiate password reset for valid email', async () => {
      const response = await apiClient.post('/auth/forgot-password', {
        email: testUser.email,
      });

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('message');
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      // Should not reveal whether email exists or not
      const response = await apiClient.post('/auth/forgot-password', {
        email: 'nonexistent@example.com',
      });

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('message');
    });
  });
});