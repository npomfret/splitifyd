import type { GenerateShareLinkRequest } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { GroupShareService } from '../services/GroupShareService';
import { logger } from '../utils/contextual-logger';
import { ApiError } from '../utils/errors';

export class GroupShareHandlers {
    constructor(private readonly groupShareService: GroupShareService) {
        if (!this.groupShareService.generateShareableLink) {
            throw Error();
        }
    }

    generateShareableLink = async (req: AuthenticatedRequest, res: Response) => {
        const body = (req.body ?? {}) as Partial<GenerateShareLinkRequest>;
        const { groupId } = body;
        if (!groupId || typeof groupId !== 'string') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_GROUP_ID', 'Group ID is required');
        }

        const validGroupId = toGroupId(groupId);
        const sanitizedExpiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : undefined;
        const userId = req.user!.uid;

        try {
            if (!this.groupShareService.generateShareableLink) {
                throw Error();
            }
            const result = await this.groupShareService.generateShareableLink(userId, validGroupId, sanitizedExpiresAt);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            if (error instanceof ApiError) throw error;

            logger.error('Error generating shareable link', error, {
                groupId: validGroupId,
                userId,
            });

            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to generate shareable link');
        }
    };

    previewGroupByLink = async (req: AuthenticatedRequest, res: Response) => {
        const { linkId } = req.body;
        const userId = req.user!.uid;

        try {
            const result = await this.groupShareService.previewGroupByLink(userId, linkId);
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            if (error instanceof ApiError) throw error;

            logger.error('Error previewing group by link', error, {
                linkId: linkId?.substring(0, 4) + '...',
                userId,
            });

            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to preview group');
        }
    };

    joinGroupByLink = async (req: AuthenticatedRequest, res: Response) => {
        const { linkId, groupDisplayName } = req.body;
        const userId = req.user!.uid;

        if (!linkId || typeof linkId !== 'string') {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_LINK_ID', 'Link ID is required');
        }

        if (!groupDisplayName || typeof groupDisplayName !== 'string' || groupDisplayName.trim().length === 0) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_DISPLAY_NAME', 'Group display name is required');
        }

        try {
            const result = await this.groupShareService.joinGroupByLink(userId, linkId, groupDisplayName.trim());
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            if (error instanceof ApiError) throw error;

            logger.error('Error joining group by link', error, {
                linkId: linkId?.substring(0, 4) + '...',
                userId,
            });

            throw new ApiError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', 'Failed to join group');
        }
    };
}
