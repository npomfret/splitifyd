import { getActivityFeedHandlers } from './ActivityHandlers';

const activityFeedHandlers = getActivityFeedHandlers();

export const getActivityFeed = activityFeedHandlers.getActivityFeed.bind(activityFeedHandlers);
