import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';
import { sanitizeString } from '../utils/security';

/**
 * Schema for policy acceptance in batch
 */
const policyAcceptanceItemSchema = Joi.object({
    policyId: Joi.string().trim().min(1).required(),
    versionHash: Joi.string().trim().min(1).required(),
});

/**
 * Schema for accept multiple policies request
 */
const acceptMultiplePoliciesSchema = Joi.object({
    acceptances: Joi.array().items(policyAcceptanceItemSchema).min(1).required().messages({
        'array.min': 'At least one policy acceptance is required',
        'any.required': 'Acceptances array is required',
    }),
}).required();

/**
 * Accept policy request interface
 */
interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

/**
 * Accept multiple policies request interface
 */
interface AcceptMultiplePoliciesRequest {
    acceptances: AcceptPolicyRequest[];
}

/**
 * Validate accept multiple policies request
 */
export const validateAcceptMultiplePolicies = (body: unknown): AcceptMultiplePoliciesRequest => {
    const { error, value } = acceptMultiplePoliciesSchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_REQUEST';
        let errorMessage = firstError.message;

        if (firstError.path.includes('acceptances')) {
            errorCode = 'INVALID_ACCEPTANCES';
            if (firstError.type === 'array.min') {
                errorMessage = 'At least one policy acceptance is required';
            }
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    return {
        acceptances: value.acceptances.map((item: any) => ({
            policyId: item.policyId.trim(),
            versionHash: item.versionHash.trim(),
        })),
    };
};

/**
 * Schema for create policy request
 */
const createPolicySchema = Joi.object({
    policyName: Joi.string().trim().min(1).max(100).required().messages({
        'string.empty': 'Policy name is required',
        'any.required': 'Policy name is required',
        'string.max': 'Policy name must be 100 characters or less',
    }),
    text: Joi.string().min(1).required().messages({
        'string.empty': 'Policy text is required',
        'any.required': 'Policy text is required',
    }),
    publish: Joi.boolean().optional().default(false),
}).required();

/**
 * Schema for update policy request
 */
const updatePolicySchema = Joi.object({
    text: Joi.string().min(1).required().messages({
        'string.empty': 'Policy text is required',
        'any.required': 'Policy text is required',
    }),
    publish: Joi.boolean().optional().default(false),
}).required();

/**
 * Schema for publish policy request
 */
const publishPolicySchema = Joi.object({
    versionHash: Joi.string().trim().min(1).required().messages({
        'string.empty': 'Version hash is required',
        'any.required': 'Version hash is required',
    }),
}).required();

/**
 * Create policy request interface
 */
interface CreatePolicyRequest {
    policyName: string;
    text: string;
    publish?: boolean;
}

/**
 * Update policy request interface
 */
interface UpdatePolicyRequest {
    text: string;
    publish?: boolean;
}

/**
 * Publish policy request interface
 */
interface PublishPolicyRequest {
    versionHash: string;
}

/**
 * Validate create policy request
 */
export const validateCreatePolicy = (body: unknown): CreatePolicyRequest => {
    const { error, value } = createPolicySchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', firstError.message);
    }

    return {
        policyName: sanitizeString(value.policyName),
        text: value.text, // Don't sanitize policy text as it may contain HTML/markdown
        publish: value.publish,
    };
};

/**
 * Validate update policy request
 */
export const validateUpdatePolicy = (body: unknown): UpdatePolicyRequest => {
    const { error, value } = updatePolicySchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', firstError.message);
    }

    return {
        text: value.text, // Don't sanitize policy text as it may contain HTML/markdown
        publish: value.publish,
    };
};

/**
 * Validate publish policy request
 */
export const validatePublishPolicy = (body: unknown): PublishPolicyRequest => {
    const { error, value } = publishPolicySchema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const firstError = error.details[0];
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_REQUEST', firstError.message);
    }

    return {
        versionHash: value.versionHash.trim(),
    };
};
