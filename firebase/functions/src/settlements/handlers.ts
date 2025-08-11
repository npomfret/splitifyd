import { Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { ApiError } from '../utils/errors';
import { createServerTimestamp, safeParseISOToTimestamp, timestampToISO } from '../utils/dateHelpers';
import { logger } from '../logger';
import { HTTP_STATUS } from '../constants';
import {
  createSettlementSchema,
  updateSettlementSchema,
  settlementIdSchema,
  listSettlementsQuerySchema
} from './validation';
import { 
  Settlement, 
  CreateSettlementRequest, 
  UpdateSettlementRequest,
  SettlementListItem,
  User,
  FirestoreCollections
} from '../shared/shared-types';
import { GroupData } from '../types/group-types';

const getSettlementsCollection = () => {
  return admin.firestore().collection(FirestoreCollections.SETTLEMENTS);
};

const getGroupsCollection = () => {
  return admin.firestore().collection(FirestoreCollections.GROUPS);
};

const getUsersCollection = () => {
  return admin.firestore().collection(FirestoreCollections.USERS);
};

const verifyGroupMembership = async (groupId: string, userId: string): Promise<void> => {
  const groupDoc = await getGroupsCollection().doc(groupId).get();
  
  if (!groupDoc.exists) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }

  const groupData = groupDoc.data();
  
  if (!groupData || !groupData.data || !groupData.data.name) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }
  
  if (groupData.userId === userId) {
    return;
  }
  
  const groupDataTyped = groupData.data as GroupData;
  
  if (groupDataTyped.memberIds?.includes(userId)) {
    return;
  }
  
  throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_GROUP_MEMBER', 'You are not a member of this group');
};

const verifyUsersInGroup = async (groupId: string, userIds: string[]): Promise<void> => {
  const groupDoc = await getGroupsCollection().doc(groupId).get();
  
  if (!groupDoc.exists) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'GROUP_NOT_FOUND', 'Group not found');
  }

  const groupData = groupDoc.data();
  const groupDataTyped = groupData?.data as GroupData;
  
  const allMemberIds = [
    groupData?.userId,
    ...(groupDataTyped.memberIds || [])
  ].filter(Boolean);
  
  for (const userId of userIds) {
    if (!allMemberIds.includes(userId)) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'USER_NOT_IN_GROUP',
        `User ${userId} is not a member of this group`
      );
    }
  }
};

const fetchUserData = async (userId: string): Promise<User> => {
  const userDoc = await getUsersCollection().doc(userId).get();
  
  if (!userDoc.exists) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
  }
  
  const userData = userDoc.data();
  return {
    uid: userId,
    email: userData?.email || '',
    displayName: userData?.displayName || userData?.email || 'Unknown User'
  };
};

export const createSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = validateUserAuth(req);
    
    const { error, value } = createSettlementSchema.validate(req.body);
    if (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
    }
    
    const settlementData: CreateSettlementRequest = value;
    
    await verifyGroupMembership(settlementData.groupId, userId);
    
    await verifyUsersInGroup(settlementData.groupId, [
      settlementData.payerId, 
      settlementData.payeeId
    ]);
    
    const now = createServerTimestamp();
    const settlementDate = settlementData.date 
      ? safeParseISOToTimestamp(settlementData.date)
      : now;
    
    const settlementId = getSettlementsCollection().doc().id;
    
    const settlement: any = {
      id: settlementId,
      groupId: settlementData.groupId,
      payerId: settlementData.payerId,
      payeeId: settlementData.payeeId,
      amount: settlementData.amount,
      currency: settlementData.currency,
      date: settlementDate,
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    };
    
    // Only add note if it's provided
    if (settlementData.note) {
      settlement.note = settlementData.note;
    }
    
    await getSettlementsCollection().doc(settlementId).set(settlement);
    
    const responseData: Settlement = {
      ...settlement,
      date: timestampToISO(settlementDate),
      createdAt: timestampToISO(now),
      updatedAt: timestampToISO(now)
    };
    
    logger.info(`Settlement created: ${settlementId} by user: ${userId}`);
    
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error creating settlement:', error instanceof Error ? error : new Error('Unknown error'));
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create settlement'
        }
      });
    }
  }
};

