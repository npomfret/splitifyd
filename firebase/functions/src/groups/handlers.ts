import { Response } from 'express';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import {
  validateCreateGroup,
  validateUpdateGroup,
  validateGroupId,
  sanitizeGroupData,
} from './validation';
import {
  Group,
  GroupWithBalance,
  GroupDocument,
} from '../types/group-types';
import { UserBalance } from '../types/webapp-shared-types';
import { buildPaginatedQuery, encodeCursor } from '../utils/pagination';
import { logger } from '../logger';
import { userService } from '../services/userService';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { calculateExpenseMetadata } from '../services/expenseMetadataService';

/**
 * Get the groups collection reference
 */
const getGroupsCollection = () => {
  return admin.firestore().collection('documents'); // Using existing collection during migration
};

/**
 * Generate initials from a name or email
 */
const getInitials = (nameOrEmail: string): string => {
  if (!nameOrEmail) return 'U';
  
  // If it's an email, use the part before @
  if (nameOrEmail.includes('@')) {
    const username = nameOrEmail.split('@')[0];
    return username.charAt(0).toUpperCase();
  }
  
  // For regular names, take first letter of each word
  const words = nameOrEmail.trim().split(/\s+/);
  return words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 2);
};

/**
 * Transform Firestore document to GroupDocument format
 */
const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): GroupDocument => {
  const data = doc.data();
  if (!data) {
    throw new Error('Invalid group document');
  }

  // Expect consistent document structure
  if (!data.data) {
    throw new Error('Invalid group document structure: missing data field');
  }
  const groupData = data.data;
  

  return {
    id: doc.id,
    name: groupData.name!,
    description: groupData.description ?? '',
    createdBy: groupData.createdBy!,
    memberIds: groupData.memberIds!,
    createdAt: data.createdAt!.toDate(),
    updatedAt: data.updatedAt!.toDate(),
  };
};

/**
 * Convert GroupDocument to Group with computed fields
 */
const convertGroupDocumentToGroup = async (groupDoc: GroupDocument, userId: string): Promise<Group> => {
  // Calculate real balance for the user
  const groupBalances = await calculateGroupBalances(groupDoc.id);
  const userBalanceData = groupBalances.userBalances[userId];
  
  // Calculate expense metadata on-demand
  const expenseMetadata = await calculateExpenseMetadata(groupDoc.id);
  
  let userBalance: UserBalance | null = null;
  let totalOwed = 0;
  let totalOwing = 0;
  
  if (userBalanceData) {
    userBalance = {
      userId: userId,
      netBalance: userBalanceData.netBalance,
      owes: userBalanceData.owes,
      owedBy: userBalanceData.owedBy
    };
    
    // Calculate totals from user's balance data
    totalOwed = Object.values(userBalanceData.owedBy as Record<string, number>).reduce((sum: number, amount: number) => sum + amount, 0);
    totalOwing = Object.values(userBalanceData.owes as Record<string, number>).reduce((sum: number, amount: number) => sum + amount, 0);
  }

  return {
    id: groupDoc.id,
    name: groupDoc.name,
    description: groupDoc.description,
    memberCount: groupDoc.memberIds.length,
    balance: {
      userBalance,
      totalOwed,
      totalOwing
    },
    lastActivity: expenseMetadata.lastExpenseTime ? 
      `Last expense ${expenseMetadata.lastExpenseTime.toLocaleDateString()}` : 
      'No recent activity',
    lastActivityRaw: expenseMetadata.lastExpenseTime ? 
      expenseMetadata.lastExpenseTime.toISOString() : 
      groupDoc.createdAt.toISOString(),
    
    // Fetch member profiles dynamically
    members: await (async () => {
      const memberProfiles = await userService.getUsers(groupDoc.memberIds);
      return groupDoc.memberIds.map(memberId => {
        const profile = memberProfiles.get(memberId);
        return {
          uid: memberId,
          name: profile!.displayName,
          initials: getInitials(profile!.displayName),
          email: profile!.email,
          displayName: profile!.displayName
        };
      });
    })(),
    createdBy: groupDoc.createdBy,
    createdAt: groupDoc.createdAt.toISOString(),
    updatedAt: groupDoc.updatedAt.toISOString()
  };
};

