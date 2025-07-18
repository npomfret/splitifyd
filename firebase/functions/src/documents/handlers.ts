import { Response } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { Errors } from '../utils/errors';
import { getConfig } from '../config';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import {
  validateCreateDocument,
  validateUpdateDocument,
  validateDocumentId,
  sanitizeDocumentData,
  Document,
} from './validation';
import { buildPaginatedQuery, encodeCursor, CursorData } from '../utils/pagination';
import { transformDocumentForApi, addGroupBalanceToDocument } from './transformers';


// Direct Firestore access - no global state
const getDocumentsCollection = () => {
  return admin.firestore().collection('documents');
};


const fetchUserDocument = async (
  documentId: string, 
  userId: string,
  requireWriteAccess: boolean = false
): Promise<{ docRef: admin.firestore.DocumentReference, document: Document }> => {
  const docRef = getDocumentsCollection().doc(documentId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw Errors.NOT_FOUND('Document');
  }

  const document = doc.data() as Document;

  // Check if user owns the document
  if (document.userId === userId) {
    return { docRef, document };
  }

  // For write operations, only the owner is allowed
  if (requireWriteAccess) {
    throw Errors.FORBIDDEN();
  }

  // For read operations on group documents, check if user is a member
  if (document.data?.members && Array.isArray(document.data.members)) {
    const isMember = document.data.members.some((member: { uid: string }) => 
      member.uid === userId
    );
    if (isMember) {
      return { docRef, document };
    }
  }

  // User doesn't have access to this document
  throw Errors.NOT_FOUND('Document');
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

  // Initialize memberIds for group documents
  if (sanitizedData.name) {
    sanitizedData.memberIds = [userId];
    if (sanitizedData.members && Array.isArray(sanitizedData.members)) {
      sanitizedData.members.forEach((member: { uid: string }) => {
        if (member.uid && !sanitizedData.memberIds.includes(member.uid)) {
          sanitizedData.memberIds.push(member.uid);
        }
      });
    }
  }

  // Create document
  const now = new Date();
  const docRef = getDocumentsCollection().doc();
  const document: Document = {
    id: docRef.id,
    userId,
    data: sanitizedData,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
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

  const createdAt = (document.createdAt as admin.firestore.Timestamp).toDate().toISOString();
  const updatedAt = (document.updatedAt as admin.firestore.Timestamp).toDate().toISOString();

  res.json({
    id: docRef.id,
    data: document.data,
    createdAt,
    updatedAt,
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

  // SECURITY FIX: Prevent direct manipulation of group membership
  if (sanitizedData.members || sanitizedData.memberIds || sanitizedData.memberEmails) {
    throw Errors.INVALID_INPUT('Group membership cannot be modified through updateDocument. Use proper group management endpoints instead.');
  }

  // Fetch and verify document ownership with write access required
  const { docRef } = await fetchUserDocument(documentId, userId, true);

  // Update document
  await docRef.update({
    data: sanitizedData,
    updatedAt: Timestamp.now(),
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

  // Fetch and verify document ownership with write access required
  const { docRef } = await fetchUserDocument(documentId, userId, true);

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
  const config = getConfig();
  const limit = Math.min(
    parseInt(req.query.limit as string) || config.document.listLimit,
    config.document.listLimit
  );
  const cursor = req.query.cursor as string;
  const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

  // Build base query
  const baseQuery = getDocumentsCollection()
    .where('data.memberIds', 'array-contains', userId)
    .select('data', 'createdAt', 'updatedAt');

  // Apply pagination
  const query = buildPaginatedQuery(
    baseQuery,
    cursor,
    order,
    limit + DOCUMENT_CONFIG.PAGINATION_EXTRA_ITEM // Get one extra to check if there are more pages
  );

  const snapshot = await query.get();
  
  // Check if there are more pages
  const hasMore = snapshot.docs.length > limit;
  const documents = await Promise.all(
    snapshot.docs
      .slice(0, limit) // Remove the extra document used for pagination check
      .map(async (doc) => {
        const data = doc.data() as Document;
        let documentData = transformDocumentForApi(doc, data);
        
        // Add balance information for group documents
        documentData = await addGroupBalanceToDocument(documentData, data, userId);
        
        return documentData;
      })
  );

  // Generate next cursor if there are more pages
  let nextCursor: string | undefined;
  if (hasMore && documents.length > 0) {
    const lastDoc = snapshot.docs[limit - 1];
    const lastDocData = lastDoc.data() as Document;
    const cursorData: CursorData = {
      updatedAt: (lastDocData.updatedAt as admin.firestore.Timestamp).toDate().toISOString(),
      id: lastDoc.id,
    };
    nextCursor = encodeCursor(cursorData);
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