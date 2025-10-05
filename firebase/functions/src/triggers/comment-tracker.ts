import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from '../logger';
import { measureTrigger } from '../monitoring/measure';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

import { FirestoreCollections } from "../constants";

const firestore = getFirestore();
const appBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const firestoreReader = appBuilder.buildFirestoreReader();
const notificationService = appBuilder.buildNotificationService();

// Track group comment changes
export const trackGroupCommentChanges = onDocumentWritten(
  { document: `${FirestoreCollections.GROUPS}/{groupId}/comments/{commentId}` },
  async (event) => {
    const groupId = event.params.groupId;
    const commentId = event.params.commentId;

    return measureTrigger('trackGroupCommentChanges', async () => {
      const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);

      if (affectedUsers.length > 0) {
        await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');
      }

      logger.info('group-comment-changed', { id: commentId, groupId, usersNotified: affectedUsers.length });
    });
  }
);

// Track expense comment changes
export const trackExpenseCommentChanges = onDocumentWritten(
  { document: `${FirestoreCollections.EXPENSES}/{expenseId}/comments/{commentId}` },
  async (event) => {
    const expenseId = event.params.expenseId;
    const commentId = event.params.commentId;

    return measureTrigger('trackExpenseCommentChanges', async () => {
      const expense = await firestoreReader.getExpense(expenseId);
      const groupId = expense?.groupId;

      if (!groupId) {
        throw Error(`groupId missing from expense ${expenseId}`);
      }

      const affectedUsers = await firestoreReader.getAllGroupMemberIds(groupId);
      await notificationService.batchUpdateNotifications(affectedUsers, groupId, 'comment');

      logger.info('expense-comment-changed', { id: commentId, expenseId, groupId, usersNotified: affectedUsers.length });
    });
  }
);