/**
 * Fetch a group and verify user access
 */
const fetchGroupWithAccess = async (
  groupId: string,
  userId: string,
  requireWriteAccess: boolean = false
): Promise<{ docRef: admin.firestore.DocumentReference, group: Group }> => {
  const docRef = getGroupsCollection().doc(groupId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw Errors.NOT_FOUND('Group');
  }

  const groupDoc = transformGroupDocument(doc);
  
  // Check if user is the owner
  if (groupDoc.createdBy === userId) {
    const group = await convertGroupDocumentToGroup(groupDoc, userId);
    return { docRef, group };
  }

  // For write operations, only the owner is allowed
  if (requireWriteAccess) {
    throw Errors.FORBIDDEN();
  }

  // For read operations, check if user is a member
  if (groupDoc.memberIds.includes(userId)) {
    const group = await convertGroupDocumentToGroup(groupDoc, userId);
    return { docRef, group };
  }

  // User doesn't have access to this group
  throw Errors.NOT_FOUND('Group');
};

/**
 * Create a new group
 */
export const createGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw Errors.UNAUTHORIZED();
    }

    // Validate request body
    let groupData;
    try {
      groupData = validateCreateGroup(req.body);
    } catch (error) {
      logger.error('Validation failed', { 
        error: error instanceof Error ? error : new Error(String(error)), 
        body: req.body 
      });
      throw error;
    }
    
    // Sanitize group data
    const sanitizedData = sanitizeGroupData(groupData);

    // Initialize group structure
    const now = new Date();
    const docRef = getGroupsCollection().doc();
  
  const newGroup: GroupDocument = {
    id: docRef.id,
    name: sanitizedData.name,
    description: sanitizedData.description ?? '',
    createdBy: userId,
    memberIds: sanitizedData.members ? sanitizedData.members.map((m: any) => m.uid) : [userId],
    createdAt: now,
    updatedAt: now,
  };

  // Store in Firestore (using old structure during migration)
  await docRef.set({
    userId,
    data: newGroup,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  logger.info('Group created successfully', {
    groupId: docRef.id,
    userId,
    name: sanitizedData.name,
  });

    const createdDoc = await docRef.get();
    const groupDoc = transformGroupDocument(createdDoc);
    const group = await convertGroupDocumentToGroup(groupDoc, userId);
    res.status(HTTP_STATUS.CREATED).json(group);
  } catch (error) {
    logger.error('Error in createGroup', { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
};

/**
 * Get a single group by ID
 */
export const getGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }
  const groupId = validateGroupId(req.params.id);

  const { group } = await fetchGroupWithAccess(groupId, userId);

  // Add balance information
  let userBalance: UserBalance | null = null;
  const balanceDoc = await admin.firestore()
    .collection('group-balances')
    .doc(groupId)
    .get();
  
  if (balanceDoc.exists) {
    const balanceData = balanceDoc.data();
    userBalance = balanceData?.userBalances?.[userId] || null;
  }
  
  const groupWithBalance: GroupWithBalance = {
    ...group,
    balance: {
      userBalance: userBalance,
      totalOwed: userBalance && userBalance.netBalance > 0 ? userBalance.netBalance : 0,
      totalOwing: userBalance && userBalance.netBalance < 0 ? Math.abs(userBalance.netBalance) : 0,
    },
  };

  res.json(groupWithBalance);
};

/**
 * Update an existing group
 */
export const updateGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }
  const groupId = validateGroupId(req.params.id);

  // Validate request body
  const updates = validateUpdateGroup(req.body);
  
  // Sanitize update data
  const sanitizedUpdates = sanitizeGroupData(updates);

  // Fetch group with write access check
  const { docRef, group } = await fetchGroupWithAccess(groupId, userId, true);

  // Update only allowed fields
  const updatedData = {
    ...group,
    ...sanitizedUpdates,
    updatedAt: new Date(),
  };

  // Update in Firestore (using old structure during migration)
  await docRef.update({
    'data.name': updatedData.name,
    'data.description': updatedData.description,
    'data.updatedAt': updatedData.updatedAt.toISOString(),
    updatedAt: Timestamp.fromDate(updatedData.updatedAt),
  });

  logger.info('Group updated successfully', {
    groupId,
    userId,
    updates: Object.keys(sanitizedUpdates),
  });

  res.json({ message: 'Group updated successfully' });
};

