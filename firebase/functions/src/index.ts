import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import { authenticate } from './auth/middleware';
import { authenticateAdmin } from "./auth/middleware";
import { register } from './auth/handlers';
import { applyStandardMiddleware } from './utils/middleware';
import { logger } from './logger';
import { getEnhancedConfigResponse } from './utils/config-response';
import { sendHealthCheckResponse, ApiError } from './utils/errors';
import { APP_VERSION } from './utils/version';
import { HTTP_STATUS, SYSTEM } from './constants';
import { disableETags } from './middleware/cache-control';
import { createServerTimestamp, timestampToISO } from './utils/dateHelpers';
import {
  createExpense,
  getExpense,
  updateExpense,
  deleteExpense,
  listGroupExpenses,
  listUserExpenses,
  getExpenseHistory,
} from './expenses/handlers';
import { generateShareableLink, previewGroupByLink, joinGroupByLink } from './groups/shareHandlers';
import { getGroupBalances } from './groups/balanceHandlers';
import { getGroupMembers } from './groups/memberHandlers';
import { getCurrentPolicies, getCurrentPolicy } from './policies/public-handlers';
import {
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  listGroups,
} from './groups/handlers';
import {
  createSettlement,
  getSettlement,
  updateSettlement,
  deleteSettlement,
  listSettlements,
} from './settlements/handlers';
import { admin } from './firebase';
import {
  listPolicies,
  getPolicy,
  getPolicyVersion,
  updatePolicy,
  publishPolicy,
  createPolicy,
  deletePolicyVersion,
} from "./policies/handlers";
import {
  acceptPolicy,
  acceptMultiplePolicies,
  getUserPolicyStatus,
} from './policies/user-handlers';
import { BUILD_INFO } from './utils/build-info';
import * as fs from 'fs';
import * as path from 'path';
import { FirestoreCollections } from './shared/shared-types';

