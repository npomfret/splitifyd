import { ReactionEmojis } from '@billsplit-wl/shared';
import { z } from 'zod';

/**
 * Schema for validating reaction emojis.
 * Only allows the fixed set of quick reaction emojis.
 */
const ReactionEmojiSchema = z.enum([
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
]);

/**
 * Schema for aggregated reaction counts stored on parent documents.
 * Maps emoji to count: { '👍': 3, '❤️': 1 }
 * Uses partial object schema to allow sparse records (not all emojis required).
 */
export const ReactionCountsSchema = z
    .object({
        [ReactionEmojis.THUMBS_UP]: z.number().int().min(0),
        [ReactionEmojis.HEART]: z.number().int().min(0),
        [ReactionEmojis.LAUGH]: z.number().int().min(0),
        [ReactionEmojis.WOW]: z.number().int().min(0),
        [ReactionEmojis.SAD]: z.number().int().min(0),
        [ReactionEmojis.CELEBRATE]: z.number().int().min(0),
    })
    .partial();

/**
 * Schema for user reactions map stored on parent documents.
 * Maps userId to array of emojis: { 'user123': ['👍', '❤️'], 'user456': ['👍'] }
 * Denormalized for O(1) reads - no need to query subcollection.
 */
export const UserReactionsMapSchema = z.record(z.string(), z.array(ReactionEmojiSchema));
