import type { CommentApiResponse } from '@splitifyd/shared';
import { 
    randomString, 
    randomChoice, 
    randomDate, 
    generateShortId
} from '../test-helpers';

export class CommentBuilder {
    private comment: CommentApiResponse = {
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

    withAuthor(authorId: string, authorName: string): this {
        this.comment.authorId = authorId;
        this.comment.authorName = authorName;
        return this;
    }

    withText(text: string): this {
        this.comment.text = text;
        return this;
    }

    withAvatar(avatar: string): this {
        this.comment.authorAvatar = avatar;
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

    build(): CommentApiResponse {
        return { ...this.comment };
    }
}