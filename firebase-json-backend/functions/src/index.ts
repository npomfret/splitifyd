import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { authenticate } from './auth/middleware';
import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  listDocuments,
} from './documents/handlers';

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: true, // Allow all origins in development, configure specific origins in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);

// Individual function exports for better cold start performance (optional)
const corsMiddleware = cors(corsOptions);

export const createDocumentFn = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    authenticate(req as any, res, () => {
      createDocument(req as any, res);
    });
  });
});

export const getDocumentFn = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    authenticate(req as any, res, () => {
      getDocument(req as any, res);
    });
  });
});

export const updateDocumentFn = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    authenticate(req as any, res, () => {
      updateDocument(req as any, res);
    });
  });
});

export const deleteDocumentFn = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    authenticate(req as any, res, () => {
      deleteDocument(req as any, res);
    });
  });
});

export const listDocumentsFn = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    authenticate(req as any, res, () => {
      listDocuments(req as any, res);
    });
  });
});