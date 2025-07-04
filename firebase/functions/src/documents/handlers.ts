import { Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { CONFIG } from '../config';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import {
  validateCreateDocument,
  validateUpdateDocument,
  validateDocumentId,
  sanitizeDocumentData,
  Document,
} from './validation';


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
export const createDocument = async (
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

  res.status(HTTP_STATUS.CREATED).json({
    id: docRef.id,
    message: 'Document created successfully',
  });
};

/**
 * Get a single document by ID
 */
export const getDocument = async (
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
    createdAt: (document.createdAt as any).toDate().toISOString(),
    updatedAt: (document.updatedAt as any).toDate().toISOString(),
  });
};

/**
 * Update an existing document
 */
export const updateDocument = async (
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
};

/**
 * Delete a document
 */
export const deleteDocument = async (
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
};

/**
 * List all documents for the authenticated user with cursor-based pagination
 */
export const listDocuments = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = validateUserAuth(req);

  // Parse pagination parameters
  const limit = Math.min(
    parseInt(req.query.limit as string) || CONFIG.document.listLimit,
    CONFIG.document.listLimit
  );
  const cursor = req.query.cursor as string;
  const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

  // Build base query
  const baseQuery = getDocumentsCollection()
    .where('userId', '==', userId)
    .orderBy('updatedAt', order)
    .limit(limit + DOCUMENT_CONFIG.PAGINATION_EXTRA_ITEM); // Get one extra to check if there are more pages

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
      throw new functions.https.HttpsError('invalid-argument', 'Invalid cursor format');
    }
  })() : baseQuery;

  const snapshot = await query.get();
  
  // Check if there are more pages
  const hasMore = snapshot.docs.length > limit;
  const documents = await Promise.all(
    snapshot.docs
      .slice(0, limit) // Remove the extra document used for pagination check
      .map(async (doc) => {
        const data = doc.data() as Document;
        const documentData = {
          id: doc.id,
          data: data.data,
          createdAt: (data.createdAt as any).toDate().toISOString(),
          updatedAt: (data.updatedAt as any).toDate().toISOString(),
        };

        // If this is a group document (has name property), get expense statistics
        if (data.data && data.data.name) {
          const expenseStats = await getGroupExpenseStats(doc.id);
          documentData.data.expenseCount = expenseStats.expenseCount;
          documentData.data.lastExpenseTime = expenseStats.lastExpenseTime;
        }

        return documentData;
      })
  );

  // Generate next cursor if there are more pages
  let nextCursor: string | undefined;
  if (hasMore && documents.length > 0) {
    const lastDoc = snapshot.docs[limit - 1];
    const lastDocData = lastDoc.data() as Document;
    const cursorData = {
      updatedAt: (lastDocData.updatedAt as any).toDate().toISOString(),
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
};

const getGroupExpenseStats = async (groupId: string): Promise<{ expenseCount: number; lastExpenseTime: string | null }> => {
  const expensesCollection = admin.firestore().collection('expenses');
  
  // Get expense count
  const countSnapshot = await expensesCollection
    .where('groupId', '==', groupId)
    .count()
    .get();
  
  const expenseCount = countSnapshot.data().count;
  
  // Get last expense time
  let lastExpenseTime: string | null = null;
  if (expenseCount > 0) {
    const lastExpenseSnapshot = await expensesCollection
      .where('groupId', '==', groupId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!lastExpenseSnapshot.empty) {
      const lastExpenseData = lastExpenseSnapshot.docs[0].data();
      lastExpenseTime = (lastExpenseData.createdAt as any).toDate().toISOString();
    }
  }
  
  return { expenseCount, lastExpenseTime };
};