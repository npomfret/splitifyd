import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateGroupId } from './validation';
import { logger } from '../logger';
import { GroupMembersResponse } from '@splitifyd/shared';
import { getGroupMemberService } from '../services/serviceRegistration';


/**
 * Internal function to get group members data
 * Used by both the HTTP handler and consolidated endpoints
 */
export const _getGroupMembersData = async (groupId: string, membersMap: Record<string, any>): Promise<GroupMembersResponse> => {
    return await getGroupMemberService().getGroupMembersData(groupId, membersMap);
};


/**
 * Leave a group
 * Removes the current user from the group
 */
export const leaveGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.uid;
    const groupId = validateGroupId(req.params.id);

    try {
        const result = await getGroupMemberService().leaveGroup(userId!, groupId);
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
        const result = await getGroupMemberService().removeGroupMember(userId!, groupId, memberId);
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
