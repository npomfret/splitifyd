import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { ApiError } from '../utils/errors';

export async function getGroupBalances(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.uid;
    const groupId = req.query.groupId as string;

    if (!userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    if (!groupId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Group ID is required');
    }

    const groupDoc = await admin.firestore().collection('documents').doc(groupId).get();
    
    if (!groupDoc.exists) {
        throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    }
    
    const groupData = groupDoc.data()!;
    const memberIds = groupData.data!.memberIds!;
    if (memberIds.length === 0) {
        throw new Error(`Group ${groupId} has no members`);
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
        lastUpdated: balances.lastUpdated.toDate().toISOString()
    });
}