import request from 'supertest';
import express from 'express';
import { setupTestApp, cleanupTestData } from '../test-setup';

// Mock logger to prevent console errors in tests
jest.mock('../../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    errorWithContext: jest.fn()
  }
}));

// Mock Firebase Admin completely for integration tests
const mockVerifyIdToken = jest.fn();
const mockListUsers = jest.fn();
const mockFirestoreDoc = jest.fn();
const mockFirestoreSet = jest.fn();
const mockFirestoreGet = jest.fn();

jest.mock('firebase-admin', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
    listUsers: mockListUsers
  }),
  firestore: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        mockFirestoreDoc(name, id);
        return {
          set: mockFirestoreSet,
          get: mockFirestoreGet
        };
      }
    })
  }),
  apps: [],
  initializeApp: jest.fn()
}));

// Mock sendError to prevent actual error responses
jest.mock('../../src/utils/errors', () => ({
  sendError: jest.fn((res, error, correlationId) => {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        correlationId
      }
    });
  }),
  Errors: {
    UNAUTHORIZED: () => ({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }),
    INVALID_TOKEN: () => ({ statusCode: 401, code: 'INVALID_TOKEN', message: 'Invalid authentication token' }),
    RATE_LIMIT_EXCEEDED: () => ({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' })
  }
}));

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await setupTestApp();
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
    mockListUsers.mockResolvedValue({ users: [] });
    mockFirestoreGet.mockResolvedValue({ exists: true });
    mockFirestoreSet.mockResolvedValue({});
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Health Check Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|unhealthy/),
        timestamp: expect.any(String),
        version: '1.0.0',
        checks: expect.any(Object)
      });
    });

    it('GET /status should return system status', async () => {
      const response = await request(app)
        .get('/status')
        .expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          rss: expect.any(String),
          heapUsed: expect.any(String)
        },
        version: '1.0.0',
        nodeVersion: expect.any(String)
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .post('/createDocument')
        .send({ data: { test: 'data' } })
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    });

    it('should reject requests with invalid authorization header', async () => {
      const response = await request(app)
        .post('/createDocument')
        .set('Authorization', 'Bearer invalid-token')
        .send({ data: { test: 'data' } })
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      });
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should include correlation ID in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found'
        }
      });
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(app)
        .post('/createDocument')
        .set('Authorization', 'Bearer invalid-token')
        .send({ data: { test: 'data' } })
        .expect(401);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body.error.correlationId).toBeDefined();
    });
  });
});