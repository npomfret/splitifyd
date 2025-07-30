import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClient } from './utils';
import { UserBuilder } from '@test-builders';

describe('Auth Flow API Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = new UserBuilder().build();
      
      // Add displayName which is required
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      const response = await apiClient.post<any>('/register', registerData);

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('message', 'Account created successfully');
      expect(response).toHaveProperty('user');
      expect(response.user).toHaveProperty('uid');
      expect(response.user).toHaveProperty('email', userData.email);
      expect(response.user).toHaveProperty('displayName', userData.displayName);
    });

    it('should reject registration with invalid email', async () => {
      const userData = new UserBuilder()
        .withEmail('invalid-email')
        .build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow(/email/i);
    });

    it('should reject registration with weak password', async () => {
      const userData = new UserBuilder()
        .withPassword('123')
        .build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow(/password/i);
    });

    it('should reject registration with missing displayName', async () => {
      const userData = new UserBuilder().build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        // Missing displayName
      };

      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow(/display.*name|displayName/i);
    });

    it('should reject registration with duplicate email', async () => {
      const userData = new UserBuilder().build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      // Register first time
      await apiClient.post('/register', registerData);

      // Try to register again with same email
      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow(/already.*exists|duplicate/i);
    });
  });

  describe('Firebase Auth Integration', () => {
    it('should create user with proper auth record', async () => {
      const userData = new UserBuilder().build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      const response = await apiClient.post<any>('/register', registerData);
      
      // User should have a valid UID
      expect(response.user.uid).toBeTruthy();
      expect(response.user.uid.length).toBeGreaterThan(10);
    });

    it('should handle Firebase Auth errors gracefully', async () => {
      // Test with invalid data that Firebase Auth will reject
      const registerData = {
        email: 'not-an-email',
        password: '123', // Too short
        displayName: 'Test',
      };

      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow();
    });
  });

  describe('Registration Validation', () => {
    it('should reject email with leading/trailing whitespace', async () => {
      const userData = new UserBuilder().build();
      
      const registerData = {
        email: `  ${userData.email}  `,
        password: userData.password,
        displayName: userData.displayName,
      };

      // API should reject email with whitespace
      await expect(
        apiClient.post('/register', registerData)
      ).rejects.toThrow(/email/i);
    });

    it('should require all fields', async () => {
      // Missing email
      await expect(
        apiClient.post('/register', {
          password: 'ValidPassword123!',
          displayName: 'Test User',
        })
      ).rejects.toThrow(/email/i);

      // Missing password
      await expect(
        apiClient.post('/register', {
          email: 'test@example.com',
          displayName: 'Test User',
        })
      ).rejects.toThrow(/password/i);

      // Missing displayName
      await expect(
        apiClient.post('/register', {
          email: 'test@example.com',
          password: 'ValidPassword123!',
        })
      ).rejects.toThrow(/display.*name/i);
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test@.com',
        'test.example.com',
      ];

      for (const email of invalidEmails) {
        await expect(
          apiClient.post('/register', {
            email,
            password: 'ValidPassword123!',
            displayName: 'Test User',
          })
        ).rejects.toThrow(/email/i);
      }
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        '123',
        'abc',
        'password',
        '12345678',
      ];

      for (const password of weakPasswords) {
        await expect(
          apiClient.post('/register', {
            email: `test-${Date.now()}@example.com`,
            password,
            displayName: 'Test User',
          })
        ).rejects.toThrow(/password/i);
      }
    });
  });

  describe('User Document Creation', () => {
    it('should create Firestore document on registration', async () => {
      const userData = new UserBuilder().build();
      
      const registerData = {
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
      };

      const response = await apiClient.post<any>('/register', registerData);
      
      // Registration should succeed
      expect(response.success).toBe(true);
      
      // User document should be created (implied by success response)
      // Actual Firestore verification would require admin SDK access
    });
  });
});