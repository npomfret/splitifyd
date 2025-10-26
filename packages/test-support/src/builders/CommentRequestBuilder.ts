import { CommentTargetTypes } from '@splitifyd/shared';
import type { CreateCommentRequest, CreateExpenseCommentRequest, CreateGroupCommentRequest } from '@splitifyd/shared';
import type { ExpenseId } from '@splitifyd/shared';
import { GroupId } from '@splitifyd/shared';

/**
 * Builder for creating comment request objects for testing
 * Used for validating comment creation and handling various edge cases
 *
 * Note: Some methods use 'any' casts intentionally to create invalid test data
 * for validation testing. This is acceptable in test builders.
 */
export class CommentRequestBuilder {
    private request: Partial<CreateCommentRequest> = {};
    private targetKind: 'group' | 'expense' | null = null;

    /**
     * Copy data from an existing comment request object
     */
    from(data: CreateCommentRequest | Record<string, unknown>): this {
        this.request = { ...data };
        if ('groupId' in this.request) {
            this.targetKind = 'group';
        } else if ('expenseId' in this.request) {
            this.targetKind = 'expense';
        } else {
            this.targetKind = null;
        }
        return this;
    }

    withText(text: string | null | undefined): this {
        (this.request as any).text = text;
        return this;
    }

    withTargetType(targetType: string | number | null | undefined): this {
        (this.request as any).targetType = targetType;
        if (targetType === CommentTargetTypes.GROUP) {
            this.targetKind = 'group';
        } else if (targetType === CommentTargetTypes.EXPENSE) {
            this.targetKind = 'expense';
        } else {
            this.targetKind = null;
        }
        return this;
    }

    withGroupTarget(groupId: GroupId): this {
        this.targetKind = 'group';
        (this.request as any).groupId = groupId;
        delete (this.request as any).expenseId;
        return this;
    }

    withExpenseTarget(expenseId: ExpenseId): this {
        this.targetKind = 'expense';
        (this.request as any).expenseId = expenseId;
        delete (this.request as any).groupId;
        return this;
    }

    withTargetId(targetId: string | null | undefined): this {
        if (this.targetKind === 'expense') {
            (this.request as any).expenseId = targetId;
        } else if (this.targetKind === 'group') {
            (this.request as any).groupId = targetId;
        } else {
            (this.request as any).groupId = targetId;
        }
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
        if (this.targetKind === 'expense') {
            (this.request as any).expenseId = '<script>expense123</script>';
        } else {
            (this.request as any).groupId = '<script>group123</script>';
        }
        return this;
    }

    withMissingField(field: keyof (CreateGroupCommentRequest | CreateExpenseCommentRequest)): this {
        delete this.request[field];
        return this;
    }

    withEmptyField(field: keyof (CreateGroupCommentRequest | CreateExpenseCommentRequest)): this {
        (this.request as any)[field] = '';
        return this;
    }

    build(): CreateCommentRequest {
        return { ...this.request } as CreateCommentRequest;
    }
}
