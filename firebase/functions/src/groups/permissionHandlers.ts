import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { logger } from '../logger';
import { getGroupPermissionService } from '../services/serviceRegistration';


/**
 * Apply a security preset to a group
 */
export const applySecurityPreset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const { preset } = req.body;

    try {
        const result = await getGroupPermissionService().applySecurityPreset(userId, groupId, preset);
        res.json(result);
    } catch (error) {
        logger.error('Error in applySecurityPreset', error, {
            groupId,
            userId,
            preset,
        });
        throw error;
    }
};

/**
 * Update individual group permissions
 */
export const updateGroupPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;
    const { permissions } = req.body;

    try {
        const result = await getGroupPermissionService().updateGroupPermissions(userId, groupId, permissions);
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
        const result = await getGroupPermissionService().setMemberRole(userId, groupId, targetUserId, role);
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

/**
 * Get user's permissions for a group (for UI display)
 */
export const getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = validateUserAuth(req);
    const groupId = req.params.id;

    try {
        const result = await getGroupPermissionService().getUserPermissions(userId, groupId);
        res.json(result);
    } catch (error) {
        logger.error('Error in getUserPermissions', error, {
            groupId,
            userId,
        });
        throw error;
    }
};