// Test emulator connections when running locally
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  // Helper function to wait for emulator with exponential backoff
  async function waitForEmulator(
    testFn: () => Promise<any>, 
    maxRetries = 5, 
    initialDelay = 1000
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await testFn();
        logger.info('Auth emulator connection successful');
        return;
      } catch (error: any) {
        if (i === maxRetries - 1) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, i);
        logger.info(`Auth emulator not ready, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Test Auth emulator connection without blocking startup
  logger.info('Testing Auth emulator connection');
  waitForEmulator(() => admin.auth().listUsers(1))
    .catch((error: any) => {
      logger.errorWithContext('Auth emulator connection failed after multiple retries', error as Error);
    });
}

// Lazy-initialize Express app
let app: express.Application | null = null;

function getApp(): express.Application {
  if (!app) {
    app = express();
    
    // Disable ETags to prevent 304 responses
    disableETags(app);
    
    // Strip /api prefix for hosting rewrites
    app.use((req, res, next) => {
      if (req.url.startsWith('/api/')) {
        req.url = req.url.substring(4);
      }
      next();
    });
    
    // Apply standard middleware stack (includes CORS and cache control)
    applyStandardMiddleware(app, { logMessage: 'Incoming request' });
    
    setupRoutes(app);
  }
  return app;
}

function setupRoutes(app: express.Application): void {

  // Enhanced health check endpoint (no auth required)
  app.get('/health', async (req: express.Request, res: express.Response) => {
  const checks: Record<string, { status: 'healthy' | 'unhealthy'; responseTime?: number; error?: string; }> = {};

  const firestoreStart = Date.now();
  const testRef = admin.firestore().collection('_health_check').doc('test');
  await testRef.set({ timestamp: createServerTimestamp() }, { merge: true });
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
    timestamp: timestampToISO(createServerTimestamp()),
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memUsage.rss / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
      external: `${Math.round(memUsage.external / SYSTEM.BYTES_PER_KB / SYSTEM.BYTES_PER_KB)} MB`,
    },
    version: APP_VERSION,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV!,
  });
});

  // Environment variables endpoint (for debugging)
  app.get('/env', (req: express.Request, res: express.Response) => {
  const uptimeSeconds = process.uptime();
  const memUsage = process.memoryUsage();
  
  // Format uptime as human readable
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  let uptimeText = '';
  if (days > 0) uptimeText += `${days}d `;
  if (hours > 0) uptimeText += `${hours}h `;
  if (minutes > 0) uptimeText += `${minutes}m `;
  uptimeText += `${seconds}s`;
  
  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  // List files in current directory
  const currentDir = process.cwd();
  let files: any[];
  
  try {
    const entries = fs.readdirSync(currentDir);
    files = entries.map(name => {
      try {
        const fullPath = path.join(currentDir, name);
        const stats = fs.statSync(fullPath);
        return {
          name,
          type: stats.isDirectory() ? 'dir' : 'file',
          size: stats.isDirectory() ? null : formatBytes(stats.size),
          modified: stats.mtime.toISOString(),
          mode: stats.mode.toString(8),
          isSymbolicLink: stats.isSymbolicLink()
        };
      } catch (err) {
        return {
          name,
          error: err instanceof Error ? err.message : 'Unable to stat'
        };
      }
    }).sort((a, b) => {
      // Sort directories first, then by name
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    files = [{
      error: err instanceof Error ? err.message : 'Unable to read directory'
    }];
  }
  
  res.json({
    env: process.env,
    build: {
      timestamp: BUILD_INFO.timestamp,
      date: BUILD_INFO.date,
      version: APP_VERSION
    },
    runtime: {
      startTime: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      uptime: uptimeSeconds,
      uptimeHuman: uptimeText.trim()
    },
    memory: {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
      arrayBuffers: formatBytes(memUsage.arrayBuffers),
      heapAvailable: formatBytes(memUsage.heapTotal - memUsage.heapUsed)
    },
    filesystem: {
      currentDirectory: currentDir,
      files
    }
  });
});

// Async error wrapper to ensure proper error handling
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Firebase configuration endpoint (public - for client initialization)
app.get('/config', asyncHandler((req: express.Request, res: express.Response) => {
  // Always use enhanced config now
  const config = getEnhancedConfigResponse();
  
  res.json(config);
}));

// CSP violation reporting endpoint
app.post('/csp-violation-report', (req: express.Request, res: express.Response) => {
  try {
    const violation = req.body;
    logger.warn('CSP violation detected', {
      violation,
      ip: req.ip,
      timestamp: timestampToISO(createServerTimestamp())
    });
    res.status(204).send();
  } catch (error) {
    logger.error('Error processing CSP violation report', { errorMessage: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public policy endpoints (no auth required)
app.get('/policies/current', asyncHandler(getCurrentPolicies));
app.get('/policies/:id/current', asyncHandler(getCurrentPolicy));

// User policy endpoints (requires auth)
app.post('/user/policies/accept', authenticate, asyncHandler(acceptPolicy));
app.post('/user/policies/accept-multiple', authenticate, asyncHandler(acceptMultiplePolicies));
app.get('/user/policies/status', authenticate, asyncHandler(getUserPolicyStatus));

// Auth endpoints (no auth required)
app.post('/register', asyncHandler(register));


// Expense endpoints (requires auth)
app.post(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(createExpense));
app.get(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(getExpense));
app.put(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(updateExpense));
app.delete(`/${FirestoreCollections.EXPENSES}`, authenticate, asyncHandler(deleteExpense));
app.get(`/${FirestoreCollections.EXPENSES}/group`, authenticate, asyncHandler(listGroupExpenses));
app.get(`/${FirestoreCollections.EXPENSES}/user`, authenticate, asyncHandler(listUserExpenses));
app.get(`/${FirestoreCollections.EXPENSES}/history`, authenticate, asyncHandler(getExpenseHistory));

// NEW Group endpoints (requires auth) - RESTful API
app.post(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(createGroup));
app.get(`/${FirestoreCollections.GROUPS}`, authenticate, asyncHandler(listGroups));

// Specific group endpoints must come BEFORE :id routes
app.get(`/${FirestoreCollections.GROUPS}/balances`, authenticate, asyncHandler(getGroupBalances));
app.post(`/${FirestoreCollections.GROUPS}/share`, authenticate, asyncHandler(generateShareableLink));
app.post(`/${FirestoreCollections.GROUPS}/preview`, authenticate, asyncHandler(previewGroupByLink));
app.post(`/${FirestoreCollections.GROUPS}/join`, authenticate, asyncHandler(joinGroupByLink));

// Parameterized routes come last
app.get(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(getGroup));
app.get(`/${FirestoreCollections.GROUPS}/:id/members`, authenticate, asyncHandler(getGroupMembers));
app.put(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(updateGroup));
app.delete(`/${FirestoreCollections.GROUPS}/:id`, authenticate, asyncHandler(deleteGroup));

// Settlement endpoints (requires auth)
app.post(`/${FirestoreCollections.SETTLEMENTS}`, authenticate, asyncHandler(createSettlement));
app.get(`/${FirestoreCollections.SETTLEMENTS}`, authenticate, asyncHandler(listSettlements));
app.get(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(getSettlement));
app.put(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(updateSettlement));
app.delete(`/${FirestoreCollections.SETTLEMENTS}/:settlementId`, authenticate, asyncHandler(deleteSettlement));


// Admin Policy endpoints (requires admin auth)
app.post(`/admin/${FirestoreCollections.POLICIES}`, authenticateAdmin, asyncHandler(createPolicy));
app.get(`/admin/${FirestoreCollections.POLICIES}`, authenticateAdmin, asyncHandler(listPolicies));
app.get(`/admin/${FirestoreCollections.POLICIES}/:id`, authenticateAdmin, asyncHandler(getPolicy));
app.get(`/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`, authenticateAdmin, asyncHandler(getPolicyVersion));
app.put(`/admin/${FirestoreCollections.POLICIES}/:id`, authenticateAdmin, asyncHandler(updatePolicy));
app.post(`/admin/${FirestoreCollections.POLICIES}/:id/publish`, authenticateAdmin, asyncHandler(publishPolicy));
app.delete(`/admin/${FirestoreCollections.POLICIES}/:id/versions/:hash`, authenticateAdmin, asyncHandler(deletePolicyVersion));
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
}

// Main API export - using Firebase Functions v2 for better performance
export const api = onRequest({
  invoker: 'public', // Allow unauthenticated access for CORS and public endpoints
  maxInstances: 10,
  timeoutSeconds: 20,
  region: 'us-central1',
  memory: '512MiB' // Optimized for API workload with authentication and database operations
}, (req, res) => {
  // Initialize app lazily on first request to avoid loading config at deploy time
  const app = getApp();
  app(req, res);
});

// Phase 1 Streaming Infrastructure: Change detection and cleanup
export { trackGroupChanges, trackExpenseChanges } from './triggers/change-tracker';
export { cleanupChanges, manualCleanupChanges } from './scheduled/cleanup';

// Phase 4 Monitoring & Analytics: Metrics collection and alerting
export { collectStreamingMetrics } from './monitoring/streaming-metrics';
