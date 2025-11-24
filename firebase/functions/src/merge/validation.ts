import type { UserId } from '@billsplit-wl/shared';
import { toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { createRequestValidator } from '../validation/common';

/**
 * Schema for initiate merge request
 */
const InitiateMergeRequestSchema = z.object({
    secondaryUserId: z.string().min(1, 'secondaryUserId is required'),
});

/**
 * Schema for job ID parameter
 */
const JobIdSchema = z.string().min(1, 'Job ID is required');

/**
 * Internal validator that parses and sanitizes the request
 */
const baseValidateInitiateMergeRequest = createRequestValidator({
    schema: InitiateMergeRequestSchema,
    errorMapping: {
        secondaryUserId: {
            code: 'MISSING_FIELD',
            message: 'secondaryUserId is required',
        },
    },
    transform: (parsed) => ({
        secondaryUserId: parsed.secondaryUserId.trim(),
    }),
});

/**
 * Validate initiate merge request body
 *
 * Validates that the request body contains a valid secondaryUserId
 * and transforms it to a branded UserId type.
 */
export const validateInitiateMergeRequest = (body: unknown): { secondaryUserId: UserId; } => {
    const validated = baseValidateInitiateMergeRequest(body);
    return {
        secondaryUserId: toUserId(validated.secondaryUserId),
    };
};

/**
 * Validate job ID from URL parameter
 *
 * Validates that the job ID is a non-empty string.
 */
export const validateJobId = createRequestValidator({
    schema: JobIdSchema,
    errorMapping: {
        _default: {
            code: 'MISSING_FIELD',
            message: 'jobId is required',
        },
    },
    transform: (parsed) => parsed.trim(),
});
