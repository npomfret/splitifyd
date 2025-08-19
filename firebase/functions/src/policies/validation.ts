import * as Joi from 'joi';
import { ApiError } from '../utils/errors';
import { HTTP_STATUS } from '../constants';

/**
 * Schema for accept single policy request
 */
const acceptPolicySchema = Joi.object({
    policyId: Joi.string()
        .trim()
        .min(1)
        .required()
        .messages({
            'string.empty': 'Policy ID is required',
            'any.required': 'Policy ID is required',
        }),
    versionHash: Joi.string()
        .trim()
        .min(1)
        .required()
        .messages({
            'string.empty': 'Version hash is required',
            'any.required': 'Version hash is required',
        }),
}).required();

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
    acceptances: Joi.array()
        .items(policyAcceptanceItemSchema)
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one policy acceptance is required',
            'any.required': 'Acceptances array is required',
        }),
}).required();

/**
 * Accept policy request interface
 */
export interface AcceptPolicyRequest {
    policyId: string;
    versionHash: string;
}

/**
 * Accept multiple policies request interface
 */
export interface AcceptMultiplePoliciesRequest {
    acceptances: AcceptPolicyRequest[];
}

/**
 * Validate accept single policy request
 */
export const validateAcceptPolicy = (body: unknown): AcceptPolicyRequest => {
    const { error, value } = acceptPolicySchema.validate(body, { 
        abortEarly: false,
        stripUnknown: true 
    });

    if (error) {
        const firstError = error.details[0];
        let errorCode = 'INVALID_REQUEST';
        let errorMessage = firstError.message;

        if (firstError.path.includes('policyId')) {
            errorCode = 'INVALID_POLICY_ID';
        } else if (firstError.path.includes('versionHash')) {
            errorCode = 'INVALID_VERSION_HASH';
        }

        throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
    }

    return {
        policyId: value.policyId.trim(),
        versionHash: value.versionHash.trim(),
    };
};

/**
 * Validate accept multiple policies request
 */
export const validateAcceptMultiplePolicies = (body: unknown): AcceptMultiplePoliciesRequest => {
    const { error, value } = acceptMultiplePoliciesSchema.validate(body, { 
        abortEarly: false,
        stripUnknown: true 
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