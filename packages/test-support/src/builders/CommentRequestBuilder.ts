import { CommentTargetTypes } from '@splitifyd/shared';
import type { CreateCommentRequest } from '@splitifyd/shared';
import {GroupId} from "@splitifyd/shared";

/**
 * Builder for creating comment request objects for testing
 * Used for validating comment creation and handling various edge cases
 *
 * Note: Some methods use 'any' casts intentionally to create invalid test data
 * for validation testing. This is acceptable in test builders.
 */
export class CommentRequestBuilder {
    private request: Partial<CreateCommentRequest> = {};

    /**
     * Copy data from an existing comment request object
     */
    from(data: CreateCommentRequest | Record<string, unknown>): this {
        this.request = { ...data };
        return this;
    }

    withText(text: string | null | undefined): this {
        (this.request as any).text = text;
        return this;
    }

    withTargetType(targetType: string | number | null | undefined): this {
        (this.request as any).targetType = targetType;
        return this;
    }

    withGroupTarget(targetId: string): this {
        this.request.targetType = CommentTargetTypes.GROUP;
        this.request.targetId = targetId;
        return this;
    }

    withExpenseTarget(targetId: string, groupId: GroupId): this {
        this.request.targetType = CommentTargetTypes.EXPENSE;
        this.request.targetId = targetId;
        this.request.groupId = groupId;
        return this;
    }

    withTargetId(targetId: string | null | undefined): this {
        (this.request as any).targetId = targetId;
        return this;
    }

    withGroupId(groupId: GroupId | undefined): this {
        this.request.groupId = groupId;
        return this;
    }

    withLongText(length: number = 501): this {
        this.request.text = 'a'.repeat(length);
        return this;
    }

    withWhitespaceText(text: string = 'test'): this {
        this.request.text = `  ${text}  `;
        return this;
    }

    withXSSText(): this {
        this.request.text = '<script>alert("xss")</script>Safe text';
        return this;
    }

    withXSSTargetId(): this {
        (this.request as any).targetId = '<script>group123</script>';
        return this;
    }

    withMissingField(field: keyof CreateCommentRequest): this {
        delete this.request[field];
        return this;
    }

    withEmptyField(field: keyof CreateCommentRequest): this {
        (this.request as any)[field] = '';
        return this;
    }

    build(): CreateCommentRequest {
        return { ...this.request } as CreateCommentRequest;
    }
}
