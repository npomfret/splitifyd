import { ActivityFeedActions, ActivityFeedEventTypes } from '@billsplit-wl/shared';
import type { ActivityFeedAction, ActivityFeedEventType, ActivityFeedItem } from '@billsplit-wl/shared';

const EVENT_ACTION_MAP: Record<ActivityFeedEventType, ActivityFeedAction> = {
    [ActivityFeedEventTypes.EXPENSE_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.EXPENSE_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.EXPENSE_DELETED]: ActivityFeedActions.DELETE,
    [ActivityFeedEventTypes.SETTLEMENT_CREATED]: ActivityFeedActions.CREATE,
    [ActivityFeedEventTypes.SETTLEMENT_UPDATED]: ActivityFeedActions.UPDATE,
    [ActivityFeedEventTypes.MEMBER_JOINED]: ActivityFeedActions.JOIN,
    [ActivityFeedEventTypes.MEMBER_LEFT]: ActivityFeedActions.LEAVE,
    [ActivityFeedEventTypes.COMMENT_ADDED]: ActivityFeedActions.COMMENT,
    [ActivityFeedEventTypes.GROUP_UPDATED]: ActivityFeedActions.UPDATE,
};

export function deriveActivityFeedAction(eventType: string | undefined, fallback: ActivityFeedAction = ActivityFeedActions.UPDATE): ActivityFeedAction {
    if (eventType && eventType in EVENT_ACTION_MAP) {
        return EVENT_ACTION_MAP[eventType as ActivityFeedEventType];
    }
    return fallback;
}

export function normalizeActivityFeedItem(item: ActivityFeedItem): ActivityFeedItem {
    if (item.action) {
        return item;
    }

    return {
        ...item,
        action: deriveActivityFeedAction(item.eventType as ActivityFeedEventType),
    };
}
