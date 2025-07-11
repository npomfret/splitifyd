import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../logger';

// Initialize Firebase Admin SDK globally for reuse across invocations
if (!admin.apps.length) {
    admin.initializeApp();
}

// Initialize Firestore client globally for reuse across invocations
const db = admin.firestore();

const recalculateGroupStats = async (groupId: string): Promise<void> => {
  const expensesCollection = db.collection('expenses');
  
  const countSnapshot = await expensesCollection
    .where('groupId', '==', groupId)
    .count()
    .get();
  
  const expenseCount = countSnapshot.data().count;
  
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
  
  await db.collection('documents').doc(groupId).update({
    'data.expenseCount': expenseCount,
    'data.lastExpenseTime': lastExpenseTime
  });
};

export const onExpenseCreateV5 = functions
  .region('us-central1')
  .runWith({ memory: '256MB' })
  .firestore
  .document('expenses/{expenseId}')
  .onCreate(async (snapshot, context) => {
    const expense = snapshot.data();
    const groupId = expense.groupId;
    const eventId = context.eventId;
    const expenseId = context.params.expenseId;
    
    if (!groupId) {
      return;
    }
    
    // Idempotency check using eventId to prevent duplicate processing
    const processingDoc = db.collection('_processing_events').doc(eventId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const processingSnapshot = await transaction.get(processingDoc);
        
        if (processingSnapshot.exists && processingSnapshot.data()?.processed === true) {
          logger.info('Event already processed, skipping', { eventId, expenseId, groupId });
          return;
        }
        
        // Mark as processing
        transaction.set(processingDoc, { 
          processed: true, 
          expenseId, 
          groupId, 
          timestamp: admin.firestore.FieldValue.serverTimestamp() 
        });
        
        // Update group stats
        transaction.update(db.collection('documents').doc(groupId), {
          'data.expenseCount': FieldValue.increment(1),
          'data.lastExpenseTime': (expense.createdAt as any).toDate().toISOString()
        });
      });
    } catch (error) {
      logger.error('Failed to update group stats on expense create', { error: error as Error, groupId, eventId });
      throw error;
    }
  });

export const onExpenseUpdateV5 = functions
  .region('us-central1')
  .runWith({ memory: '256MB' })
  .firestore
  .document('expenses/{expenseId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const eventId = context.eventId;
    const expenseId = context.params.expenseId;
    
    if (!beforeData || !afterData) {
      return;
    }
    
    // Idempotency check using eventId to prevent duplicate processing
    const processingDoc = db.collection('_processing_events').doc(eventId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const processingSnapshot = await transaction.get(processingDoc);
        
        if (processingSnapshot.exists && processingSnapshot.data()?.processed === true) {
          logger.info('Event already processed, skipping', { eventId, expenseId });
          return;
        }
        
        // Mark as processing
        transaction.set(processingDoc, { 
          processed: true, 
          expenseId,
          beforeGroupId: beforeData.groupId,
          afterGroupId: afterData.groupId,
          timestamp: admin.firestore.FieldValue.serverTimestamp() 
        });
      });
      
      // Process the update outside of the transaction to avoid timeout
      if (beforeData.groupId !== afterData.groupId) {
        if (beforeData.groupId) {
          await recalculateGroupStats(beforeData.groupId);
        }
        if (afterData.groupId) {
          await recalculateGroupStats(afterData.groupId);
        }
      } else if (afterData.groupId) {
        await recalculateGroupStats(afterData.groupId);
      }
    } catch (error) {
      logger.error('Failed to update group stats on expense update', { error: error as Error, expenseId, eventId });
      throw error;
    }
  });

export const onExpenseDeleteV5 = functions
  .region('us-central1')
  .runWith({ memory: '256MB' })
  .firestore
  .document('expenses/{expenseId}')
  .onDelete(async (snapshot, context) => {
    const expense = snapshot.data();
    const groupId = expense.groupId;
    const eventId = context.eventId;
    const expenseId = context.params.expenseId;
    
    if (!groupId) {
      return;
    }
    
    // Idempotency check using eventId to prevent duplicate processing
    const processingDoc = db.collection('_processing_events').doc(eventId);
    
    try {
      await db.runTransaction(async (transaction) => {
        const processingSnapshot = await transaction.get(processingDoc);
        
        if (processingSnapshot.exists && processingSnapshot.data()?.processed === true) {
          logger.info('Event already processed, skipping', { eventId, expenseId, groupId });
          return;
        }
        
        // Mark as processing
        transaction.set(processingDoc, { 
          processed: true, 
          expenseId, 
          groupId, 
          timestamp: admin.firestore.FieldValue.serverTimestamp() 
        });
      });
      
      // Process the deletion outside of the transaction
      await recalculateGroupStats(groupId);
    } catch (error) {
      logger.error('Failed to update group stats on expense delete', { error: error as Error, groupId, eventId });
      throw error;
    }
  });