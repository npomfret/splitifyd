import { type ActivityFeedAction, ActivityFeedActions, type ActivityFeedEventType, ActivityFeedEventTypes, type ActivityFeedItem } from '@splitifyd/shared';

const DEFAULT_TIMESTAMP = () => new Date().toISOString();

const generateActorId = (actorName: string | undefined, seed: string): string => {
    if (!actorName) {
        return `actor-${seed}`;
    }

    const normalized = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `actor-${normalized || 'user'}-${seed}`;
};

export class ActivityFeedItemDTOBuilder {
    private readonly item: ActivityFeedItem;

    private constructor(item: ActivityFeedItem) {
        this.item = item;
    }

    static forEvent(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        eventType: ActivityFeedEventType,
        action: ActivityFeedAction,
        actorName: string,
        details: ActivityFeedItem['details'] = {},
    ): ActivityFeedItemDTOBuilder {
        const timestamp = DEFAULT_TIMESTAMP();

        return new ActivityFeedItemDTOBuilder({
            id,
            userId,
            groupId,
            groupName,
            eventType,
            action,
            actorName,
            actorId: generateActorId(actorName, id),
            timestamp,
            createdAt: timestamp,
            details,
        });
    }

    static expenseCreated(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.EXPENSE_CREATED, ActivityFeedActions.CREATE, actorName, {
            expenseId: `${id}-expense`,
            expenseDescription,
        });
    }

    static expenseUpdated(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.EXPENSE_UPDATED, ActivityFeedActions.UPDATE, actorName, {
            expenseId: `${id}-expense`,
            expenseDescription,
        });
    }

    static expenseDeleted(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        expenseDescription: string,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.EXPENSE_DELETED, ActivityFeedActions.DELETE, actorName, {
            expenseId: `${id}-expense`,
            expenseDescription,
        });
    }

    static memberJoined(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        targetUserName: string,
        targetUserId: string = `member-${id}`,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.MEMBER_JOINED, ActivityFeedActions.JOIN, actorName, {
            targetUserId,
            targetUserName,
        });
    }

    static memberLeft(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        targetUserName: string,
        targetUserId: string = `member-${id}`,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.MEMBER_LEFT, ActivityFeedActions.LEAVE, actorName, {
            targetUserId,
            targetUserName,
        });
    }

    static commentAdded(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        commentPreview: string,
        expenseDescription?: string,
        commentId: string = `comment-${id}`,
    ): ActivityFeedItemDTOBuilder {
        const details: ActivityFeedItem['details'] = {
            commentId,
            commentPreview,
        };

        if (expenseDescription) {
            details.expenseId = `${id}-expense`;
            details.expenseDescription = expenseDescription;
        }

        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.COMMENT_ADDED, ActivityFeedActions.COMMENT, actorName, details);
    }

    static settlementCreated(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        settlementDescription: string,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.SETTLEMENT_CREATED, ActivityFeedActions.CREATE, actorName, {
            settlementId: `${id}-settlement`,
            settlementDescription,
        });
    }

    static settlementUpdated(
        id: string,
        userId: string,
        groupId: string,
        groupName: string,
        actorName: string,
        settlementDescription: string,
    ): ActivityFeedItemDTOBuilder {
        return this.forEvent(id, userId, groupId, groupName, ActivityFeedEventTypes.SETTLEMENT_UPDATED, ActivityFeedActions.UPDATE, actorName, {
            settlementId: `${id}-settlement`,
            settlementDescription,
        });
    }

    withActorId(actorId: string): ActivityFeedItemDTOBuilder {
        this.item.actorId = actorId;
        return this;
    }

    withActorName(actorName: string): ActivityFeedItemDTOBuilder {
        this.item.actorName = actorName;
        this.item.actorId = generateActorId(actorName, this.item.id);
        return this;
    }

    withTimestamp(timestamp: string): ActivityFeedItemDTOBuilder {
        this.item.timestamp = timestamp;
        return this;
    }

    withCreatedAt(createdAt: string | undefined): ActivityFeedItemDTOBuilder {
        this.item.createdAt = createdAt;
        return this;
    }

    withDetails(details: ActivityFeedItem['details']): ActivityFeedItemDTOBuilder {
        this.item.details = { ...details };
        return this;
    }

    mergeDetails(details: ActivityFeedItem['details']): ActivityFeedItemDTOBuilder {
        this.item.details = { ...this.item.details, ...details };
        return this;
    }

    withGroupName(groupName: string): ActivityFeedItemDTOBuilder {
        this.item.groupName = groupName;
        return this;
    }

    withAction(action: ActivityFeedAction): ActivityFeedItemDTOBuilder {
        this.item.action = action;
        return this;
    }

    withEventType(eventType: ActivityFeedEventType): ActivityFeedItemDTOBuilder {
        this.item.eventType = eventType;
        return this;
    }

    withUserId(userId: string): ActivityFeedItemDTOBuilder {
        this.item.userId = userId;
        return this;
    }

    withGroupId(groupId: string): ActivityFeedItemDTOBuilder {
        this.item.groupId = groupId;
        return this;
    }

    build(): ActivityFeedItem {
        return {
            ...this.item,
            details: { ...this.item.details },
        };
    }
}