/**
 * Delete a group
 */
export const deleteGroup = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }
  const groupId = validateGroupId(req.params.id);

  // Fetch group with write access check
  const { docRef } = await fetchGroupWithAccess(groupId, userId, true);

  // Check if group has expenses
  const expensesSnapshot = await admin.firestore()
    .collection('expenses')
    .where('groupId', '==', groupId)
    .limit(1)
    .get();

  if (!expensesSnapshot.empty) {
    throw Errors.INVALID_INPUT('Cannot delete group with expenses. Delete all expenses first.');
  }

  // Delete the group
  await docRef.delete();

  logger.info('Group deleted successfully', {
    groupId,
    userId,
  });

  res.json({ message: 'Group deleted successfully' });
};

/**
 * List all groups for the authenticated user
 */
export const listGroups = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }

  // Parse pagination parameters
  const limit = Math.min(
    parseInt(req.query.limit as string) || DOCUMENT_CONFIG.LIST_LIMIT,
    DOCUMENT_CONFIG.LIST_LIMIT
  );
  const cursor = req.query.cursor as string;
  const order = (req.query.order as 'asc' | 'desc') ?? 'desc';

  // Build base query - groups where user is a member
  const baseQuery = getGroupsCollection()
    .where('data.memberIds', 'array-contains', userId)
    .select('data', 'createdAt', 'updatedAt', 'userId');

  // Build paginated query
  const paginatedQuery = buildPaginatedQuery(
    baseQuery,
    cursor,
    order,
    limit + 1
  );

  // Execute query
  const snapshot = await paginatedQuery.get();
  const documents = snapshot.docs;

  // Determine if there are more results
  const hasMore = documents.length > limit;
  const returnedDocs = hasMore ? documents.slice(0, limit) : documents;

  // Transform documents to groups
  const groups: Group[] = await Promise.all(
    returnedDocs.map(async (doc) => {
      const group = transformGroupDocument(doc);
      
      // Calculate balance for each group
      let userBalance: UserBalance | null = null;
      const balanceDoc = await admin.firestore()
        .collection('group-balances')
        .doc(group.id)
        .get();
      
      if (balanceDoc.exists) {
        const balanceData = balanceDoc.data();
        userBalance = balanceData?.userBalances?.[userId] || null;
      }

      // Calculate expense metadata for each group
      const expenseMetadata = await calculateExpenseMetadata(group.id);
      
      // Format last activity
      const lastActivityDate = expenseMetadata.lastExpenseTime || group.updatedAt;
      const lastActivity = formatRelativeTime(lastActivityDate.toISOString());

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.memberIds.length,
        balance: {
          userBalance: userBalance,
          totalOwed: userBalance && userBalance.netBalance > 0 ? userBalance.netBalance : 0,
          totalOwing: userBalance && userBalance.netBalance < 0 ? Math.abs(userBalance.netBalance) : 0,
        },
        lastActivity,
        lastActivityRaw: lastActivityDate.toISOString(),
        lastExpense: expenseMetadata.lastExpense ? {
          description: expenseMetadata.lastExpense.description,
          amount: expenseMetadata.lastExpense.amount,
          date: expenseMetadata.lastExpense.date.toISOString(),
        } : undefined,
        expenseCount: expenseMetadata.expenseCount,
      };
    })
  );

  // Generate nextCursor if there are more results
  let nextCursor: string | undefined;
  if (hasMore && returnedDocs.length > 0) {
    const lastDoc = returnedDocs[returnedDocs.length - 1];
    const lastGroup = transformGroupDocument(lastDoc);
    nextCursor = encodeCursor({
      updatedAt: lastGroup.updatedAt.toISOString(),
      id: lastGroup.id
    });
  }

  const response = {
    groups,
    count: groups.length,
    hasMore,
    ...(nextCursor && { nextCursor }),
    pagination: {
      limit,
      order,
    },
  };

  res.json(response);
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
};