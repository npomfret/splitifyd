import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { ApplicationBuilder } from '../services/ApplicationBuilder';
import { GroupMemberService } from '../services/GroupMemberService';
import { GroupService } from '../services/GroupService';
import { Errors } from '../utils/errors';
import {
    validateApplySecurityPreset,
    validateGroupId,
    validateMemberId,
    validateUpdateGroupPermissionsRequest,
    validateUpdateMemberRoleRequest,
} from './validation';

export class GroupSecurityHandlers {
    constructor(
        private readonly groupService: GroupService,
        private readonly groupMemberService: GroupMemberService,
    ) {}

    static createGroupSecurityHandlers(applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth())) {
        const groupService = applicationBuilder.buildGroupService();
        const groupMemberService = applicationBuilder.buildGroupMemberService();
        return new GroupSecurityHandlers(groupService, groupMemberService);
    }

    applySecurityPreset = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const { preset } = validateApplySecurityPreset(req.body);

        const result = await this.groupService.applyPermissionPreset(groupId, userId, preset);
        res.status(HTTP_STATUS.OK).json(result);
    };

    updateGroupPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const updates = validateUpdateGroupPermissionsRequest(req.body);

        const result = await this.groupService.updateGroupPermissions(groupId, userId, updates);
        res.status(HTTP_STATUS.OK).json(result);
    };

    updateMemberRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const memberId = validateMemberId(req.params.memberId);
        const { role } = validateUpdateMemberRoleRequest(req.body);

        const result = await this.groupMemberService.updateMemberRole(userId, groupId, memberId, role);
        res.status(HTTP_STATUS.OK).json(result);
    };

    approveMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const memberId = validateMemberId(req.params.memberId);

        const result = await this.groupMemberService.approveMember(userId, groupId, memberId);
        res.status(HTTP_STATUS.OK).json(result);
    };

    rejectMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const memberId = validateMemberId(req.params.memberId);

        const result = await this.groupMemberService.rejectMember(userId, groupId, memberId);
        res.status(HTTP_STATUS.OK).json(result);
    };

    getPendingMembers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = req.user?.uid;
        if (!userId) {
            throw Errors.UNAUTHORIZED();
        }

        const groupId = validateGroupId(req.params.id);
        const pendingMembers = await this.groupMemberService.getPendingMembers(userId, groupId);

        res.status(HTTP_STATUS.OK).json({
            members: pendingMembers,
        });
    };
}
