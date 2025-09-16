import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { logger } from '../logger';
import { getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

const firestore = getFirestore();
const applicationBuilder = new ApplicationBuilder(firestore);
const groupPermissionService = applicationBuilder.buildGroupPermissionService();

/**
 * Update individual group permissions
 */
export const updateGroupPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const { permissions } = req.body;

    try {
        const result = await groupPermissionService.updateGroupPermissions(userId, groupId, permissions);
        res.json(result);
    } catch (error) {
        logger.error('Error in updateGroupPermissions', error, {
            groupId,
            userId,
            permissions,
        });
        throw error;
    }
};

/**
 * Change a member's role
 */
export const setMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const targetUserId = req.params.memberId;
    const { role } = req.body;

    try {
        const result = await groupPermissionService.setMemberRole(userId, groupId, targetUserId, role);
        res.json(result);
    } catch (error) {
        logger.error('Error in setMemberRole', error, {
            groupId,
            userId,
            targetUserId,
            role,
        });
        throw error;
    }
};

