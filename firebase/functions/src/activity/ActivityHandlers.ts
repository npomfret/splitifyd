import type { ActivityFeedItem } from '@billsplit-wl/shared';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { HTTP_STATUS } from '../constants';
import { logger } from '../logger';
import { ActivityFeedService } from '../services/ActivityFeedService';
import { validateActivityFeedQuery } from './validation';

interface ActivityFeedResponse {
    items: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor?: string;
}

export class ActivityFeedHandlers {
    constructor(private readonly activityFeedService: ActivityFeedService) {}

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
}
