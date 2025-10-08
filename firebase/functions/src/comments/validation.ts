import { CommentTargetType, CommentTargetTypes, CreateCommentRequest } from '@splitifyd/shared';
import * as Joi from 'joi';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { sanitizeString } from '../utils/security';

// Joi validation schema for creating comments
const createCommentSchema = Joi.object({
    text: Joi.string().trim().min(1).max(500).required().messages({
        'string.empty': 'Comment text is required',
        'string.min': 'Comment cannot be empty',
        'string.max': 'Comment cannot exceed 500 characters',
    }),
    targetType: Joi.string().valid(CommentTargetTypes.GROUP, CommentTargetTypes.EXPENSE).required().messages({
        'any.only': 'Target type must be either "group" or "expense"',
        'any.required': 'Target type is required',
    }),
    targetId: Joi.string().trim().required().messages({
        'string.empty': 'Target ID is required',
        'any.required': 'Target ID is required',
    }),
    groupId: Joi.string().trim().optional(),
});

// Joi validation schema for listing comments query parameters
const listCommentsQuerySchema = Joi.object({
    cursor: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

/**
 * Sanitizes comment data to prevent XSS attacks
 */
const sanitizeCommentData = (data: CreateCommentRequest): CreateCommentRequest => {
    return {
        ...data,
        text: sanitizeString(data.text),
        targetId: sanitizeString(data.targetId),
        groupId: data.groupId ? sanitizeString(data.groupId) : undefined,
    };
};

/**
 * Validates the request body for creating a comment
 */
export const validateCreateComment = (body: any): CreateCommentRequest => {
    const { error, value } = createCommentSchema.validate(body, { abortEarly: false });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_INPUT';
        let errorMessage = firstError.message;

        // Provide specific error codes for different validation failures
        if (firstError.path.includes('text')) {
            errorCode = 'INVALID_COMMENT_TEXT';
        } else if (firstError.path.includes('targetType')) {
            errorCode = 'INVALID_TARGET_TYPE';
        } else if (firstError.path.includes('targetId')) {
            errorCode = 'INVALID_TARGET_ID';
        } else if (firstError.path.includes('groupId')) {
            errorCode = 'MISSING_GROUP_ID';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    // Sanitize the validated data
    return sanitizeCommentData(value as CreateCommentRequest);
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
