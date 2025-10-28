import { CreateExpenseCommentRequest, CreateGroupCommentRequest, type CommentId, toCommentId } from '@splitifyd/shared';
import { z } from 'zod';
import {
    createPaginationSchema,
    createRequestValidator,
    createZodErrorMapper,
    sanitizeInputString,
} from '../validation/common';
import { validateExpenseId } from '../expenses/validation';
import { validateGroupId } from '../groups/validation';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';

const commentTextSchema = z
    .string()
    .trim()
    .min(1, 'Comment text is required')
    .max(500, 'Comment cannot exceed 500 characters');

const commentBodySchema = z.object({
    text: commentTextSchema,
});

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
    schema: commentBodySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        text: sanitizeInputString(value.text),
    }),
    mapError: (error) => mapCommentError(error),
}) as (body: unknown) => { text: string; };

const listCommentsQuerySchema = createPaginationSchema({
    defaultLimit: 8,
    minLimit: 1,
    maxLimit: 100,
});

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
    schema: listCommentsQuerySchema,
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
