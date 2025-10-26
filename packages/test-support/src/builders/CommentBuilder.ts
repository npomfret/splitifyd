import type { CommentDTO } from '@splitifyd/shared';
import type { UserId } from '@splitifyd/shared';
import { BuilderTimestamp, generateShortId, randomChoice, randomDate, randomString, timestampToISOString } from '../test-helpers';

export class CommentBuilder {
    private comment: CommentDTO = {
        id: `comment-${generateShortId()}`,
        authorId: `user-${generateShortId()}`,
        authorName: `${randomChoice(['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank'])} ${randomString(4)}`,
        text: `${randomChoice(['Great', 'Awesome', 'Thanks', 'Perfect', 'Nice', 'Cool'])} ${randomString(8)}!`,
        createdAt: randomDate(),
        updatedAt: randomDate(),
    };

    withId(id: string): this {
        this.comment.id = id;
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

    withCreatedAtTimestamp(timestamp: BuilderTimestamp): this {
        this.comment.createdAt = timestampToISOString(timestamp);
        return this;
    }

    withUpdatedAtTimestamp(timestamp: BuilderTimestamp): this {
        this.comment.updatedAt = timestampToISOString(timestamp);
        return this;
    }

    withCreatedAt(date: Date): this {
        this.comment.createdAt = date.toISOString();
        this.comment.updatedAt = date.toISOString();
        return this;
    }

    withUpdatedAt(date: Date): this {
        this.comment.updatedAt = date.toISOString();
        return this;
    }

    withInvalidDate(): this {
        this.comment.createdAt = 'invalid-date';
        return this;
    }

    build(): CommentDTO {
        return { ...this.comment };
    }
}
