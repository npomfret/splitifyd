import type { ReactionEmoji, ToggleReactionRequest } from '@billsplit-wl/shared';
import { ReactionEmojis, toCommentId, toExpenseId, toGroupId, toSettlementId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { Errors } from '../errors';
import { createRequestValidator, createZodErrorMapper } from '../validation/common';

const ReactionEmojiSchema = z.enum([
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
]);

const ToggleReactionBodySchema = z.object({
    emoji: ReactionEmojiSchema,
});

const mapReactionError = createZodErrorMapper(
    {
        emoji: {
            code: 'INVALID_EMOJI',
            message: () => 'Invalid reaction emoji. Must be one of: 👍 ❤️ 😂 😮 😢 🎉',
        },
    },
    {
        defaultCode: 'VALIDATION_ERROR',
        defaultMessage: (issue) => issue.message,
    },
);

const baseValidateToggleReaction = createRequestValidator({
    schema: ToggleReactionBodySchema,
    preValidate: (payload: unknown) => payload ?? {},
    mapError: (error) => mapReactionError(error),
}) as (body: unknown) => { emoji: ReactionEmoji; };

export const validateToggleExpenseReaction = (expenseId: string, body: unknown): ToggleReactionRequest & { expenseId: ReturnType<typeof toExpenseId>; } => {
    if (!expenseId || typeof expenseId !== 'string' || expenseId.trim().length === 0) {
        throw Errors.validationError('expenseId');
    }

    const { emoji } = baseValidateToggleReaction(body);

    return {
        expenseId: toExpenseId(expenseId.trim()),
        emoji,
    };
};

export const validateToggleGroupCommentReaction = (
    groupId: string,
    commentId: string,
    body: unknown,
): ToggleReactionRequest & { groupId: ReturnType<typeof toGroupId>; commentId: ReturnType<typeof toCommentId>; } => {
    if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
        throw Errors.validationError('groupId');
    }
    if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
        throw Errors.validationError('commentId');
    }

    const { emoji } = baseValidateToggleReaction(body);

    return {
        groupId: toGroupId(groupId.trim()),
        commentId: toCommentId(commentId.trim()),
        emoji,
    };
};

export const validateToggleExpenseCommentReaction = (
    expenseId: string,
    commentId: string,
    body: unknown,
): ToggleReactionRequest & { expenseId: ReturnType<typeof toExpenseId>; commentId: ReturnType<typeof toCommentId>; } => {
    if (!expenseId || typeof expenseId !== 'string' || expenseId.trim().length === 0) {
        throw Errors.validationError('expenseId');
    }
    if (!commentId || typeof commentId !== 'string' || commentId.trim().length === 0) {
        throw Errors.validationError('commentId');
    }

    const { emoji } = baseValidateToggleReaction(body);

    return {
        expenseId: toExpenseId(expenseId.trim()),
        commentId: toCommentId(commentId.trim()),
        emoji,
    };
};

export const validateToggleSettlementReaction = (settlementId: string, body: unknown): ToggleReactionRequest & { settlementId: ReturnType<typeof toSettlementId>; } => {
    if (!settlementId || typeof settlementId !== 'string' || settlementId.trim().length === 0) {
        throw Errors.validationError('settlementId');
    }

    const { emoji } = baseValidateToggleReaction(body);

    return {
        settlementId: toSettlementId(settlementId.trim()),
        emoji,
    };
};
