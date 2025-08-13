/**
 * Change detection triggers for real-time notifications
 * Phase 1 of streaming implementation
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin } from '../firebase';
import { logger } from '../logger';

// Type definitions
export interface ChangeNotification {
  groupId?: string;
  expenseId?: string;
  timestamp: number;
  type: 'created' | 'modified' | 'deleted';
  userId?: string;
  fields: string[];
  metadata: {
    priority: 'high' | 'medium' | 'low';
    affectedUsers: string[];
  };
}

/**
 * Track changes to groups collection and emit change notifications
 */
export const trackGroupChanges = onDocumentWritten(
  {
    document: 'groups/{groupId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    const { groupId } = event.params;
    const change = event.data;
    
    if (!change) {
      return;
    }
    
    try {
      await processGroupChange(groupId, change);
    } catch (error: any) {
      logger.error('Error in trackGroupChanges', { error: error as Error, groupId });
    }
  }
);

/**
 * Track changes to expenses collection and emit change notifications
 */
export const trackExpenseChanges = onDocumentWritten(
  {
    document: 'expenses/{expenseId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    const { expenseId } = event.params;
    const change = event.data;
    
    if (!change) {
      return;
    }
    
    try {
      const expenseData = change.after?.data() || change.before?.data();
      const groupId = expenseData?.groupId;
      
      if (!groupId) {
        return;
      }
      
      await processExpenseChange(expenseId, groupId, change);
    } catch (error: any) {
      logger.error('Error in trackExpenseChanges', { error: error as Error, expenseId });
    }
  }
);

/**
 * Process a group change and create a change notification
 */
async function processGroupChange(
  groupId: string,
  change: any
): Promise<void> {
  const beforeData = change.before?.data();
  const afterData = change.after?.data();
  
  // Determine change type
  let changeType: 'created' | 'modified' | 'deleted';
  if (!change.before?.exists) {
    changeType = 'created';
  } else if (!change.after?.exists) {
    changeType = 'deleted';
  } else {
    changeType = 'modified';
  }
  
  // Get affected users (group members)
  let affectedUsers: string[] = [];
  if (afterData?.data?.memberIds) {
    affectedUsers = afterData.data.memberIds;
  } else if (beforeData?.data?.memberIds) {
    affectedUsers = beforeData.data.memberIds;
  }
  
  // Determine changed fields
  const changedFields = getChangedFields(beforeData, afterData);
  
  // Calculate priority based on changed fields
  const priority = calculatePriority(changedFields, 'group');
  
  // Get the user who made the change
  const userId = afterData?.userId || beforeData?.userId || 'system';
  
  const changeDoc: ChangeNotification = {
    groupId,
    timestamp: Date.now(),
    type: changeType,
    userId,
    fields: changedFields,
    metadata: {
      priority,
      affectedUsers
    }
  };
  
  await admin.firestore()
    .collection('group-changes')
    .add(changeDoc);
}

/**
 * Process an expense change and create a change notification
 */
async function processExpenseChange(
  expenseId: string,
  groupId: string,
  change: any
): Promise<void> {
  const beforeData = change.before?.data();
  const afterData = change.after?.data();
  
  // Determine change type
  let changeType: 'created' | 'modified' | 'deleted';
  if (!change.before?.exists) {
    changeType = 'created';
  } else if (!change.after?.exists) {
    changeType = 'deleted';
  } else {
    changeType = 'modified';
  }
  
  // Get affected users from the expense memberIds
  let affectedUsers: string[] = [];
  if (afterData?.memberIds) {
    affectedUsers = afterData.memberIds;
  } else if (beforeData?.memberIds) {
    affectedUsers = beforeData.memberIds;
  }
  
  // If no memberIds in expense, try to get from group
  if (affectedUsers.length === 0) {
      const groupDoc = await admin.firestore()
        .collection('groups')
        .doc(groupId)
        .get();
      
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        affectedUsers = groupData?.data?.memberIds || [];
      }
  }
  
  // Determine changed fields
  const changedFields = getChangedFields(beforeData, afterData);
  
  // All expense changes are high priority as they affect balances
  const priority = 'high' as const;
  
  // Get the user who made the change
  const userId = afterData?.createdBy || beforeData?.createdBy || 'system';
  
  const changeDoc: ChangeNotification = {
    expenseId,
    groupId,
    timestamp: Date.now(),
    type: changeType,
    userId,
    fields: changedFields,
    metadata: {
      priority,
      affectedUsers
    }
  };
  
  try {
    await admin.firestore()
      .collection('expense-changes')
      .add(changeDoc);
  } catch (error: any) {
    logger.error('Error adding expense change notification to Firestore', { 
      error: error.message,
      changeDoc 
    });
  }
  
  // Also create a balance change notification since expenses affect balances
  const balanceChangeDoc: ChangeNotification = {
    groupId,
    timestamp: Date.now(),
    type: 'modified',
    userId,
    fields: ['balance'],
    metadata: {
      priority: 'high',
      affectedUsers
    }
  };
  
  try {
    const balanceBatch = admin.firestore().batch();
    const balanceDocRef = admin.firestore()
      .collection('balance-changes')
      .doc();
    
    balanceBatch.set(balanceDocRef, balanceChangeDoc);
    await balanceBatch.commit();
  } catch (error: any) {
    logger.error('Error adding balance change notification', { error });
  }
}

