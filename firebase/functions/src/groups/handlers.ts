import { Response } from 'express';
import * as admin from 'firebase-admin';
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
  GroupSummary,
  GroupListResponse,
  GroupDocument,
} from '../types/group-types';
import { buildPaginatedQuery, encodeCursor } from '../utils/pagination';
import { logger } from '../logger';

/**
 * Get the groups collection reference
 */
const getGroupsCollection = () => {
  return admin.firestore().collection('documents'); // Using existing collection during migration
};

/**
 * Transform Firestore document to API group format
 */
const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
  const data = doc.data();
  if (!data) {
    throw new Error('Invalid group document');
  }

  // Handle both old (nested) and new (flat) document structures
  const groupData = data.data || data;

  return {
    id: doc.id,
    name: groupData.name,
    description: groupData.description || '',
    createdBy: groupData.createdBy || data.userId,
    memberIds: groupData.memberIds || [],
    memberEmails: groupData.memberEmails || [],
    members: groupData.members || [],
    expenseCount: groupData.expenseCount || 0,
    lastExpenseTime: groupData.lastExpenseTime || null,
    lastExpense: groupData.lastExpense || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
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

  const group = transformGroupDocument(doc);

  // Check if user is the owner
  if (group.createdBy === userId) {
    return { docRef, group };
  }

  // For write operations, only the owner is allowed
  if (requireWriteAccess) {
    throw Errors.FORBIDDEN();
  }

  // For read operations, check if user is a member
  if (group.memberIds.includes(userId)) {
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
  const userId = req.user?.uid;
  if (!userId) {
    throw Errors.UNAUTHORIZED();
  }
  const user = req.user!;
  const userEmail = user.email || '';

  // Validate request body
  const groupData = validateCreateGroup(req.body);
  
  // Sanitize group data
  const sanitizedData = sanitizeGroupData(groupData);

  // Initialize group structure
  const now = new Date();
  const docRef = getGroupsCollection().doc();
  
  const newGroup: GroupDocument = {
    id: docRef.id,
    name: sanitizedData.name,
    description: sanitizedData.description || '',
    createdBy: userId,
    memberIds: [userId],
    memberEmails: [userEmail].concat(sanitizedData.memberEmails || []),
    members: [{
      uid: userId,
      name: userEmail || 'Unknown',
      initials: (userEmail || 'U').substring(0, 2).toUpperCase(),
      email: userEmail,
    }],
    expenseCount: 0,
    lastExpenseTime: undefined,
    lastExpense: undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Store in Firestore (using old structure during migration)
  await docRef.set({
    userId,
    data: newGroup,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    updatedAt: admin.firestore.Timestamp.fromDate(now),
  });

  logger.info('Group created successfully', {
    groupId: docRef.id,
    userId,
    name: sanitizedData.name,
  });

  res.status(HTTP_STATUS.CREATED).json(transformGroupDocument(await docRef.get()));
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
  let userBalance = 0;
  try {
    const balanceDoc = await admin.firestore()
      .collection('groupBalances')
      .doc(groupId)
      .get();
    
    if (balanceDoc.exists) {
      const balanceData = balanceDoc.data();
      userBalance = balanceData?.userBalances?.[userId] || 0;
    }
    
    const groupWithBalance: GroupWithBalance = {
      ...group,
      balance: {
        userBalance,
        totalOwed: userBalance > 0 ? userBalance : 0,
        totalOwing: userBalance < 0 ? Math.abs(userBalance) : 0,
      },
    };

    res.json(groupWithBalance);
  } catch (error) {
    // If balance calculation fails, return group without balance
    logger.warn('Failed to calculate balance for group', { 
      groupId, 
      errorMessage: error instanceof Error ? error.message : String(error) 
    });
    res.json(group);
  }
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
    updatedAt: admin.firestore.Timestamp.fromDate(updatedData.updatedAt),
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
  const order = (req.query.order as 'asc' | 'desc') || 'desc';

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

  // Transform documents to group summaries
  const groups: GroupSummary[] = await Promise.all(
    returnedDocs.map(async (doc) => {
      const group = transformGroupDocument(doc);
      
      // Calculate balance for each group
      let userBalance = 0;
      try {
        const balanceDoc = await admin.firestore()
          .collection('groupBalances')
          .doc(group.id)
          .get();
        
        if (balanceDoc.exists) {
          const balanceData = balanceDoc.data();
          userBalance = balanceData?.userBalances?.[userId] || 0;
        }
      } catch (error) {
        logger.warn('Failed to fetch balance for group', { groupId: group.id });
      }

      // Format last activity
      const lastActivityDate = group.lastExpenseTime || group.updatedAt;
      const lastActivity = formatRelativeTime(lastActivityDate);

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        balance: {
          userBalance,
          totalOwed: userBalance > 0 ? userBalance : 0,
          totalOwing: userBalance < 0 ? Math.abs(userBalance) : 0,
        },
        lastActivity,
        lastActivityRaw: lastActivityDate,
        lastExpense: group.lastExpense,
        expenseCount: group.expenseCount,
      };
    })
  );

  // Prepare next cursor
  let nextCursor: string | undefined;
  if (hasMore) {
    const lastDoc = returnedDocs[returnedDocs.length - 1];
    const lastGroup = transformGroupDocument(lastDoc);
    nextCursor = encodeCursor({
      updatedAt: lastGroup.updatedAt,
      id: lastGroup.id,
    });
  }

  const response: GroupListResponse = {
    groups,
    count: groups.length,
    hasMore,
    nextCursor,
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