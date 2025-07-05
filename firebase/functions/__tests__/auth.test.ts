import { Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../src/auth/middleware';

// Mock logger
jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    errorWithContext: jest.fn()
  }
}));

// Mock Firebase Admin
const mockVerifyIdToken = jest.fn();
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken
  })
}));

// Mock sendError function
jest.mock('../src/utils/errors', () => ({
  sendError: jest.fn(),
  Errors: {
    UNAUTHORIZED: () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }),
    INVALID_TOKEN: () => ({ statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token' }),
    RATE_LIMIT_EXCEEDED: () => ({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' })
  }
}));

// Get the mocked sendError function
const { sendError: mockSendError } = require('../src/utils/errors');

// Mock config
jest.mock('../src/config', () => ({
  CONFIG: {
    rateLimiting: {
      windowMs: 60000,
      maxRequests: 10,
      cleanupIntervalMs: 300000 // 5 minutes - longer interval to avoid cleanup during tests
    }
  }
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      headers: {},
      ip: '127.0.0.1'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    
    // Reset mocks
    mockSendError.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should allow OPTIONS requests without authentication', async () => {
      mockRequest.method = 'OPTIONS';
      
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should reject requests without Authorization header', async () => {
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }),
        undefined
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid Authorization header format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token123'
      };

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }),
        undefined
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should verify valid tokens and attach user to request', async () => {
      const mockDecodedToken = {
        uid: 'user123',
        email: 'test@example.com'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(mockRequest.user).toEqual({
        uid: 'user123',
        email: 'test@example.com'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid tokens', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          statusCode: 401,
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }),
        undefined
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per user', async () => {
      // Use a unique user ID to avoid interference from other tests
      const uniqueUserId = `ratelimit-test-${Date.now()}`;
      const mockDecodedToken = {
        uid: uniqueUserId,
        email: 'test@example.com'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);
      
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await authenticate(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );
      }

      expect(mockNext).toHaveBeenCalledTimes(10);
      expect(mockSendError).not.toHaveBeenCalled();

      // Reset mocks for the 11th request
      mockNext.mockClear();
      mockSendError.mockClear();
      
      // 11th request should be rate limited
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        }),
        undefined
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});