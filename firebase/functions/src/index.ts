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

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development';

if (isEmulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

admin.initializeApp();

const app = express();

app.use(cors(CONFIG.CORS));

app.use(express.json({ limit: CONFIG.REQUEST.BODY_LIMIT }));

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

export const api = functions.https.onRequest(app);

// Individual function exports for better cold start performance
export const createDocumentFn = createAuthenticatedFunction(createDocument);
export const getDocumentFn = createAuthenticatedFunction(getDocument);
export const updateDocumentFn = createAuthenticatedFunction(updateDocument);
export const deleteDocumentFn = createAuthenticatedFunction(deleteDocument);
export const listDocumentsFn = createAuthenticatedFunction(listDocuments);