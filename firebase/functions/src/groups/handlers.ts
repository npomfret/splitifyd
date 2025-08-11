import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { Errors } from '../utils/errors';
import { HTTP_STATUS, DOCUMENT_CONFIG } from '../constants';
import { createServerTimestamp, parseISOToTimestamp, timestampToISO, getRelativeTime } from '../utils/dateHelpers';
import {
  validateCreateGroup,
  validateUpdateGroup,
  validateGroupId,
  sanitizeGroupData,
} from './validation';
import {
  Group,
  GroupWithBalance,
} from '../types/group-types';
import { UserBalance, FirestoreCollections } from '../shared/shared-types';
import { buildPaginatedQuery, encodeCursor } from '../utils/pagination';
import { logger } from '../logger';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { calculateExpenseMetadata } from '../services/expenseMetadataService';

/**
 * Get the groups collection reference
 */
const getGroupsCollection = () => {
  return admin.firestore().collection(FirestoreCollections.GROUPS); // Using existing collection during migration
};


/**
 * Transform Firestore document to Group format
 */
const transformGroupDocument = (doc: admin.firestore.DocumentSnapshot): Group => {
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
    createdAt: data.createdAt!.toDate().toISOString(),
    updatedAt: data.updatedAt!.toDate().toISOString(),
  };
};

/**
 * Add computed fields to Group
 */
const addComputedFields = async (group: Group, userId: string): Promise<Group> => {
  // Calculate real balance for the user
  const groupBalances = await calculateGroupBalances(group.id);
  const userBalanceData = groupBalances.userBalances[userId];
  
  // Calculate expense metadata on-demand
  const expenseMetadata = await calculateExpenseMetadata(group.id);
  
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
    ...group,
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
      group.createdAt,
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
    const groupWithComputed = await addComputedFields(group, userId);
    return { docRef, group: groupWithComputed };
  }

  // For write operations, only the owner is allowed
  if (requireWriteAccess) {
    throw Errors.FORBIDDEN();
  }

  // For read operations, check if user is a member
  if (group.memberIds.includes(userId)) {
    const groupWithComputed = await addComputedFields(group, userId);
    return { docRef, group: groupWithComputed };
  }

  // User doesn't have access to this group
  // SECURITY: Return 404 instead of 403 to prevent information disclosure.
  // This prevents attackers from enumerating valid group IDs.
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
    const now = createServerTimestamp();
    const docRef = getGroupsCollection().doc();
  
  const newGroup: Group = {
    id: docRef.id,
    name: sanitizedData.name,
    description: sanitizedData.description ?? '',
    createdBy: userId,
    memberIds: sanitizedData.members ? sanitizedData.members.map((m: any) => m.uid) : [userId],
    createdAt: timestampToISO(now),
    updatedAt: timestampToISO(now),
  };

  // Store in Firestore (using old structure during migration)
  await docRef.set({
    userId,
    data: newGroup,
    createdAt: now,
    updatedAt: now,
  });

  logger.info('Group created successfully', {
    groupId: docRef.id,
    userId,
    name: sanitizedData.name,
  });

    const createdDoc = await docRef.get();
    const group = transformGroupDocument(createdDoc);
    const groupWithComputed = await addComputedFields(group, userId);
    
    res.status(HTTP_STATUS.CREATED).json(groupWithComputed);
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

  // Calculate balance information on-demand
  const groupBalances = await calculateGroupBalances(groupId);
  const userBalance = groupBalances.userBalances[userId] || null;
  
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
    updatedAt: createServerTimestamp().toDate(),
  };

  // Update in Firestore (using old structure during migration)
  await docRef.update({
    'data.name': updatedData.name,
    'data.description': updatedData.description,
    'data.updatedAt': updatedData.updatedAt.toISOString(),
    updatedAt: createServerTimestamp(),
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
    .collection(FirestoreCollections.EXPENSES)
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
      
      // Calculate balance for each group on-demand
      const groupBalances = await calculateGroupBalances(group.id);
      const userBalance = groupBalances.userBalances[userId] || null;

      // Calculate expense metadata for each group
      const expenseMetadata = await calculateExpenseMetadata(group.id);
      
      // Format last activity
      const lastActivityDate = expenseMetadata.lastExpenseTime ?? new Date(group.updatedAt);
      const lastActivity = formatRelativeTime(lastActivityDate.toISOString());

      return {
        ...group,
        balance: {
          userBalance: userBalance,
          totalOwed: userBalance && userBalance.netBalance > 0 ? userBalance.netBalance : 0,
          totalOwing: userBalance && userBalance.netBalance < 0 ? Math.abs(userBalance.netBalance) : 0,
        },
        lastActivity,
        lastActivityRaw: lastActivityDate.toISOString(),
      };
    })
  );

  // Generate nextCursor if there are more results
  let nextCursor: string | undefined;
  if (hasMore && returnedDocs.length > 0) {
    const lastDoc = returnedDocs[returnedDocs.length - 1];
    const lastGroup = transformGroupDocument(lastDoc);
    nextCursor = encodeCursor({
      updatedAt: lastGroup.updatedAt,
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
 * Now uses centralized date helpers for consistency
 */
const formatRelativeTime = (dateStr: string): string => {
  const timestamp = parseISOToTimestamp(dateStr);
  if (!timestamp) {
    return 'unknown';
  }
  return getRelativeTime(timestamp);
};