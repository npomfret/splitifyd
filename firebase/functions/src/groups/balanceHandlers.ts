import { Request, Response } from 'express';
import { logger } from '../logger';
import { getGroupService } from '../services/serviceRegistration';

export async function getGroupBalances(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.uid;
    const groupId = req.query.groupId as string;

    try {
        const result = await getGroupService().getGroupBalances(groupId, userId);
        res.json(result);
    } catch (error) {
        logger.error('Error in getGroupBalances', error, {
            groupId,
            userId,
        });
        throw error;
    }
}
