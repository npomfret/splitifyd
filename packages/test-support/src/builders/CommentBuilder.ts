import type { CommentDTO, ISOString } from '@splitifyd/shared';
import type { UserId, CommentId } from '@splitifyd/shared';
import { toCommentId } from '@splitifyd/shared';
import {convertToISOString, generateShortId, randomChoice, randomDate, randomString} from '../test-helpers';

export class CommentBuilder {
    private comment: CommentDTO = {
        id: toCommentId(`comment-${generateShortId()}`),
        authorId: `user-${generateShortId()}`,
        authorName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        text: `${randomChoice(['Great', 'Awesome', 'Thanks', 'Perfect', 'Nice', 'Cool'])} ${randomString(8)}!`,
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

    withText(text: string): this {
        this.comment.text = text;
        return this;
    }

    withAuthorId(userId: UserId): this {
        this.comment.authorId = userId;
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

    build(): CommentDTO {
        return { ...this.comment };
    }
}
