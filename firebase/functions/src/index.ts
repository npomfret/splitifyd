import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import { authenticate } from './auth/middleware';
import { applyStandardMiddleware } from './utils/middleware';
import { logger } from './utils/logger';
import { createAuthenticatedFunction } from './utils/function-factory';
import { getFirebaseConfigResponse } from './utils/config';
import { sendHealthCheckResponse } from './utils/errors';
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

// Apply standard middleware stack
applyStandardMiddleware(app, { logMessage: 'Incoming request' });

// Enhanced health check endpoint (no auth required)
app.get('/health', async (req: express.Request, res: express.Response) => {
  const checks: Record<string, { status: 'healthy' | 'unhealthy'; responseTime?: number; error?: string; }> = {};

  const firestoreStart = Date.now();
  const testRef = admin.firestore().collection('_health_check').doc('test');
  await testRef.set({ timestamp: new Date() }, { merge: true });
  await testRef.get();
  checks.firestore = {
    status: 'healthy',
    responseTime: Date.now() - firestoreStart,
  };

  const authStart = Date.now();
  await admin.auth().listUsers(1);
  checks.auth = {
    status: 'healthy',
    responseTime: Date.now() - authStart,
  };

  sendHealthCheckResponse(res, checks);
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