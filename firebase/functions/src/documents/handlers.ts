import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors, sendError } from '../utils/errors';
import { CONFIG } from '../config/constants';
import {
  validateCreateDocument,
  validateUpdateDocument,
  validateDocumentId,
  sanitizeDocumentData,
  createDocumentPreview,
  Document,
} from './validation';
import { logger } from '../utils/logger';

type HandlerFunction = (req: AuthenticatedRequest, res: Response) => Promise<void>;

const withErrorHandling = (handler: HandlerFunction): HandlerFunction => 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error as Error);
    }
  };

// Direct Firestore access - no global state
const getDocumentsCollection = () => {
  return admin.firestore().collection('documents');
};

const validateUserAuth = (req: AuthenticatedRequest): string => {
  if (!req.user) {
    throw Errors.UNAUTHORIZED();
  }
  return req.user.uid;
};

const fetchUserDocument = async (documentId: string, userId: string): Promise<{ docRef: admin.firestore.DocumentReference, document: Document }> => {
  const docRef = getDocumentsCollection().doc(documentId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw Errors.NOT_FOUND('Document');
  }

  const document = doc.data() as Document;

  if (document.userId !== userId) {
    throw Errors.NOT_FOUND('Document');
  }

  return { docRef, document };
};

/**
 * Create a new document
 */
export const createDocument = withErrorHandling(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Validate request body
  const { data } = validateCreateDocument(req.body);
  
  // Sanitize document data
  const sanitizedData = sanitizeDocumentData(data);

  // Create document
  const now = new Date();
  const docRef = getDocumentsCollection().doc();
  const document: Document = {
    id: docRef.id,
    userId,
    data: sanitizedData,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(document);

  res.status(201).json({
    id: docRef.id,
    message: 'Document created successfully',
  });
});

/**
 * Get a single document by ID
 */
export const getDocument = withErrorHandling(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Validate document ID
  const documentId = validateDocumentId(req.query.id);

  // Fetch and verify document ownership
  const { docRef, document } = await fetchUserDocument(documentId, userId);

  res.json({
    id: docRef.id,
    data: document.data,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  });
});

/**
 * Update an existing document
 */
export const updateDocument = withErrorHandling(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Validate document ID
  const documentId = validateDocumentId(req.query.id);

  // Validate request body
  const { data } = validateUpdateDocument(req.body);
  
  // Sanitize document data
  const sanitizedData = sanitizeDocumentData(data);

  // Fetch and verify document ownership
  const { docRef } = await fetchUserDocument(documentId, userId);

  // Update document
  await docRef.update({
    data: sanitizedData,
    updatedAt: new Date(),
  });

  res.json({
    message: 'Document updated successfully',
  });
});

/**
 * Delete a document
 */
export const deleteDocument = withErrorHandling(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Validate document ID
  const documentId = validateDocumentId(req.query.id);

  // Fetch and verify document ownership
  const { docRef } = await fetchUserDocument(documentId, userId);

  // Delete document
  await docRef.delete();

  res.json({
    message: 'Document deleted successfully',
  });
});

/**
 * List all documents for the authenticated user with cursor-based pagination
 */
export const listDocuments = withErrorHandling(async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Parse pagination parameters
  const limit = Math.min(
    parseInt(req.query.limit as string) || CONFIG.DOCUMENT.LIST_LIMIT,
    CONFIG.DOCUMENT.LIST_LIMIT
  );
  const cursor = req.query.cursor as string;
  const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

  // Build base query
  const baseQuery = getDocumentsCollection()
    .where('userId', '==', userId)
    .orderBy('updatedAt', order)
    .limit(limit + 1); // Get one extra to check if there are more pages

  // Apply cursor if provided
  const query = cursor ? (() => {
    try {
      // Decode cursor (base64 encoded timestamp)
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      const cursorData = JSON.parse(decodedCursor);
      
      if (cursorData.updatedAt) {
        const cursorTimestamp = new Date(cursorData.updatedAt);
        return baseQuery.startAfter(cursorTimestamp);
      }
      return baseQuery;
    } catch (error) {
      logger.warn('Invalid cursor provided', {
        correlationId: req.headers['x-correlation-id'] as string,
        cursor,
        userId,
      });
      // Continue without cursor if it's invalid
      return baseQuery;
    }
  })() : baseQuery;

  const snapshot = await query.get();
  
  // Check if there are more pages
  const hasMore = snapshot.docs.length > limit;
  const documents = snapshot.docs
    .slice(0, limit) // Remove the extra document used for pagination check
    .map(doc => {
      const data = doc.data() as Document;
      return {
        id: doc.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        preview: createDocumentPreview(data.data),
      };
    });

  // Generate next cursor if there are more pages
  let nextCursor: string | undefined;
  if (hasMore && documents.length > 0) {
    const lastDoc = documents[documents.length - 1];
    const cursorData = {
      updatedAt: lastDoc.updatedAt,
      id: lastDoc.id,
    };
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  res.json({
    documents,
    count: documents.length,
    hasMore,
    nextCursor,
    pagination: {
      limit,
      order,
      totalReturned: documents.length,
    },
  });
});