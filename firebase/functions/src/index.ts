import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { authenticate } from './auth/middleware';
import { CONFIG } from './config/constants';
import { createAuthenticatedFunction } from './utils/function-factory';
import { logger } from './utils/logger';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from './documents/handlers';

// Initialize Firebase Admin
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';

logger.debug('Environment check:');
logger.debug('  FUNCTIONS_EMULATOR:', process.env.FUNCTIONS_EMULATOR);
logger.debug('  NODE_ENV:', process.env.NODE_ENV);
logger.debug('  Is emulator:', isEmulator);

if (isEmulator) {
  // Running in emulator - configure to use local Auth emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  logger.debug('Configuring Firebase Admin for emulator environment');
  logger.debug('FIREBASE_AUTH_EMULATOR_HOST set to:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
} else {
  logger.info('Using production Firebase Auth');
}

admin.initializeApp();

// Create Express app
const app = express();

// Configure CORS
const corsOptions = CONFIG.CORS;

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json({ limit: CONFIG.REQUEST.BODY_LIMIT }));

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Document endpoints (all require authentication)
app.post('/createDocument', authenticate, createDocument);
app.get('/getDocument', authenticate, getDocument);
app.put('/updateDocument', authenticate, updateDocument);
app.delete('/deleteDocument', authenticate, deleteDocument);
app.get('/listDocuments', authenticate, listDocuments);

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);

// Individual function exports for better cold start performance
export const createDocumentFn = createAuthenticatedFunction(createDocument);
export const getDocumentFn = createAuthenticatedFunction(getDocument);
export const updateDocumentFn = createAuthenticatedFunction(updateDocument);
export const deleteDocumentFn = createAuthenticatedFunction(deleteDocument);
export const listDocumentsFn = createAuthenticatedFunction(listDocuments);