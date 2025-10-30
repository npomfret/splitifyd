import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { GroupMemberService } from '../services/GroupMemberService';
import { logger } from '../utils/contextual-logger';
import { validateGroupId } from './validation';

export class GroupMemberHandlers {
    constructor(private readonly groupMemberService: GroupMemberService) {
    }

    leaveGroup = async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.uid;
        const groupId = validateGroupId(req.params.id);

        try {
            const result = await this.groupMemberService.leaveGroup(userId!, groupId);
            res.json(result);
        } catch (error) {
            logger.error('Error in leaveGroup', error, {
                groupId,
                userId,
            });
            throw error;
        }
    };

    removeGroupMember = async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.uid;
        const groupId = validateGroupId(req.params.id);
        const memberId = req.params.memberId;

        try {
            const result = await this.groupMemberService.removeGroupMember(userId!, groupId, memberId);
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

    archiveGroupForUser = async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.uid;
        const groupId = validateGroupId(req.params.id);

        try {
            const result = await this.groupMemberService.archiveGroupForUser(groupId, userId!);
            res.json(result);
        } catch (error) {
            logger.error('Error in archiveGroupForUser', error, {
                groupId,
                userId,
            });
            throw error;
        }
    };

    unarchiveGroupForUser = async (req: AuthenticatedRequest, res: Response) => {
        const userId = req.user?.uid;
        const groupId = validateGroupId(req.params.id);

        try {
            const result = await this.groupMemberService.unarchiveGroupForUser(groupId, userId!);
            res.json(result);
        } catch (error) {
            logger.error('Error in unarchiveGroupForUser', error, {
                groupId,
                userId,
            });
            throw error;
        }
    };
}
