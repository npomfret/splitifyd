import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { validateGroupId } from './validation';

const firestore = getFirestore();
const applicationBuilder = ApplicationBuilder.createApplicationBuilder(firestore, getAuth());
const groupMemberService = applicationBuilder.buildGroupMemberService();

/**
 * Leave a group
 * Removes the current user from the group
 */
export const leaveGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    const groupId = validateGroupId(req.params.id);

    try {
        const result = await groupMemberService.leaveGroup(userId!, groupId);
        res.json(result);
    } catch (error) {
        logger.error('Error in leaveGroup', error, {
            groupId,
            userId,
        });
        throw error;
    }
};

/**
 * Remove a member from a group
 * Only group creators can remove other members
 */
export const removeGroupMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    const groupId = validateGroupId(req.params.id);
    const memberId = req.params.memberId;

    try {
        const result = await groupMemberService.removeGroupMember(userId!, groupId, memberId);
        res.json(result);
    } catch (error) {
        logger.error('Error in removeGroupMember', error, {
            groupId,
            userId,
            memberId,
        });
        throw error;
    }
};
