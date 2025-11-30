import type { GenerateShareLinkRequest } from '@billsplit-wl/shared';
import { toDisplayName, toGroupId, toShareLinkToken } from '@billsplit-wl/shared';
import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/middleware';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { GroupShareService } from '../services/GroupShareService';
import { logger } from '../utils/contextual-logger';

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
            throw Errors.validationError('groupId', 'INVALID_GROUP_ID');
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
            logger.error('Error generating shareable link', error, {
                groupId: validGroupId,
                userId,
            });

            throw error;
        }
    };

    previewGroupByLink = async (req: AuthenticatedRequest, res: Response) => {
        const { shareToken } = req.body;
        const userId = req.user!.uid;

        try {
            const result = await this.groupShareService.previewGroupByLink(userId, toShareLinkToken(shareToken));
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Error previewing group by link', error, {
                shareToken: shareToken?.substring(0, 4) + '...',
                userId,
            });

            throw error;
        }
    };

    joinGroupByLink = async (req: AuthenticatedRequest, res: Response) => {
        const { shareToken, groupDisplayName } = req.body;
        const userId = req.user!.uid;

        if (!shareToken || typeof shareToken !== 'string') {
            throw Errors.validationError('shareToken', 'MISSING_FIELD');
        }

        if (!groupDisplayName || typeof groupDisplayName !== 'string' || groupDisplayName.trim().length === 0) {
            throw Errors.validationError('groupDisplayName', 'MISSING_FIELD');
        }

        try {
            const result = await this.groupShareService.joinGroupByLink(userId, toShareLinkToken(shareToken), toDisplayName(groupDisplayName.trim()));
            res.status(HTTP_STATUS.OK).json(result);
        } catch (error) {
            logger.error('Error joining group by link', error, {
                shareToken: shareToken?.substring(0, 4) + '...',
                userId,
            });

            throw error;
        }
    };
}
