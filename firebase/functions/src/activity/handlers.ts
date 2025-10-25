import { getAppBuilder } from '../ApplicationBuilderSingleton';
import { ActivityFeedHandlers } from './ActivityHandlers';

const activityFeedHandlers = ActivityFeedHandlers.createActivityFeedHandlers(getAppBuilder());

export const getActivityFeed = activityFeedHandlers.getActivityFeed.bind(activityFeedHandlers);
