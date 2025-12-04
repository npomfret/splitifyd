import type { ActivityFeedItem } from '@billsplit-wl/shared';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { Errors } from '../errors';
import { logger } from '../logger';
import { ActivityFeedService } from '../services/ActivityFeedService';
import type { IFirestoreReader } from '../services/firestore';
import { validateGroupIdParam } from '../validation/common/id-validators';
import { validateActivityFeedQuery } from './validation';

interface ActivityFeedResponse {
    items: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor?: string;
}

export class ActivityFeedHandlers {
    constructor(
        private readonly activityFeedService: ActivityFeedService,
        private readonly firestoreReader: IFirestoreReader,
    ) {}

    getActivityFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const { limit, cursor } = validateActivityFeedQuery(req.query);

        try {
            const result = await this.activityFeedService.getActivityFeedForUser(userId, { limit, cursor });

            const response: ActivityFeedResponse = {
                items: result.items,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
            };

            res.status(HTTP_STATUS.OK).json(response);
        } catch (error) {
            logger.error('Failed to fetch activity feed', error as Error, {
                userId,
            });
            throw error;
        }
    };

    getGroupActivityFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const userId = validateUserAuth(req);
        const groupId = validateGroupIdParam(req.params);
        const { limit, cursor } = validateActivityFeedQuery(req.query);

        // Verify user is a member of the group
        const isMember = await this.firestoreReader.verifyGroupMembership(groupId, userId);
        if (!isMember) {
            throw Errors.forbidden('group');
        }

        try {
            const result = await this.activityFeedService.getActivityFeedForGroup(groupId, { limit, cursor });

            const response: ActivityFeedResponse = {
                items: result.items,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
            };

            res.status(HTTP_STATUS.OK).json(response);
        } catch (error) {
            logger.error('Failed to fetch group activity feed', error as Error, {
                userId,
                groupId,
            });
            throw error;
        }
    };
}
