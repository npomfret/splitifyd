import * as Joi from 'joi';
import { Errors } from '../utils/errors';
import { sanitizeString } from '../utils/security';
import { VALIDATION_LIMITS } from '../constants';
import { CreateGroupRequest } from '@splitifyd/shared';
import { UpdateGroupRequest } from '../types/group-types';

/**
 * Schema for create group request
 */
const createGroupSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(1)
        .max(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH)
        .required()
        .messages({
            'string.empty': 'Group name is required',
            'string.max': `Group name must be less than ${VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH} characters`,
        }),
    description: Joi.string().trim().max(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH).allow('').optional(),
    members: Joi.array()
        .items(
            Joi.object({
                uid: Joi.string().required(),
                displayName: Joi.string().required(),
                email: Joi.string().email().required(),
            }),
        )
        .max(VALIDATION_LIMITS.MAX_GROUP_MEMBERS)
        .optional(),
}).required();

/**
 * Schema for update group request
 */
const updateGroupSchema = Joi.object({
    name: Joi.string().trim().min(1).max(VALIDATION_LIMITS.MAX_GROUP_NAME_LENGTH).optional(),
    description: Joi.string().trim().max(VALIDATION_LIMITS.MAX_GROUP_DESCRIPTION_LENGTH).allow('').optional(),
})
    .min(1)
    .required();

/**
 * Validate create group request
 */
export const validateCreateGroup = (body: unknown): CreateGroupRequest => {
    const { error, value } = createGroupSchema.validate(body);

    if (error) {
        throw Errors.INVALID_INPUT(error.details[0].message);
    }

    return value as CreateGroupRequest;
};

/**
 * Validate update group request
 */
export const validateUpdateGroup = (body: unknown): UpdateGroupRequest => {
    const { error, value } = updateGroupSchema.validate(body);

    if (error) {
        throw Errors.INVALID_INPUT(error.details[0].message);
    }

    return value as UpdateGroupRequest;
};

/**
 * Validate group ID
 */
export const validateGroupId = (id: unknown): string => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
        throw Errors.MISSING_FIELD('group ID');
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
