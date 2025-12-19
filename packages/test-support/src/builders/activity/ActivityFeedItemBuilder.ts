import {
    ActivityFeedAction,
    ActivityFeedActions,
    ActivityFeedEventType,
    ActivityFeedEventTypes,
    ActivityFeedItem,
    ActivityFeedItemId,
    CommentId,
    GroupId,
    GroupName,
    ISOString,
    toActivityFeedItemId,
    toCommentId,
    toExpenseId,
    toGroupId,
    toGroupName,
    toSettlementId,
    toUserId,
    UserId,
} from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomString } from '../../test-helpers';

const DEFAULT_TIMESTAMP = () => new Date().toISOString();

const generateActorId = (actorName: string | undefined, seed: string): UserId => {
    if (!actorName) {
        return toUserId(`actor-${seed}`);
    }

    const normalized = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return toUserId(`actor-${normalized || 'user'}-${seed}`);
};

const cloneDetails = (details: ActivityFeedItem['details']): ActivityFeedItem['details'] => ({
    ...details,
});

const cloneItem = (item: ActivityFeedItem): ActivityFeedItem => ({
    ...item,
    details: cloneDetails(item.details),
});

export class ActivityFeedItemBuilder {
    private readonly item: ActivityFeedItem;

    private constructor(item: ActivityFeedItem) {
        this.item = item;
    }

    static create(): ActivityFeedItemBuilder {
        const id = toActivityFeedItemId(`activity-${generateShortId()}`);
        const timestamp = convertToISOString(DEFAULT_TIMESTAMP());
        const actorName = 'Test User';

        const base: ActivityFeedItem = {
            id,
            userId: `user-${generateShortId()}` as UserId,
            groupId: toGroupId(`group-${generateShortId()}`),
            groupName: toGroupName(`Group ${randomString(5)}`),
            eventType: ActivityFeedEventTypes.EXPENSE_CREATED,
            action: ActivityFeedActions.CREATE,
            actorId: generateActorId(actorName, id),
            actorName,
            timestamp,
            createdAt: timestamp,
            details: {},
        };

        return new ActivityFeedItemBuilder(base);
    }

    static forEvent(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        eventType: ActivityFeedEventType,
        action: ActivityFeedAction,
        actorName: string,
        details: ActivityFeedItem['details'] = {},
    ): ActivityFeedItemBuilder {
        return ActivityFeedItemBuilder
            .create()
            .withId(id)
            .withUserId(userId)
            .withGroupId(groupId)
            .withGroupName(groupName)
            .withEventType(eventType)
            .withAction(action)
            .withActorName(actorName)
            .withDetails(details)
            .withTimestamp(DEFAULT_TIMESTAMP())
            .withCreatedAt(DEFAULT_TIMESTAMP());
    }

    static expenseCreated(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.EXPENSE_CREATED,
            ActivityFeedActions.CREATE,
            actorName,
            {
                expenseId: toExpenseId(`${id}-expense`),
                expenseDescription,
            },
        );
    }

    static memberJoined(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
        targetUserName: string,
        targetUserId: UserId = toUserId(`member-${id}`),
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.MEMBER_JOINED,
            ActivityFeedActions.JOIN,
            actorName,
            {
                targetUserId,
                targetUserName,
            },
        );
    }

    static memberLeft(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
        targetUserName: string,
        targetUserId: UserId = toUserId(`member-${id}`),
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.MEMBER_LEFT,
            ActivityFeedActions.LEAVE,
            actorName,
            {
                targetUserId,
                targetUserName,
            },
        );
    }

    static commentAdded(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
        commentPreview: string,
        expenseDescription?: string,
        commentId: CommentId = toCommentId(`comment-${id}`),
    ): ActivityFeedItemBuilder {
        const details: ActivityFeedItem['details'] = {
            commentId,
            commentPreview,
        };

        if (expenseDescription) {
            details.expenseId = toExpenseId(`${id}-expense`);
            details.expenseDescription = expenseDescription;
        }

        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.COMMENT_ADDED,
            ActivityFeedActions.COMMENT,
            actorName,
            details,
        );
    }

    static settlementCreated(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
        settlementDescription: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.SETTLEMENT_CREATED,
            ActivityFeedActions.CREATE,
            actorName,
            {
                settlementId: toSettlementId(`${id}-settlement`),
                settlementDescription,
            },
        );
    }

    static groupCreated(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName | string,
        actorName: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.GROUP_CREATED,
            ActivityFeedActions.CREATE,
            actorName,
            {},
        );
    }

    withId(id: string | ActivityFeedItemId): ActivityFeedItemBuilder {
        this.item.id = typeof id === 'string' ? toActivityFeedItemId(id) : id;
        this.ensureActorId();
        return this;
    }

    withUserId(userId: UserId | string): ActivityFeedItemBuilder {
        this.item.userId = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withGroupId(groupId: GroupId | string): ActivityFeedItemBuilder {
        this.item.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withGroupName(groupName: GroupName | string): ActivityFeedItemBuilder {
        this.item.groupName = typeof groupName === 'string' ? toGroupName(groupName) : groupName;
        return this;
    }

    withEventType(eventType: ActivityFeedEventType): ActivityFeedItemBuilder {
        this.item.eventType = eventType;
        return this;
    }

    withAction(action: ActivityFeedAction): ActivityFeedItemBuilder {
        this.item.action = action;
        return this;
    }

    withActorName(actorName: string): ActivityFeedItemBuilder {
        this.item.actorName = actorName;
        this.ensureActorId();
        return this;
    }

    withActorId(actorId: UserId | string): ActivityFeedItemBuilder {
        this.item.actorId = typeof actorId === 'string' ? toUserId(actorId) : actorId;
        return this;
    }

    withTimestamp(timestamp: string | Date | ISOString): ActivityFeedItemBuilder {
        this.item.timestamp = convertToISOString(timestamp);
        return this;
    }

    withCreatedAt(createdAt: string | Date | ISOString): ActivityFeedItemBuilder {
        this.item.createdAt = convertToISOString(createdAt);
        return this;
    }

    withDetails(details: ActivityFeedItem['details']): ActivityFeedItemBuilder {
        this.item.details = cloneDetails(details);
        return this;
    }

    build(): ActivityFeedItem {
        return cloneItem(this.item);
    }

    private ensureActorId(): void {
        this.item.actorId = generateActorId(this.item.actorName, this.item.id);
    }
}
