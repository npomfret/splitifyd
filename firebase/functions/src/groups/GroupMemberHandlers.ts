import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { getIdentityToolkitConfig } from '../client-config';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { GroupMemberService } from '../services/GroupMemberService';
import { logger } from '../utils/contextual-logger';
import { validateGroupId } from './validation';

export class GroupMemberHandlers {
    constructor(private readonly groupMemberService: GroupMemberService) {
    }

    static createGroupMemberHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const groupMemberService = applicationBuilder.buildGroupMemberService();
        return new GroupMemberHandlers(groupMemberService);
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
}
