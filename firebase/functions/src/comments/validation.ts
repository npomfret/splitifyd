import { CommentBodySchema, type CommentText, CreateExpenseCommentRequest, CreateGroupCommentRequest, ListCommentsQuerySchema, toCommentText } from '@billsplit-wl/shared';
import {
    createRequestValidator,
    createZodErrorMapper,
    sanitizeInputString,
    validateCommentId,
    validateExpenseId,
    validateGroupId,
} from '../validation/common';

// Re-export centralized ID validators for backward compatibility
export { validateCommentId, validateExpenseId, validateGroupId };

const mapCommentError = createZodErrorMapper(
    {
        text: {
            code: 'INVALID_COMMENT_TEXT',
            message: (issue) => {
                if (issue.code === 'invalid_type' || issue.message === 'Required') {
                    return 'Comment text is required';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_INPUT',
        defaultMessage: (issue) => issue.message,
    },
);

const baseValidateComment = createRequestValidator({
    schema: CommentBodySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        text: toCommentText(sanitizeInputString(value.text)),
    }),
    mapError: (error) => mapCommentError(error),
}) as (body: unknown) => { text: CommentText; };

const mapPaginationError = createZodErrorMapper(
    {
        limit: {
            code: 'INVALID_QUERY_PARAMS',
            message: (issue) => {
                if (issue.code === 'invalid_type') {
                    return 'Limit must be a number';
                }
                if (issue.message === 'Invalid input: expected number, received NaN') {
                    return 'Limit must be a number';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_QUERY_PARAMS',
        defaultMessage: (issue) => issue.message,
    },
);

const baseValidateListCommentsQuery = createRequestValidator({
    schema: ListCommentsQuerySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapPaginationError(error),
}) as (query: unknown) => { cursor?: string; limit: number; };

export const validateCreateGroupComment = (targetId: string, body: unknown): CreateGroupCommentRequest => {
    const validatedGroupId = validateGroupId(targetId);
    const { text } = baseValidateComment(body);

    return {
        groupId: validatedGroupId,
        text,
    };
};

export const validateCreateExpenseComment = (targetId: string, body: unknown): CreateExpenseCommentRequest => {
    const validatedExpenseId = validateExpenseId(targetId);
    const { text } = baseValidateComment(body);

    return {
        expenseId: validatedExpenseId,
        text,
    };
};

export const validateListCommentsQuery = (query: unknown): { cursor?: string; limit: number; } => {
    return baseValidateListCommentsQuery(query);
};