/**
 * Get the list of changed fields between two document states
 */
function getChangedFields(beforeData: any, afterData: any): string[] {
  if (!beforeData) return ['*']; // New document
  if (!afterData) return ['*']; // Deleted document
  
  const changedFields: string[] = [];
  const allKeys = new Set([
    ...Object.keys(beforeData || {}),
    ...Object.keys(afterData || {})
  ]);
  
  for (const key of allKeys) {
    // Skip timestamp fields as they always change
    if (key === 'updatedAt' || key === 'createdAt') continue;
    
    const beforeValue = beforeData?.[key];
    const afterValue = afterData?.[key];
    
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      // For nested data object, check specific fields
      if (key === 'data' && typeof beforeValue === 'object' && typeof afterValue === 'object') {
        const nestedChanges = getChangedFields(beforeValue, afterValue);
        changedFields.push(...nestedChanges.map(field => `data.${field}`));
      } else {
        changedFields.push(key);
      }
    }
  }
  
  return changedFields.length > 0 ? changedFields : ['none'];
}

/**
 * Calculate the priority of a change based on the changed fields
 */
function calculatePriority(
  changedFields: string[],
  type: 'group' | 'expense'
): 'high' | 'medium' | 'low' {
  // Expenses are always high priority
  if (type === 'expense') return 'high';
  
  // Critical fields that require immediate update
  const criticalFields = [
    'data.memberIds',
    'data.balance',
    'data.members',
    'amount',
    'splits',
    'participants'
  ];
  
  // Important fields that should be updated soon
  const importantFields = [
    'data.name',
    'data.description',
    'description',
    'category',
    'data.currency'
  ];
  
  // Check if any critical fields changed
  if (changedFields.some(field => 
    criticalFields.some(cf => field.includes(cf))
  )) {
    return 'high';
  }
  
  // Check if any important fields changed
  if (changedFields.some(field => 
    importantFields.some(cf => field.includes(cf))
  )) {
    return 'medium';
  }
  
  // All other changes are low priority
  return 'low';
}

/**
 * Track changes to settlements collection and emit change notifications
 * Settlements affect balances, so we need to notify about expense changes
 */
export const trackSettlementChanges = onDocumentWritten(
  {
    document: 'settlements/{settlementId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    const { settlementId } = event.params;
    const change = event.data;
    
    if (!change) {
      return;
    }
    
    try {
      await processSettlementChange(settlementId, change);
    } catch (error: any) {
      logger.error('Error in trackSettlementChanges', { error: error as Error, settlementId });
    }
  }
);

/**
 * Process settlement changes
 */
async function processSettlementChange(
  settlementId: string, 
  change: any
): Promise<void> {
  const beforeData = change.before?.data();
  const afterData = change.after?.data();
  
  // Determine change type
  let changeType: 'created' | 'modified' | 'deleted';
  if (!change.before.exists && change.after.exists) {
    changeType = 'created';
  } else if (change.before.exists && !change.after.exists) {
    changeType = 'deleted';
  } else {
    changeType = 'modified';
  }
  
  // Get the relevant data (after for create/modify, before for delete)
  const settlementData = changeType === 'deleted' ? beforeData : afterData;
  if (!settlementData || !settlementData.groupId) {
    logger.warn('Settlement data missing groupId', { settlementId, changeType });
    return;
  }
  
  const { groupId, payerId, payeeId, amount } = settlementData;
  
  // Get all affected users (both payer and payee)
  const affectedUsers = [payerId, payeeId].filter(Boolean);
  
  // Determine priority based on amount
  const priority = amount > 100 ? 'high' : amount > 50 ? 'medium' : 'low';
  
  logger.info('Processing settlement change', {
    settlementId,
    groupId,
    changeType,
    amount,
    affectedUsers
  });
  
  // Create an expense change notification since settlements affect balances
  // The client will refresh expenses and balances when it sees this
  const changeDoc: ChangeNotification = {
    groupId,
    timestamp: Date.now(),
    type: changeType,
    fields: ['settlement'],
    metadata: {
      priority,
      affectedUsers
    }
  };
  
  try {
    await admin.firestore()
      .collection('expense-changes')
      .add(changeDoc);
    logger.info('Settlement change notification created', { 
      settlementId, 
      groupId,
      changeType 
    });
  } catch (error: any) {
    logger.error('Error adding settlement change notification', { 
      error: error.message,
      changeDoc 
    });
  }
}