import type {
    CommentId,
    ExpenseId,
    GroupId,
    PolicyId,
    SettlementId,
    UserId,
} from '@billsplit-wl/shared';
import { z } from 'zod';
import { HTTP_STATUS } from '../../constants';
import {
    CommentIdSchema,
    ExpenseIdSchema,
    GroupIdSchema,
    PolicyIdSchema,
    SettlementIdSchema,
    UserIdSchema,
} from '../../schemas/common';
import { ApiError } from '../../utils/errors';

/**
 * Factory function to create consistent ID validators using Zod schemas.
 *
 * All ID validators follow the same pattern:
 * 1. Parse with Zod schema (validates non-empty string + transforms to branded type)
 * 2. Return branded type on success
 * 3. Throw ApiError with consistent error code on failure
 */
function createIdValidator<T>(
    schema: z.ZodType<T>,
    errorCode: string,
    errorMessage: string,
): (value: unknown) => T {
    return (value: unknown): T => {
        const result = schema.safeParse(value);
        if (!result.success) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, errorCode, errorMessage);
        }
        return result.data;
    };
}

// ============================================================================
// ID Validators - for validating raw values (route params, query strings, etc.)
// ============================================================================

export const validateGroupId = createIdValidator<GroupId>(
    GroupIdSchema,
    'INVALID_GROUP_ID',
    'Invalid group ID',
);

export const validateExpenseId = createIdValidator<ExpenseId>(
    ExpenseIdSchema,
    'INVALID_EXPENSE_ID',
    'Invalid expense ID',
);

export const validateSettlementId = createIdValidator<SettlementId>(
    SettlementIdSchema,
    'INVALID_SETTLEMENT_ID',
    'Invalid settlement ID',
);

export const validateCommentId = createIdValidator<CommentId>(
    CommentIdSchema,
    'INVALID_COMMENT_ID',
    'Invalid comment ID',
);

export const validateUserId = createIdValidator<UserId>(
    UserIdSchema,
    'INVALID_USER_ID',
    'Invalid user ID',
);

export const validatePolicyId = createIdValidator<PolicyId>(
    PolicyIdSchema,
    'INVALID_POLICY_ID',
    'Invalid policy ID',
);

// ============================================================================
// Param Extractors - for extracting IDs from Express route params
// ============================================================================

interface RouteParams {
    groupId?: string;
    userId?: string;
    policyId?: string;
}

export const validateGroupIdParam = (params: unknown): GroupId =>
    validateGroupId((params as RouteParams)?.groupId);

export const validateUserIdParam = (params: unknown): UserId =>
    validateUserId((params as RouteParams)?.userId);

export const validatePolicyIdParam = (params: unknown): PolicyId =>
    validatePolicyId((params as RouteParams)?.policyId);

/**
 * Validate memberId - returns UserId since members are users
 */
export const validateMemberId = (value: unknown): UserId => {
    const result = UserIdSchema.safeParse(value);
    if (!result.success) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_MEMBER_ID', 'Invalid member ID');
    }
    return result.data;
};
