import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import express from 'express';
import { authenticate } from './auth/middleware';
import { register } from './auth/handlers';
import { applyStandardMiddleware } from './utils/middleware';
import { logger } from './logger';
import { getFirebaseConfigResponse } from './utils/config';
import { sendHealthCheckResponse, ApiError } from './utils/errors';
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
import {
  createExpense,
  getExpense,
  updateExpense,
  deleteExpense,
  listGroupExpenses,
  listUserExpenses,
} from './expenses/handlers';
import { createUserDocument } from './users/handlers';
import { onExpenseCreateV5, onExpenseUpdateV5, onExpenseDeleteV5 } from './triggers/expenseAggregation';
import { onExpenseWrite } from './triggers/balanceAggregation';
import { generateShareableLink, joinGroupByLink } from './groups/shareHandlers';
import { getGroupBalances } from './groups/balanceHandlers';

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

// Async error wrapper to ensure proper error handling
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Firebase configuration endpoint (public - for client initialization)
app.get('/config', asyncHandler((req: express.Request, res: express.Response) => {
  const config = getFirebaseConfigResponse();
  res.json(config);
}));

// CSP violation reporting endpoint
app.post('/csp-violation-report', (req: express.Request, res: express.Response) => {
  try {
    const violation = req.body;
    logger.warn('CSP violation detected', {
      violation,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    res.status(204).send();
  } catch (error) {
    logger.error('Error processing CSP violation report', { errorMessage: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auth endpoints (no auth required)
app.post('/register', asyncHandler(register));

// User document creation (requires auth)
app.post('/createUserDocument', authenticate, asyncHandler(createUserDocument));

app.post('/createDocument', authenticate, asyncHandler(createDocument));
app.get('/getDocument', authenticate, asyncHandler(getDocument));
app.put('/updateDocument', authenticate, asyncHandler(updateDocument));
app.delete('/deleteDocument', authenticate, asyncHandler(deleteDocument));
app.get('/listDocuments', authenticate, asyncHandler(listDocuments));

// Expense endpoints (requires auth)
app.post('/expenses', authenticate, asyncHandler(createExpense));
app.get('/expenses', authenticate, asyncHandler(getExpense));
app.put('/expenses', authenticate, asyncHandler(updateExpense));
app.delete('/expenses', authenticate, asyncHandler(deleteExpense));
app.get('/expenses/group', authenticate, asyncHandler(listGroupExpenses));
app.get('/expenses/user', authenticate, asyncHandler(listUserExpenses));

// Group sharing endpoints (requires auth)
app.post('/groups/share', authenticate, asyncHandler(generateShareableLink));
app.post('/groups/join', authenticate, asyncHandler(joinGroupByLink));

// Group balance endpoint (requires auth)
app.get('/groups/balances', authenticate, asyncHandler(getGroupBalances));

app.use((req: express.Request, res: express.Response) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Check if response was already sent
  if (res.headersSent) {
    return next(err);
  }
  
  const correlationId = req.headers['x-correlation-id'] as string;
  
  // Handle ApiError objects properly
  if (err instanceof ApiError) {
    logger.errorWithContext('API error occurred', err, {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: err.statusCode,
      errorCode: err.code,
    });
    
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        correlationId,
      },
    });
    return;
  }
  
  // Handle unexpected errors
  logger.errorWithContext('Unhandled error occurred', err, {
    correlationId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  });
  
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId,
    },
  });
});

// Main API export - using Firebase Functions v2 for better performance
export const api = onRequest({
  invoker: 'public', // Allow unauthenticated access for CORS and public endpoints
  maxInstances: 100,
  timeoutSeconds: 540, // 9 minutes
  region: 'us-central1',
  memory: '512MiB' // Optimized for API workload with authentication and database operations
}, app);

// Export Firestore triggers
export { onExpenseCreateV5, onExpenseUpdateV5, onExpenseDeleteV5, onExpenseWrite };