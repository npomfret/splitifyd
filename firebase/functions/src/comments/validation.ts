import { CommentTargetType, CreateExpenseCommentRequest, CreateGroupCommentRequest } from '@splitifyd/shared';
import * as Joi from 'joi';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { sanitizeString } from '../utils/security';
import {validateExpenseId} from "../expenses/validation";
import {validateGroupId} from "../groups/validation";

const commentTextSchema = Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Comment text is required',
    'string.min': 'Comment cannot be empty',
    'string.max': 'Comment cannot exceed 500 characters',
});

const createGroupCommentSchema = Joi.object({
    text: commentTextSchema,
});

const createExpenseCommentSchema = Joi.object({
    text: commentTextSchema,
});

// Joi validation schema for listing comments query parameters
const listCommentsQuerySchema = Joi.object({
    cursor: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).default(8).optional(),
});

const sanitizeCommentText = (text: string): string => sanitizeString(text);

const sanitizeIdentifier = (value: string): string => sanitizeString(value);

/**
 * Validates the request body for creating a group comment
 */
export const validateCreateGroupComment = (targetId: string, body: any): CreateGroupCommentRequest => {
    const { error, value } = createGroupCommentSchema.validate(body, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_INPUT';
        let errorMessage = firstError.message;

        if (firstError.path.includes('text')) {
            errorCode = 'INVALID_COMMENT_TEXT';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    const validatedGroupId = validateGroupId(targetId)

    const { text } = value as { text: string; };

    return {
        groupId: validatedGroupId,
        text: sanitizeCommentText(text),
    };
};

/**
 * Validates the request body for creating an expense comment
 */
export const validateCreateExpenseComment = (targetId: string, body: any): CreateExpenseCommentRequest => {
    const { error, value } = createExpenseCommentSchema.validate(body, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_INPUT';
        let errorMessage = firstError.message;

        if (firstError.path.includes('text')) {
            errorCode = 'INVALID_COMMENT_TEXT';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    const validatedExpenseId = validateExpenseId(targetId);

    const { text } = value as { text: string; };

    return {
        expenseId: validatedExpenseId,
        text: sanitizeCommentText(text),
    };
};

/**
 * Validates query parameters for listing comments
 */
export const validateListCommentsQuery = (query: any): { cursor?: string; limit: number; } => {
    const { error, value } = listCommentsQuerySchema.validate(query, { abortEarly: false, stripUnknown: true });

    if (error) {
        const firstError = error.details[0];
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_QUERY_PARAMS', firstError.message);
    }

    return value;
};

/**
 * Validates that a target ID is a valid string
 */
export const validateTargetId = (id: any, targetType: CommentTargetType): string => {
    if (typeof id !== 'string' || !id.trim()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_TARGET_ID', `Invalid ${targetType} ID`);
    }
    return id.trim();
};

/**
 * Validates that a comment ID is valid
 */
export const validateCommentId = (id: any): string => {
    if (typeof id !== 'string' || !id.trim()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_COMMENT_ID', 'Invalid comment ID');
    }
    return id.trim();
};
