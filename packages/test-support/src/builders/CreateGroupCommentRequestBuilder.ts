
import { toCommentText, toGroupId } from '@billsplit-wl/shared';
import type { CreateGroupCommentRequest, GroupId, CommentText } from '@billsplit-wl/shared';

export class CreateGroupCommentRequestBuilder {
    private request: Partial<CreateGroupCommentRequest> = {};

    constructor() {
        this.request.groupId = toGroupId('group-123');
        this.request.text = toCommentText('Hello, world!');
    }

    withGroupId(groupId: GroupId | string): this {
        this.request.groupId = typeof groupId === 'string' ? toGroupId(groupId) : groupId;
        return this;
    }

    withText(text: CommentText | string): this {
        this.request.text = typeof text === 'string' ? toCommentText(text) : text;
        return this;
    }

    build(): CreateGroupCommentRequest {
        return this.request as CreateGroupCommentRequest;
    }
}
