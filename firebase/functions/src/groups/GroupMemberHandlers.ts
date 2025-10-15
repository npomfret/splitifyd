import {GroupMemberService} from "../services/GroupMemberService";
import {ApplicationBuilder} from "../services/ApplicationBuilder";
import {getAuth, getFirestore} from "../firebase";
import {AuthenticatedRequest} from "../auth/middleware";
import {Response} from "express";
import {validateGroupId} from "./validation";
import {logger} from "../utils/contextual-logger";

export class GroupMemberHandlers {
    constructor(private readonly groupMemberService: GroupMemberService) {
    }

    static createGroupMemberHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth())) {
        const groupMemberService = applicationBuilder.buildGroupMemberService();
        return new GroupMemberHandlers(groupMemberService)
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
    }

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
    }
}