import { Request, Response } from 'express';
import { calculateGroupBalances } from '../services/balanceCalculator';
import { firestoreDb } from '../firebase';
import { ApiError } from '../utils/errors';
import { timestampToISO } from '../utils/dateHelpers';
import {FirestoreCollections, groupSize} from '../shared/shared-types';

export async function getGroupBalances(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.uid;
    const groupId = req.query.groupId as string;

    if (!userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'User not authenticated');
    }

    if (!groupId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Group ID is required');
    }

    const groupDoc = await firestoreDb.collection(FirestoreCollections.GROUPS).doc(groupId).get();

    if (!groupDoc.exists) {
        throw new ApiError(404, 'NOT_FOUND', 'Group not found');
    }

    const groupData = groupDoc.data()!;

    if (groupSize(groupData.data) === 0) {
        throw new ApiError(400, 'INVALID_GROUP_STATE', `Group ${groupId} has no members`);
    }

    if (!(userId in groupData.data.members)) {
        throw new ApiError(403, 'FORBIDDEN', 'User is not a member of this group');
    }

    // Always calculate balances on-demand for accurate data
    const balances = await calculateGroupBalances(groupId);

    res.json({
        groupId: balances.groupId,
        userBalances: balances.userBalances,
        simplifiedDebts: balances.simplifiedDebts,
        lastUpdated: timestampToISO(balances.lastUpdated),
        balancesByCurrency: balances.balancesByCurrency || {},
    });
}
