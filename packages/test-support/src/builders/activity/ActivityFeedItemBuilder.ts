import type { ActivityFeedAction, ActivityFeedEventType, ActivityFeedItem, GroupId, GroupName, UserId } from '@splitifyd/shared';
import { ActivityFeedActions, ActivityFeedEventTypes, toGroupId } from '@splitifyd/shared';
import { generateShortId, randomString } from '../../test-helpers';
import {toExpenseId} from "@splitifyd/shared";
import {CommentId, toCommentId} from "@splitifyd/shared";

const DEFAULT_TIMESTAMP = () => new Date().toISOString();

const generateActorId = (actorName: string | undefined, seed: string): string => {
    if (!actorName) {
        return `actor-${seed}`;
    }

    const normalized = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `actor-${normalized || 'user'}-${seed}`;
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
        const id = `activity-${generateShortId()}`;
        const timestamp = DEFAULT_TIMESTAMP();
        const actorName = 'Test User';

        const base: ActivityFeedItem = {
            id,
            userId: `user-${generateShortId()}` as UserId,
            groupId: toGroupId(`group-${generateShortId()}`),
            groupName: `Group ${randomString(5)}` as GroupName,
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

    static from(item: ActivityFeedItem): ActivityFeedItemBuilder {
        return new ActivityFeedItemBuilder(cloneItem(item));
    }

    static forEvent(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: GroupName,
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
        groupName: string,
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

    static expenseUpdated(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.EXPENSE_UPDATED,
            ActivityFeedActions.UPDATE,
            actorName,
            {
                expenseId: toExpenseId(`${id}-expense`),
                expenseDescription,
            },
        );
    }

    static expenseDeleted(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.EXPENSE_DELETED,
            ActivityFeedActions.DELETE,
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
        groupName: string,
        actorName: string,
        targetUserName: string,
        targetUserId: string = `member-${id}`,
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
        groupName: string,
        actorName: string,
        targetUserName: string,
        targetUserId: string = `member-${id}`,
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
        groupName: string,
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
        groupName: string,
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
                settlementId: `${id}-settlement`,
                settlementDescription,
            },
        );
    }

    static settlementUpdated(
        id: string,
        userId: UserId,
        groupId: GroupId | string,
        groupName: string,
        actorName: string,
        settlementDescription: string,
    ): ActivityFeedItemBuilder {
        return this.forEvent(
            id,
            userId,
            groupId,
            groupName,
            ActivityFeedEventTypes.SETTLEMENT_UPDATED,
            ActivityFeedActions.UPDATE,
            actorName,
            {
                settlementId: `${id}-settlement`,
                settlementDescription,
            },
        );
    }

    withId(id: string): ActivityFeedItemBuilder {
        this.item.id = id;
        this.ensureActorId();
        return this;
    }

    withUserId(userId: UserId): ActivityFeedItemBuilder {
        this.item.userId = userId;
        return this;
    }

    withGroupId(groupId: GroupId | string): ActivityFeedItemBuilder {
        this.item.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withGroupName(groupName: string): ActivityFeedItemBuilder {
        this.item.groupName = groupName;
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

    withActorId(actorId: string): ActivityFeedItemBuilder {
        this.item.actorId = actorId;
        return this;
    }

    withTimestamp(timestamp: string): ActivityFeedItemBuilder {
        this.item.timestamp = timestamp;
        return this;
    }

    withCreatedAt(createdAt: string | undefined): ActivityFeedItemBuilder {
        this.item.createdAt = createdAt;
        return this;
    }

    withDetails(details: ActivityFeedItem['details']): ActivityFeedItemBuilder {
        this.item.details = cloneDetails(details);
        return this;
    }

    mergeDetails(details: ActivityFeedItem['details']): ActivityFeedItemBuilder {
        this.item.details = { ...this.item.details, ...details };
        return this;
    }

    build(): ActivityFeedItem {
        return cloneItem(this.item);
    }

    private ensureActorId(): void {
        this.item.actorId = generateActorId(this.item.actorName, this.item.id);
    }
}
