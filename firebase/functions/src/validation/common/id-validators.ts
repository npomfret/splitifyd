import type {
    CommentId,
    ExpenseId,
    GroupId,
    PolicyId,
    SettlementId,
    UserId,
} from '@billsplit-wl/shared';
import { z } from 'zod';
import { Errors } from '../../errors';
import {
    CommentIdSchema,
    ExpenseIdSchema,
    GroupIdSchema,
    PolicyIdSchema,
    SettlementIdSchema,
    UserIdSchema,
} from '../../schemas/common';

/**
 * Factory function to create consistent ID validators using Zod schemas.
 *
 * All ID validators follow the same pattern:
 * 1. Parse with Zod schema (validates non-empty string + transforms to branded type)
 * 2. Return branded type on success
 * 3. Throw validation error on failure
 */
function createIdValidator<T>(
    schema: z.ZodType<T>,
    fieldName: string,
): (value: unknown) => T {
    return (value: unknown): T => {
        const result = schema.safeParse(value);
        if (!result.success) {
            throw Errors.validationError(fieldName);
        }
        return result.data;
    };
}

// ============================================================================
// ID Validators - for validating raw values (route params, query strings, etc.)
// ============================================================================

export const validateGroupId = createIdValidator<GroupId>(
    GroupIdSchema,
    'groupId',
);

export const validateExpenseId = createIdValidator<ExpenseId>(
    ExpenseIdSchema,
    'expenseId',
);

export const validateSettlementId = createIdValidator<SettlementId>(
    SettlementIdSchema,
    'settlementId',
);

export const validateCommentId = createIdValidator<CommentId>(
    CommentIdSchema,
    'commentId',
);

export const validateUserId = createIdValidator<UserId>(
    UserIdSchema,
    'userId',
);

export const validatePolicyId = createIdValidator<PolicyId>(
    PolicyIdSchema,
    'policyId',
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
        throw Errors.validationError('memberId');
    }
    return result.data;
};
