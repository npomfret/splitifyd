import { Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { authenticate, AuthenticatedRequest } from '../src/auth/middleware';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: jest.fn()
  })
}));

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
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
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject requests without Authorization header', async () => {
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: undefined
        }
      });
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

      expect(mockResponse.status).toHaveBeenCalledWith(401);
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

      const verifyIdToken = admin.auth().verifyIdToken as jest.Mock;
      verifyIdToken.mockResolvedValue(mockDecodedToken);

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
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

      const verifyIdToken = admin.auth().verifyIdToken as jest.Mock;
      verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          details: undefined
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per user', async () => {
      const mockDecodedToken = {
        uid: 'user123',
        email: 'test@example.com'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const verifyIdToken = admin.auth().verifyIdToken as jest.Mock;
      verifyIdToken.mockResolvedValue(mockDecodedToken);

      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await authenticate(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );
      }

      expect(mockNext).toHaveBeenCalledTimes(10);

      // Reset mocks for the 11th request
      mockNext.mockClear();
      mockResponse.status = jest.fn().mockReturnThis();
      mockResponse.json = jest.fn();

      // 11th request should be rate limited
      await authenticate(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: undefined
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});