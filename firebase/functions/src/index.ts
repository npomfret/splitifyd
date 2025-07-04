import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import { authenticate } from './auth/middleware';
import { login, register } from './auth/handlers';
import { applyStandardMiddleware } from './utils/middleware';
import { logger } from './logger';
import { getFirebaseConfigResponse } from './utils/config';
import { sendHealthCheckResponse } from './utils/errors';
import { APP_VERSION } from './utils/version';
import { HTTP_STATUS, SYSTEM } from './constants';
import { CONFIG } from './config';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from './documents/handlers';

// Firebase Admin initialization (emulators auto-configured in config.ts)

admin.initializeApp();

// Test emulator connections when running locally
if (!CONFIG.isProduction && process.env.FUNCTIONS_EMULATOR === 'true') {
  // Test Auth emulator connection after initialization
  setTimeout(async () => {
    try {
      logger.info('Testing Auth emulator connection');
      await admin.auth().listUsers(1);
      logger.info('Auth emulator connection successful');
    } catch (error: any) {
      logger.errorWithContext('Auth emulator connection failed', error as Error, {
        port: CONFIG.emulatorPorts.auth
      });
    }
  }, 1000);
}

const app = express();

// Strip /api prefix for hosting rewrites
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.substring(4);
  }
  next();
});

// Apply standard middleware stack (includes CORS)
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
  await admin.auth().listUsers(SYSTEM.AUTH_LIST_LIMIT);
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
      rss: `${Math.round(memUsage.rss / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      external: `${Math.round(memUsage.external / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
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


// Auth endpoints (no auth required)
app.post('/login', login);
app.post('/register', register);

// User document creation (requires auth)
app.post('/createUserDocument', authenticate, async (req: express.Request, res: express.Response) => {
  const { displayName } = req.body;
  const userId = (req as any).user.uid;
  
  if (!displayName) {
    res.status(400).json({
      error: {
        code: 'MISSING_DISPLAY_NAME',
        message: 'Display name is required'
      }
    });
    return;
  }
  
  const firestore = admin.firestore();
  await firestore.collection('users').doc(userId).set({
    email: (req as any).user.email,
    displayName,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  res.json({ success: true, message: 'User document created' });
});

app.post('/createDocument', authenticate, createDocument);
app.get('/getDocument', authenticate, getDocument);
app.put('/updateDocument', authenticate, updateDocument);
app.delete('/deleteDocument', authenticate, deleteDocument);
app.get('/listDocuments', authenticate, listDocuments);

app.use((req: express.Request, res: express.Response) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
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
  
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.headers['x-correlation-id'],
    },
  });
});

// Main API export - consolidated approach for consistent behavior
export const api = functions.https.onRequest({
  invoker: 'public' // Allow unauthenticated access for CORS and public endpoints
}, app);