import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { ApiError } from '../utils/errors';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const groupShareService = applicationBuilder.buildGroupShareService();

export async function generateShareableLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { groupId } = req.body;
    const userId = req.user!.uid;

    try {
        const result = await groupShareService.generateShareableLink(userId, groupId);
        res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error generating shareable link', error, {
            groupId,
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to generate shareable link');
    }
}

export async function previewGroupByLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { linkId } = req.body;
    const userId = req.user!.uid;

    try {
        const result = await groupShareService.previewGroupByLink(userId, linkId);
        res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error previewing group by link', error, {
            linkId: linkId?.substring(0, 4) + '...',
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to preview group');
    }
}

export async function joinGroupByLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { linkId } = req.body;
    const userId = req.user!.uid;
    const userEmail = req.user!.email;

    try {
        const result = await groupShareService.joinGroupByLink(userId, linkId);
        res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
        if (error instanceof ApiError) throw error;

        logger.error('Error joining group by link', error, {
            linkId: linkId?.substring(0, 4) + '...',
            userId,
        });

        throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to join group');
    }
}
