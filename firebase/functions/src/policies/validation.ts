import {
    AcceptMultiplePoliciesRequestSchema,
    AcceptPolicyRequest,
    CreatePolicyRequestSchema,
    type PolicyId,
    PublishPolicyRequestSchema,
    UpdatePolicyRequestSchema,
    VersionHash,
} from '@billsplit-wl/shared';
import { createRequestValidator, createZodErrorMapper, sanitizeInputString } from '../validation/common';

interface AcceptMultiplePoliciesRequest {
    acceptances: AcceptPolicyRequest[];
}

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
    schema: AcceptMultiplePoliciesRequestSchema,
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
    schema: CreatePolicyRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        policyName: sanitizeInputString(value.policyName),
        text: value.text,
        publish: value.publish,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => CreatePolicyRequest;

export const validateUpdatePolicy = createRequestValidator({
    schema: UpdatePolicyRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        text: value.text,
        publish: value.publish,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => UpdatePolicyRequest;

export const validatePublishPolicy = createRequestValidator({
    schema: PublishPolicyRequestSchema,
    preValidate: (payload: unknown) => payload ?? {},
    transform: (value) => ({
        versionHash: value.versionHash as VersionHash,
    }),
    mapError: (error) => mapPolicyError(error),
}) as (body: unknown) => PublishPolicyRequest;
