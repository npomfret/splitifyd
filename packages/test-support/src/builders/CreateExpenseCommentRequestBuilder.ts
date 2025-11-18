
import { toCommentText, toExpenseId } from '@billsplit-wl/shared';
import type { CreateExpenseCommentRequest, ExpenseId, CommentText } from '@billsplit-wl/shared';

export class CreateExpenseCommentRequestBuilder {
    private request: Partial<CreateExpenseCommentRequest> = {};

    constructor() {
        this.request.expenseId = toExpenseId('expense-123');
        this.request.text = toCommentText('Hello, world!');
    }

    withExpenseId(expenseId: ExpenseId | string): this {
        this.request.expenseId = typeof expenseId === 'string' ? toExpenseId(expenseId) : expenseId;
        return this;
    }

    withText(text: CommentText | string): this {
        this.request.text = typeof text === 'string' ? toCommentText(text) : text;
        return this;
    }

    build(): CreateExpenseCommentRequest {
        return this.request as CreateExpenseCommentRequest;
    }
}