export const updateSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = validateUserAuth(req);
    
    const { error: idError, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
    if (idError) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', idError.details[0].message);
    }
    
    const { error, value } = updateSettlementSchema.validate(req.body);
    if (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
    }
    
    const updateData: UpdateSettlementRequest = value;
    
    const settlementRef = getSettlementsCollection().doc(settlementId);
    const settlementDoc = await settlementRef.get();
    
    if (!settlementDoc.exists) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
    }
    
    const settlement = settlementDoc.data() as any;
    
    await verifyGroupMembership(settlement.groupId, userId);
    
    if (settlement.createdBy !== userId) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can update this settlement');
    }
    
    const updates: any = {
      updatedAt: createServerTimestamp()
    };
    
    if (updateData.amount !== undefined) {
      updates.amount = updateData.amount;
    }
    
    if (updateData.currency !== undefined) {
      updates.currency = updateData.currency;
    }
    
    if (updateData.date !== undefined) {
      updates.date = safeParseISOToTimestamp(updateData.date);
    }
    
    if (updateData.note !== undefined) {
      if (updateData.note) {
        updates.note = updateData.note;
      } else {
        // If note is explicitly set to empty string or null, remove it
        updates.note = admin.firestore.FieldValue.delete() as any;
      }
    }
    
    await settlementRef.update(updates);
    
    const updatedDoc = await settlementRef.get();
    const updatedSettlement = updatedDoc.data();
    
    const responseData: Settlement = {
      ...updatedSettlement,
      date: timestampToISO(updatedSettlement!.date),
      createdAt: timestampToISO(updatedSettlement!.createdAt),
      updatedAt: timestampToISO(updatedSettlement!.updatedAt)
    } as Settlement;
    
    logger.info(`Settlement updated: ${settlementId} by user: ${userId}`);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error updating settlement:', error instanceof Error ? error : new Error('Unknown error'));
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update settlement'
        }
      });
    }
  }
};

export const deleteSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = validateUserAuth(req);
    
    const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
    if (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
    }
    
    const settlementRef = getSettlementsCollection().doc(settlementId);
    const settlementDoc = await settlementRef.get();
    
    if (!settlementDoc.exists) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
    }
    
    const settlement = settlementDoc.data() as any;
    
    await verifyGroupMembership(settlement.groupId, userId);
    
    if (settlement.createdBy !== userId) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_SETTLEMENT_CREATOR', 'Only the creator can delete this settlement');
    }
    
    await settlementRef.delete();
    
    logger.info(`Settlement deleted: ${settlementId} by user: ${userId}`);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Settlement deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting settlement:', error instanceof Error ? error : new Error('Unknown error'));
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete settlement'
        }
      });
    }
  }
};

export const getSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = validateUserAuth(req);
    
    const { error, value: settlementId } = settlementIdSchema.validate(req.params.settlementId);
    if (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SETTLEMENT_ID', error.details[0].message);
    }
    
    const settlementDoc = await getSettlementsCollection().doc(settlementId).get();
    
    if (!settlementDoc.exists) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
    }
    
    const settlement = settlementDoc.data() as any;
    
    await verifyGroupMembership(settlement.groupId, userId);
    
    const [payerData, payeeData] = await Promise.all([
      fetchUserData(settlement.payerId),
      fetchUserData(settlement.payeeId)
    ]);
    
    const responseData: SettlementListItem = {
      id: settlement.id,
      groupId: settlement.groupId,
      payer: payerData,
      payee: payeeData,
      amount: settlement.amount,
      currency: settlement.currency || 'USD',
      date: timestampToISO(settlement.date),
      note: settlement.note,
      createdAt: timestampToISO(settlement.createdAt)
    };
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Error fetching settlement:', error instanceof Error ? error : new Error('Unknown error'));
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch settlement'
        }
      });
    }
  }
};

export const listSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = validateUserAuth(req);
    
    const { error, value } = listSettlementsQuerySchema.validate(req.query);
    if (error) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', error.details[0].message);
    }
    
    const { groupId, limit, cursor, userId: filterUserId, startDate, endDate } = value;
    
    await verifyGroupMembership(groupId, userId);
    
    let query: admin.firestore.Query = getSettlementsCollection()
      .where('groupId', '==', groupId)
      .orderBy('date', 'desc')
      .limit(limit);
    
    if (filterUserId) {
      query = query.where(
        admin.firestore.Filter.or(
          admin.firestore.Filter.where('payerId', '==', filterUserId),
          admin.firestore.Filter.where('payeeId', '==', filterUserId)
        )
      );
    }
    
    if (startDate) {
      query = query.where('date', '>=', safeParseISOToTimestamp(startDate));
    }
    
    if (endDate) {
      query = query.where('date', '<=', safeParseISOToTimestamp(endDate));
    }
    
    if (cursor) {
      const cursorDoc = await getSettlementsCollection().doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }
    
    const snapshot = await query.get();
    
    const settlements: SettlementListItem[] = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const [payerData, payeeData] = await Promise.all([
          fetchUserData(data.payerId),
          fetchUserData(data.payeeId)
        ]);
        
        return {
          id: doc.id,
          groupId: data.groupId,
          payer: payerData,
          payee: payeeData,
          amount: data.amount,
          currency: data.currency || 'USD',
          date: timestampToISO(data.date),
          note: data.note,
          createdAt: timestampToISO(data.createdAt)
        };
      })
    );
    
    const hasMore = snapshot.docs.length === limit;
    const nextCursor = hasMore && snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1].id
      : undefined;
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        settlements,
        count: settlements.length,
        hasMore,
        nextCursor
      }
    });
  } catch (error) {
    logger.error('Error listing settlements:', error instanceof Error ? error : new Error('Unknown error'));
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list settlements'
        }
      });
    }
  }
};