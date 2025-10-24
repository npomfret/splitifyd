import type { ActivityFeedItem } from '@splitifyd/shared';
import type { Response } from 'express';
import { getAppBuilder } from '../ApplicationBuilderSingleton';
import type { AuthenticatedRequest } from '../auth/middleware';
import { validateUserAuth } from '../auth/utils';
import { getIdentityToolkitConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import { getAuth, getFirestore } from '../firebase';
import { logger } from '../logger';
import { ActivityFeedService } from '../services/ActivityFeedService';
import { ApplicationBuilder } from '../services/ApplicationBuilder';

interface ActivityFeedQuery {
    limit?: number;
    cursor?: string;
}

interface ActivityFeedResponse {
    items: ActivityFeedItem[];
    hasMore: boolean;
    nextCursor?: string;
}

export class ActivityFeedHandlers {
    constructor(private readonly activityFeedService: ActivityFeedService) {}

    static createActivityFeedHandlers(applicationBuilder: ApplicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), getIdentityToolkitConfig())) {
        const activityFeedService = applicationBuilder.buildActivityFeedService();
        return new ActivityFeedHandlers(activityFeedService);
    }

    async getActivityFeed(req: AuthenticatedRequest, res: Response): Promise<void> {
        const userId = validateUserAuth(req);
        const { limit, cursor } = this.parseQuery(req.query);

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
    }

    private parseQuery(query: Record<string, unknown>): ActivityFeedQuery {
        const result: ActivityFeedQuery = {};

        if (typeof query.limit === 'string') {
            const parsedLimit = parseInt(query.limit, 10);
            if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
                result.limit = parsedLimit;
            }
        }

        if (typeof query.cursor === 'string' && query.cursor.trim().length > 0) {
            result.cursor = query.cursor;
        }

        return result;
    }
}

export function getActivityFeedHandlers() {
    const appBuilder = getAppBuilder();
    const activityFeedService = appBuilder.buildActivityFeedService();
    return new ActivityFeedHandlers(activityFeedService);
}
