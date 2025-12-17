import {
    type AttachmentId,
    CommentBodySchema,
    type CommentText,
    CreateExpenseCommentRequest,
    CreateGroupCommentRequest,
    ListCommentsQuerySchema,
    toAttachmentId,
    toCommentText,
} from '@billsplit-wl/shared';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString, validateCommentId, validateExpenseId, validateGroupId } from '../validation/common';

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
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

interface ValidatedCommentBody {
    text: CommentText;
    attachmentIds?: AttachmentId[];
}

const baseValidateComment = createRequestValidator({
    schema: CommentBodySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value): ValidatedCommentBody => ({
        text: toCommentText(sanitizeInputString(value.text)),
        attachmentIds: value.attachmentIds?.map((id: string) => toAttachmentId(id)),
    }),
    mapError: (error) => mapCommentError(error),
}) as (body: unknown) => ValidatedCommentBody;

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
    const { text, attachmentIds } = baseValidateComment(body);

    return {
        groupId: validatedGroupId,
        text,
        attachmentIds,
    };
};

export const validateCreateExpenseComment = (targetId: string, body: unknown): CreateExpenseCommentRequest => {
    const validatedExpenseId = validateExpenseId(targetId);
    const { text, attachmentIds } = baseValidateComment(body);

    return {
        expenseId: validatedExpenseId,
        text,
        attachmentIds,
    };
};

export const validateListCommentsQuery = (query: unknown): { cursor?: string; limit: number; } => {
    return baseValidateListCommentsQuery(query);
};
