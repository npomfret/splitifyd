import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { ApiError } from '../utils/errors';
import { timestampToISO } from '../utils/dateHelpers';
import { FirestoreCollections } from '../types/webapp-shared-types';

export async function getGroupBalances(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.uid;
    const groupId = req.query.groupId as string;

    if (!userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    if (!groupId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Group ID is required');
    }

    const groupDoc = await admin.firestore().collection(FirestoreCollections.GROUPS).doc(groupId).get();
    
    if (!groupDoc.exists) {
        throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    }
    
    const groupData = groupDoc.data()!;
    
    // Handle group structure variations (old vs new format)
    let memberIds: string[];
    if (groupData.data?.memberIds) {
        memberIds = groupData.data.memberIds;
    } else if (groupData.memberIds) {
        memberIds = groupData.memberIds;
    } else {
        throw new ApiError(400, 'INVALID_GROUP_STATE', 'Group has invalid member structure');
    }
    
    if (!memberIds || memberIds.length === 0) {
        throw new ApiError(400, 'INVALID_GROUP_STATE', `Group ${groupId} has no members`);
    }
    
    if (!memberIds.includes(userId)) {
        throw new ApiError(403, 'FORBIDDEN', 'User is not a member of this group');
    }

    // Always calculate balances on-demand for accurate data
    const balances = await calculateGroupBalances(groupId);

    res.json({
        groupId: balances.groupId,
        userBalances: balances.userBalances,
        simplifiedDebts: balances.simplifiedDebts,
        lastUpdated: timestampToISO(balances.lastUpdated)
    });
}