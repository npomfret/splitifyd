import { Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, cleanupRateLimiter } from '../../auth/middleware';

// Mock logger
jest.mock('../../logger', () => ({
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
const mockGetUser = jest.fn();
const mockFirestoreDoc = jest.fn();
const mockFirestoreGet = jest.fn();
const mockFirestoreCollection = jest.fn();

jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
    getUser: mockGetUser
  }),
  firestore: () => ({
    collection: mockFirestoreCollection
  })
}));

// Mock sendError function
jest.mock('../../utils/errors', () => ({
  sendError: jest.fn(),
  Errors: {
    UNAUTHORIZED: () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }),
    INVALID_TOKEN: () => ({ statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token' }),
    RATE_LIMIT_EXCEEDED: () => ({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' })
  }
}));

// Get the mocked sendError function
const { sendError: mockSendError } = require('../../utils/errors');

// Mock config
jest.mock('../../config', () => ({
  getConfig: () => ({
    rateLimiting: {
      windowMs: 60000,
      maxRequests: 10,
      cleanupIntervalMs: 300000 // 5 minutes - longer interval to avoid cleanup during tests
    }
  })
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
    mockVerifyIdToken.mockClear();
    mockGetUser.mockClear();
    mockFirestoreCollection.mockClear();
    mockFirestoreDoc.mockClear();
    mockFirestoreGet.mockClear();
    
    // Setup Firestore mocks
    mockFirestoreGet.mockResolvedValue({
      data: () => ({ role: 'user' })
    });
    mockFirestoreDoc.mockReturnValue({
      get: mockFirestoreGet
    });
    mockFirestoreCollection.mockReturnValue({
      doc: mockFirestoreDoc
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up any timers to prevent Jest from hanging
    jest.clearAllTimers();
    // Clean up rate limiter
    cleanupRateLimiter();
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

      const mockUserRecord = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);
      mockGetUser.mockResolvedValue(mockUserRecord);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(mockGetUser).toHaveBeenCalledWith('user123');
      expect(mockRequest.user).toEqual({
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user'
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

    it('should reject users without required fields', async () => {
      const mockDecodedToken = {
        uid: 'user123',
        email: 'test@example.com'
      };

      const mockUserRecord = {
        uid: 'user123',
        email: 'test@example.com',
        // Missing displayName
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);
      mockGetUser.mockResolvedValue(mockUserRecord);

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

      const mockUserRecord = {
        uid: uniqueUserId,
        email: 'test@example.com',
        displayName: 'Rate Limit Test User'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);
      mockGetUser.mockResolvedValue(mockUserRecord);
      
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