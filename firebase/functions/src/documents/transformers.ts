import * as admin from 'firebase-admin';
import { Document } from './validation';
import { calculateGroupBalances } from '../services/balanceCalculator';

export interface ApiDocument {
  id: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

export function transformDocumentForApi(
  doc: admin.firestore.DocumentSnapshot,
  docData: Document
): ApiDocument {
  // Validate timestamps are Firestore Timestamps
  if (!docData.createdAt || typeof docData.createdAt !== 'object' || !('_seconds' in docData.createdAt)) {
    throw new Error(`Expected createdAt to be Firestore Timestamp, got ${typeof docData.createdAt} with value: ${JSON.stringify(docData.createdAt)}`);
  }
  if (!docData.updatedAt || typeof docData.updatedAt !== 'object' || !('_seconds' in docData.updatedAt)) {
    throw new Error(`Expected updatedAt to be Firestore Timestamp, got ${typeof docData.updatedAt} with value: ${JSON.stringify(docData.updatedAt)}`);
  }

  return {
    id: doc.id,
    data: docData.data,
    createdAt: (docData.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
    updatedAt: (docData.updatedAt as admin.firestore.Timestamp).toDate().toISOString(),
  };
}

export async function addGroupBalanceToDocument(
  document: ApiDocument,
  documentData: Document,
  userId: string
): Promise<ApiDocument> {
  // Only process group documents
  if (!documentData.data?.name || !documentData.data?.members) {
    return document;
  }

  try {
    // Check for cached balance first
    const balanceDoc = await admin.firestore()
      .collection('group-balances')
      .doc(document.id)
      .get();
    
    if (balanceDoc.exists) {
      const balanceData = balanceDoc.data()!;
      const userBalanceData = balanceData.userBalances?.[userId];
      document.data.yourBalance = userBalanceData?.netBalance || 0;
    } else {
      // Calculate and cache balance if not found
      const balances = await calculateGroupBalances(document.id);
      const userBalanceData = balances.userBalances[userId];
      document.data.yourBalance = userBalanceData?.netBalance || 0;
      
      // Cache the calculated balance for future requests
      await admin.firestore()
        .collection('group-balances')
        .doc(document.id)
        .set(balances);
    }
  } catch (error) {
    // If balance calculation fails (e.g., no members), default to 0
    document.data.yourBalance = 0;
  }

  return document;
}