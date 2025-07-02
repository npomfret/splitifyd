import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { authenticate } from './auth/middleware';
import { CONFIG } from './config/constants';
import { logger, addCorrelationId } from './utils/logger';
import { validateRequestStructure, validateContentType, rateLimitByIP } from './middleware/validation';
import { createAuthenticatedFunction } from './utils/function-factory';
import { getFirebaseConfigResponse } from './utils/config';
import { APP_VERSION } from './utils/version';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from './documents/handlers';

// Environment configuration is automatically loaded via CONFIG import
admin.initializeApp();

const app = express();

app.use(cors({
  ...CONFIG.CORS,
  origin: true // Allow all origins in development for debugging
}));

// Add correlation ID to all requests for tracing
app.use(addCorrelationId);

// Apply IP-based rate limiting for all requests
app.use(rateLimitByIP);

// Validate content type for non-GET requests
app.use(validateContentType);

app.use(express.json({ limit: CONFIG.REQUEST.BODY_LIMIT }));

// Validate request structure and prevent malicious payloads
app.use(validateRequestStructure);

// Request logging middleware with structured logging
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.request(req, 'Incoming request', {
    userAgent: req.headers['user-agent'],
    contentLength: req.headers['content-length'],
  });
  
  // Log response when request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      correlationId: req.headers['x-correlation-id'] as string,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  
  next();
});

// Enhanced health check endpoint (no auth required)
app.get('/health', async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const health: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    environment: process.env.NODE_ENV || 'development',
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
    // Test Firebase Auth (just verify we can access it)
    const authStart = Date.now();
    await admin.auth().listUsers(1);
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

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Detailed status endpoint for monitoring systems
app.get('/status', async (req: express.Request, res: express.Response) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    },
    version: APP_VERSION,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Firebase configuration endpoint (public - for client initialization)
app.get('/config', (req: express.Request, res: express.Response) => {
  getFirebaseConfigResponse(res);
});

app.post('/createDocument', authenticate, createDocument);
app.get('/getDocument', authenticate, getDocument);
app.put('/updateDocument', authenticate, updateDocument);
app.delete('/deleteDocument', authenticate, deleteDocument);
app.get('/listDocuments', authenticate, listDocuments);

app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.errorWithContext('Unhandled error occurred', err, {
    correlationId: req.headers['x-correlation-id'] as string,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.headers['x-correlation-id'],
    },
  });
});

// Main API export - consolidated approach for consistent behavior
export const api = functions.https.onRequest(app);

// Individual function exports for backward compatibility with existing frontend
// These provide the same security and validation as the main API
export const createDocumentFn = createAuthenticatedFunction(createDocument);
export const getDocumentFn = createAuthenticatedFunction(getDocument);
export const updateDocumentFn = createAuthenticatedFunction(updateDocument);
export const deleteDocumentFn = createAuthenticatedFunction(deleteDocument);
export const listDocumentsFn = createAuthenticatedFunction(listDocuments);

// Public endpoint for Firebase configuration (no auth required)
export const configFn = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  getFirebaseConfigResponse(res);
});