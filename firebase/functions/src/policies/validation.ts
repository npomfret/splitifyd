import { PolicyId, VersionHash } from '@splitifyd/shared';
import { z } from 'zod';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

interface AcceptPolicyRequest {
    policyId: PolicyId;
    versionHash: VersionHash;
}

interface AcceptMultiplePoliciesRequest {
    acceptances: AcceptPolicyRequest[];
}

const PolicyIdSchema = z
    .string()
    .trim()
    .min(1, 'Policy ID is required');

const VersionHashSchema = z
    .string()
    .trim()
    .min(1, 'Version hash is required');

const policyAcceptanceItemSchema = z.object({
    policyId: PolicyIdSchema,
    versionHash: VersionHashSchema,
});

const acceptMultiplePoliciesSchema = z.object({
    acceptances: z
        .array(policyAcceptanceItemSchema)
        .min(1, 'At least one policy acceptance is required'),
});

const mapAcceptPoliciesError = createZodErrorMapper(
    {
        acceptances: {
            code: 'INVALID_ACCEPTANCES',
            message: (issue) => {
                if (issue.code === 'invalid_type' && issue.path.length === 1) {
                    return 'Acceptances must be an array';
                }
                const lastSegment = issue.path[issue.path.length - 1];
                if (lastSegment === 'policyId' && issue.code === 'invalid_type') {
                    return 'Policy ID must be a string';
                }
                if (lastSegment === 'versionHash' && issue.code === 'invalid_type') {
                    return 'Version hash must be a string';
                }
                if (issue.message === 'Required') {
                    return 'Acceptances array is required';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_REQUEST',
        defaultMessage: (issue) => issue.message,
    },
);

const baseValidateAcceptMultiplePolicies = createRequestValidator({
    schema: acceptMultiplePoliciesSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        acceptances: value.acceptances.map((item) => ({
            policyId: item.policyId as PolicyId,
            versionHash: item.versionHash as VersionHash,
        })),
    }),
    mapError: (error) => mapAcceptPoliciesError(error),
}) as (body: unknown) => AcceptMultiplePoliciesRequest;

export const validateAcceptMultiplePolicies = (body: unknown): AcceptMultiplePoliciesRequest => {
    return baseValidateAcceptMultiplePolicies(body);
};

interface CreatePolicyRequest {
    policyName: string;
    text: string;
    publish?: boolean;
}

interface UpdatePolicyRequest {
    text: string;
    publish?: boolean;
}

interface PublishPolicyRequest {
    versionHash: VersionHash;
}

const policyNameSchema = z
    .string()
    .trim()
    .min(1, 'Policy name is required')
    .max(100, 'Policy name must be 100 characters or less');

const policyTextSchema = z
    .string()
    .min(1, 'Policy text is required');

const createPolicySchema = z.object({
    policyName: policyNameSchema,
    text: policyTextSchema,
    publish: z.boolean().optional().default(false),
});

const updatePolicySchema = z.object({
    text: policyTextSchema,
    publish: z.boolean().optional().default(false),
});

const publishPolicySchema = z.object({
    versionHash: VersionHashSchema,
});

const mapPolicyError = createZodErrorMapper(
    {
        policyName: {
            code: 'INVALID_REQUEST',
            message: (issue) => {
                if (issue.message === 'Required') {
                    return 'Policy name is required';
                }
                if (issue.code === 'invalid_type') {
                    return 'Policy name must be a string';
                }
                return issue.message;
            },
        },
        text: {
            code: 'INVALID_REQUEST',
            message: (issue) => {
                if (issue.message === 'Required') {
                    return 'Policy text is required';
                }
                if (issue.code === 'invalid_type') {
                    return 'Policy text must be a string';
                }
                return issue.message;
            },
        },
        versionHash: {
            code: 'INVALID_REQUEST',
            message: (issue) => {
                if (issue.message === 'Required') {
                    return 'Version hash is required';
                }
                if (issue.code === 'invalid_type') {
                    return 'Version hash must be a string';
                }
                return issue.message;
            },
        },
    },
    {
        defaultCode: 'INVALID_REQUEST',
        defaultMessage: (issue) => issue.message,
    },
);

export const validateCreatePolicy = createRequestValidator({
    schema: createPolicySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        policyName: sanitizeInputString(value.policyName),
        text: value.text,
        publish: value.publish,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => CreatePolicyRequest;

export const validateUpdatePolicy = createRequestValidator({
    schema: updatePolicySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        text: value.text,
        publish: value.publish,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => UpdatePolicyRequest;

export const validatePublishPolicy = createRequestValidator({
    schema: publishPolicySchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        versionHash: value.versionHash as VersionHash,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => PublishPolicyRequest;
