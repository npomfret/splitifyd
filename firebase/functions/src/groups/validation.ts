import { CreateGroupRequest, CreateGroupRequestSchema, UpdateDisplayNameRequest, UpdateDisplayNameRequestSchema, UpdateGroupRequest, UpdateGroupRequestSchema } from '@splitifyd/shared';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/errors';
import { sanitizeString } from '../utils/security';
import { parseWithApiError } from '../utils/validation';

/**
 * Validate create group request
 */
export const validateCreateGroup = (body: unknown): CreateGroupRequest => {
    return parseWithApiError(CreateGroupRequestSchema, body, {
        name: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
        description: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });
};

/**
 * Validate update group request
 */
export const validateUpdateGroup = (body: unknown): UpdateGroupRequest => {
    return parseWithApiError(UpdateGroupRequestSchema, body, {
        name: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
        description: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });
};

/**
 * Validate update display name request
 */
export const validateUpdateDisplayName = (body: unknown): UpdateDisplayNameRequest => {
    return parseWithApiError(UpdateDisplayNameRequestSchema, body, {
        displayName: {
            code: 'INVALID_INPUT',
            message: '', // Use Zod's message
        },
    });
};

/**
 * Validate group ID
 */
export const validateGroupId = (id: unknown): string => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_INPUT', 'group ID is required');
    }

    return id.trim();
};

/**
 * Sanitize group data for safe storage
 */
export const sanitizeGroupData = <T extends CreateGroupRequest | UpdateGroupRequest>(data: T): T => {
    const sanitized: any = {};

    if ('name' in data && data.name) {
        sanitized.name = sanitizeString(data.name);
    }

    if ('description' in data && data.description !== undefined) {
        sanitized.description = sanitizeString(data.description);
    }

    // Handle members array if present
    if ('members' in data && data.members) {
        sanitized.members = data.members;
    }

    return sanitized as T;
};
