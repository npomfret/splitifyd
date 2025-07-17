import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { GroupBalance } from '../models/groupBalance';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { ApiError } from '../utils/errors';
import { logger } from '../logger';
import { Member } from '../types/expense-types';

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
    const members = groupData.data?.members || [];
    if (members.length === 0) {
        throw new Error(`Group ${groupId} has no members`);
    }
    const memberIds = members.map((m: Member) => m.uid);
    if (!memberIds.includes(userId)) {
        throw new ApiError(403, 'FORBIDDEN', 'User is not a member of this group');
    }

    let balances: GroupBalance;
    
    const balanceDoc = await admin.firestore().collection('group-balances').doc(groupId).get();
    
    if (!balanceDoc.exists) {
        logger.info('No cached balances found, calculating...', { groupId });
        balances = await calculateGroupBalances(groupId);
        
        await admin.firestore().collection('group-balances').doc(groupId).set(balances);
    } else {
        balances = balanceDoc.data() as GroupBalance;
    }

    res.json({
        groupId: balances.groupId,
        userBalances: balances.userBalances,
        simplifiedDebts: balances.simplifiedDebts,
        lastUpdated: balances.lastUpdated.toDate().toISOString()
    });
}