import { CommentTargetTypes } from '@splitifyd/shared';
import type { CreateCommentRequest } from '@splitifyd/shared';

/**
 * Builder for creating comment request objects for testing
 * Used for validating comment creation and handling various edge cases
 */
export class CommentRequestBuilder {
    private request: Record<string, unknown> = {};

    /**
     * Copy data from an existing comment request object
     */
    from(data: CreateCommentRequest | Record<string, unknown>): this {
        this.request = { ...data };
        return this;
    }

    withText(text: string | null | undefined) {
        this.request.text = text;
        return this;
    }

    withTargetType(targetType: string | number | null | undefined) {
        this.request.targetType = targetType;
        return this;
    }

    withGroupTarget(targetId: string) {
        this.request.targetType = CommentTargetTypes.GROUP;
        this.request.targetId = targetId;
        return this;
    }

    withExpenseTarget(targetId: string, groupId: string) {
        this.request.targetType = CommentTargetTypes.EXPENSE;
        this.request.targetId = targetId;
        this.request.groupId = groupId;
        return this;
    }

    withTargetId(targetId: string | null | undefined) {
        this.request.targetId = targetId;
        return this;
    }

    withGroupId(groupId: string | undefined) {
        this.request.groupId = groupId;
        return this;
    }

    withLongText(length: number = 501) {
        this.request.text = 'a'.repeat(length);
        return this;
    }

    withWhitespaceText(text: string = 'test') {
        this.request.text = `  ${text}  `;
        return this;
    }

    withXSSText() {
        this.request.text = '<script>alert("xss")</script>Safe text';
        return this;
    }

    withXSSTargetId() {
        this.request.targetId = '<script>group123</script>';
        return this;
    }

    withMissingField(field: string) {
        delete this.request[field];
        return this;
    }

    withEmptyField(field: string) {
        this.request[field] = '';
        return this;
    }

    build() {
        return { ...this.request };
    }
}
