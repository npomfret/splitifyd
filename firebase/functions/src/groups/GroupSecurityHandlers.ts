import type { GroupId, UserId } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { GroupMemberService } from '../services/GroupMemberService';
import { GroupService } from '../services/GroupService';
import { validateGroupId, validateMemberId, validateUpdateGroupPermissionsRequest, validateUpdateMemberRoleRequest } from './validation';

export class GroupSecurityHandlers {
    constructor(
        private readonly groupService: GroupService,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    private async validateAdminRequest(req: AuthenticatedRequest): Promise<{ userId: UserId; groupId: GroupId; }> {
        const userId = validateUserAuth(req);
        const groupId = validateGroupId(req.params.id);
        await this.groupMemberService.ensureActiveGroupAdmin(groupId, userId);
        return { userId, groupId };
    }

    updateGroupPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId, groupId } = await this.validateAdminRequest(req);
        const updates = validateUpdateGroupPermissionsRequest(req.body);

        const result = await this.groupService.updateGroupPermissions(groupId, userId, updates);
        res.status(HTTP_STATUS.OK).json(result);
    };

    updateMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId, groupId } = await this.validateAdminRequest(req);
        const memberId = validateMemberId(req.params.memberId);
        const { role } = validateUpdateMemberRoleRequest(req.body);

        const result = await this.groupMemberService.updateMemberRole(userId, groupId, memberId, role);
        res.status(HTTP_STATUS.OK).json(result);
    };

    approveMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId, groupId } = await this.validateAdminRequest(req);
        const memberId = validateMemberId(req.params.memberId);

        const result = await this.groupMemberService.approveMember(userId, groupId, memberId);
        res.status(HTTP_STATUS.OK).json(result);
    };

    rejectMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId, groupId } = await this.validateAdminRequest(req);
        const memberId = validateMemberId(req.params.memberId);

        const result = await this.groupMemberService.rejectMember(userId, groupId, memberId);
        res.status(HTTP_STATUS.OK).json(result);
    };

    getPendingMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { userId, groupId } = await this.validateAdminRequest(req);
        const pendingMembers = await this.groupMemberService.getPendingMembers(userId, groupId);

        res.status(HTTP_STATUS.OK).json({
            members: pendingMembers,
        });
    };
}
