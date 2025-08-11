/**
 * Change detection triggers for real-time notifications
 * Phase 1 of streaming implementation
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { admin } from '../firebase';
import { DebounceManager } from '../utils/debounce';
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
    document: 'documents/{groupId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (event) => {
    const { groupId } = event.params;
    const change = event.data;
    
    if (!change) {
      logger.warn('No change data in group trigger', { groupId });
      return;
    }
    
    try {
      // Create a debounced function for this specific group
      const debouncedTracker = DebounceManager.debounce(
        `group-${groupId}`,
        async () => {
          await processGroupChange(groupId, change);
        },
        500 // 500ms debounce for groups
      );
      
      // Call the debounced function
      debouncedTracker();
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
      logger.warn('No change data in expense trigger', { expenseId });
      return;
    }
    
    try {
      // Get groupId from the expense data
      const expenseData = change.after?.data() || change.before?.data();
      const groupId = expenseData?.groupId;
      
      if (!groupId) {
        logger.warn('Expense change without groupId', { expenseId });
        return;
      }
      
      // Create a debounced function for this specific expense
      const debouncedTracker = DebounceManager.debounce(
        `expense-${expenseId}`,
        async () => {
          await processExpenseChange(expenseId, groupId, change);
        },
        300 // 300ms debounce for expenses (higher priority)
      );
      
      // Call the debounced function
      debouncedTracker();
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
  
  // Store change notification
  await admin.firestore()
    .collection('group-changes')
    .add(changeDoc);
    
  logger.info('Group change tracked', { 
    groupId, 
    changeType, 
    priority, 
    affectedUsersCount: affectedUsers.length,
    changedFields: changedFields.join(', ')
  });
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
    try {
      const groupDoc = await admin.firestore()
        .collection('documents')
        .doc(groupId)
        .get();
      
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        affectedUsers = groupData?.data?.memberIds || [];
      }
    } catch (error: any) {
      logger.warn('Could not get group members for expense change', { groupId, error: error as Error });
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
  
  // Store change notification
  await admin.firestore()
    .collection('expense-changes')
    .add(changeDoc);
  
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
  
  await admin.firestore()
    .collection('balance-changes')
    .add(balanceChangeDoc);
    
  logger.info('Expense change tracked', { 
    expenseId, 
    groupId, 
    changeType, 
    affectedUsersCount: affectedUsers.length,
    changedFields: changedFields.join(', ')
  });
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