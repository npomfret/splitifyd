import type { CommentAttachmentRef, CommentDTO, CommentText, ISOString, ReactionCounts, ReactionEmoji, UserReactionsMap } from '@billsplit-wl/shared';
import type { CommentId, UserId } from '@billsplit-wl/shared';
import { toCommentId, toCommentText } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { convertToISOString, generateShortId, randomChoice, randomDate, randomString } from '../test-helpers';

export class CommentBuilder {
    private comment: CommentDTO = {
        id: toCommentId(`comment-${generateShortId()}`),
        authorId: toUserId(`user-${generateShortId()}`),
        authorName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        text: toCommentText(`${randomChoice(['Great', 'Awesome', 'Thanks', 'Perfect', 'Nice', 'Cool'])} ${randomString(8)}!`),
        createdAt: convertToISOString(randomDate()),
        updatedAt: convertToISOString(randomDate()),
    };

    withId(id: CommentId | string): this {
        this.comment.id = typeof id === 'string' ? toCommentId(id) : id;
        return this;
    }

    withAuthor(authorId: UserId, authorName: string): this {
        this.comment.authorId = authorId;
        this.comment.authorName = authorName;
        return this;
    }

    withText(text: CommentText | string): this {
        this.comment.text = typeof text === 'string' ? toCommentText(text) : text;
        return this;
    }

    withAuthorId(userId: UserId | string): this {
        this.comment.authorId = typeof userId === 'string' ? toUserId(userId) : userId;
        return this;
    }

    withAuthorName(name: string): this {
        this.comment.authorName = name;
        return this;
    }

    withAvatar(avatar: string | null): this {
        this.comment.authorAvatar = avatar === null ? undefined : avatar;
        return this;
    }

    withCreatedAtTimestamp(timestamp: Date | string | ISOString): this {
        this.comment.createdAt = convertToISOString(timestamp);
        return this;
    }

    withUpdatedAtTimestamp(timestamp: Date | string | ISOString): this {
        this.comment.updatedAt = convertToISOString(timestamp);
        return this;
    }

    withCreatedAt(timestamp: Date | string | ISOString): this {
        this.comment.createdAt = convertToISOString(timestamp);
        this.comment.updatedAt = convertToISOString(timestamp);
        return this;
    }

    withUpdatedAt(timestamp: Date | string | ISOString): this {
        this.comment.updatedAt = convertToISOString(timestamp);
        return this;
    }

    withInvalidDate(): this {
        this.comment.createdAt = convertToISOString('invalid-date');
        return this;
    }

    withReactionCounts(reactionCounts: ReactionCounts): this {
        this.comment.reactionCounts = reactionCounts;
        return this;
    }

    withUserReactions(userReactions: UserReactionsMap): this {
        this.comment.userReactions = userReactions;
        return this;
    }

    withAttachments(attachments: CommentAttachmentRef[]): this {
        this.comment.attachments = attachments;
        return this;
    }

    build(): CommentDTO {
        return { ...this.comment };
    }
}
