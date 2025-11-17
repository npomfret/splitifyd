import { CommentBodySchema, type CommentId, type CommentText, CreateExpenseCommentRequest, CreateGroupCommentRequest, ListCommentsQuerySchema, toCommentId, toCommentText } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { validateExpenseId } from '../expenses/validation';
import { validateGroupId } from '../groups/validation';
import { ApiError } from '../utils/errors';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

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

export const validateCommentId = (id: unknown): CommentId => {
    if (typeof id !== 'string' || !id.trim()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_COMMENT_ID', 'Invalid comment ID');
    }
    return toCommentId(id.trim());
};
