import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient } from './utils';

describe('Auth Flow API Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
      };

      const response = await apiClient.post('/auth/register', userData);

      expect(response).toHaveProperty('uid');
      expect(response).toHaveProperty('email', userData.email);
      expect(response).toHaveProperty('name', userData.name);
      expect(response).not.toHaveProperty('password');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
        name: 'Test User',
      };

      await expect(
        apiClient.post('/auth/register', userData)
      ).rejects.toThrow(/email/i);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: '123',
        name: 'Test User',
      };

      await expect(
        apiClient.post('/auth/register', userData)
      ).rejects.toThrow(/password/i);
    });
  });

  describe('User Login', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create a test user for login tests
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
      };

      testUser = await apiClient.post('/auth/register', userData);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'TestPassword123!',
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
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      };

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
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
      };

      testUser = await apiClient.post('/auth/register', userData);
      
      const loginResponse = await apiClient.post('/auth/login', {
        email: testUser.email,
        password: 'TestPassword123!',
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
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
      };

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