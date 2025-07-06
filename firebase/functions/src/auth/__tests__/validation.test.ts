import { validateLoginRequest, validateRegisterRequest } from '../validation';
import { ApiError } from '../../utils/errors';

describe('Auth Validation', () => {
  describe('validateLoginRequest', () => {
    it('should validate valid login request', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };
      
      const result = validateLoginRequest(validRequest);
      
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('TestPass123!');
    });

    it('should normalize email to lowercase', () => {
      const request = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPass123!'
      };
      
      const result = validateLoginRequest(request);
      
      expect(result.email).toBe('test@example.com');
    });

    it('should throw error for missing email', () => {
      const request = {
        password: 'TestPass123!'
      };
      
      expect(() => validateLoginRequest(request)).toThrow(ApiError);
      expect(() => validateLoginRequest(request)).toThrow('Email is required');
    });

    it('should throw error for invalid email format', () => {
      const request = {
        email: 'invalid-email',
        password: 'TestPass123!'
      };
      
      expect(() => validateLoginRequest(request)).toThrow(ApiError);
      expect(() => validateLoginRequest(request)).toThrow('Invalid email format');
    });

    it('should throw error for missing password', () => {
      const request = {
        email: 'test@example.com'
      };
      
      expect(() => validateLoginRequest(request)).toThrow(ApiError);
      expect(() => validateLoginRequest(request)).toThrow('Password is required');
    });

    it('should throw error for password too short', () => {
      const request = {
        email: 'test@example.com',
        password: 'short'
      };
      
      expect(() => validateLoginRequest(request)).toThrow(ApiError);
      expect(() => validateLoginRequest(request)).toThrow('Password must be at least 8 characters');
    });
  });

  describe('validateRegisterRequest', () => {
    it('should validate valid register request', () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test User'
      };
      
      const result = validateRegisterRequest(validRequest);
      
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('TestPass123!');
      expect(result.displayName).toBe('Test User');
    });

    it('should normalize email to lowercase and trim display name', () => {
      const request = {
        email: 'TEST@EXAMPLE.COM',
        password: 'TestPass123!',
        displayName: '  Test User  '
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
    });

    it('should throw error for weak password', () => {
      const request = {
        email: 'test@example.com',
        password: 'weakpass',
        displayName: 'Test User'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Password must contain at least 8 characters');
    });

    it('should throw error for missing display name', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name is required');
    });

    it('should throw error for display name too short', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'A'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name must be at least 2 characters');
    });

    it('should throw error for display name too long', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'A'.repeat(51)
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name cannot exceed 50 characters');
    });

    it('should throw error for invalid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'Test<script>alert("xss")</script>'
      };
      
      expect(() => validateRegisterRequest(request)).toThrow(ApiError);
      expect(() => validateRegisterRequest(request)).toThrow('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
    });

    it('should accept valid display name characters', () => {
      const request = {
        email: 'test@example.com',
        password: 'TestPass123!',
        displayName: 'John Doe-Smith_123.Jr'
      };
      
      const result = validateRegisterRequest(request);
      
      expect(result.displayName).toBe('John Doe-Smith_123.Jr');
    });
  });
});