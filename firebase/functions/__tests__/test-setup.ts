import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { CONFIG } from '../src/config';
import { authenticate } from '../src/auth/middleware';
import { HTTP_STATUS, PORTS, SYSTEM, TEST_CONFIG } from '../src/constants';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from '../src/documents/handlers';

// Test configuration
const testConfig = {
  cors: {
    origin: [`http://localhost:${PORTS.LOCAL_3000}`, `http://localhost:${PORTS.LOCAL_5000}`],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    optionsSuccessStatus: HTTP_STATUS.OK,
  },
};

let isInitialized = false;

export async function setupTestApp(): Promise<express.Application> {
  if (!isInitialized) {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    isInitialized = true;
  }

  const app = express();

  // Apply middleware in the same order as production
  app.use(cors(testConfig.cors));
  
  // Add correlation ID middleware
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const correlationId = req.headers['x-correlation-id'] as string || `test-${Date.now()}`;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  });
  
  app.use(express.json({ limit: CONFIG.requestBodyLimit }));

  // Enhanced health check endpoint
  app.get('/health', async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'test',
      checks: {
        firestore: { status: 'unknown' },
        auth: { status: 'unknown' },
      },
    };

    try {
      // Test Firestore connection
      const firestoreStart = Date.now();
      const testRef = admin.firestore().collection('_health_check').doc('test');
      await testRef.set({ timestamp: new Date() }, { merge: true });
      await testRef.get();
      health.checks.firestore = {
        status: 'healthy',
        responseTime: Date.now() - firestoreStart,
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.firestore = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    try {
      // Test Firebase Auth
      const authStart = Date.now();
      await admin.auth().listUsers(SYSTEM.AUTH_LIST_LIMIT);
      health.checks.auth = {
        status: 'healthy',
        responseTime: Date.now() - authStart,
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.auth = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    health.totalResponseTime = Date.now() - startTime;
    const statusCode = health.status === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(health);
  });

  // Status endpoint
  app.get('/status', (req: express.Request, res: express.Response) => {
    const memUsage = process.memoryUsage();
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: `${Math.round(memUsage.rss / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
        external: `${Math.round(memUsage.external / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      },
      version: '1.0.0',
      nodeVersion: process.version,
      environment: 'test',
    });
  });

  // Document endpoints
  app.post('/createDocument', authenticate, createDocument);
  app.get('/getDocument', authenticate, getDocument);
  app.put('/updateDocument', authenticate, updateDocument);
  app.delete('/deleteDocument', authenticate, deleteDocument);
  app.get('/listDocuments', authenticate, listDocuments);

  // 404 handler
  app.use((req: express.Request, res: express.Response) => {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        correlationId: req.headers['x-correlation-id'],
      },
    });
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Test app error:', err);
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        correlationId: req.headers['x-correlation-id'],
      },
    });
  });

  return app;
}

// Cleanup function for tests
export async function cleanupTestData(): Promise<void> {
  // No cleanup needed for mocked tests
  jest.clearAllMocks();
}

// Setup for Jest
beforeAll(async () => {
  // Tests use mocks, no emulators needed
}, TEST_CONFIG.SETUP_TIMEOUT_MS);

afterAll(async () => {
  await cleanupTestData();
});

// Global test timeout
jest.setTimeout(TEST_CONFIG.JEST_TIMEOUT_MS);