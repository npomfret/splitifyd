import { ReactionEmojis, toReactionId } from '@billsplit-wl/shared';
import type { ReactionId } from '@billsplit-wl/shared';
import { z } from 'zod';
import { AuditFieldsSchema, UserIdSchema } from './common';

/**
 * Schema for ReactionId branded type
 */
export const ReactionIdSchema = z
    .string()
    .trim()
    .min(1)
    .describe('Firestore Reaction document ID (format: {userId}_{emoji})')
    .transform(toReactionId) as z.ZodType<ReactionId>;

/**
 * Schema for validating reaction emojis.
 * Only allows the fixed set of quick reaction emojis.
 */
export const ReactionEmojiSchema = z.enum([
    ReactionEmojis.THUMBS_UP,
    ReactionEmojis.HEART,
    ReactionEmojis.LAUGH,
    ReactionEmojis.WOW,
    ReactionEmojis.SAD,
    ReactionEmojis.CELEBRATE,
]);

/**
 * Base reaction schema - represents a single reaction in a subcollection.
 * Document path: {resource}/reactions/{userId}_{emoji}
 */
const BaseReactionSchema = z
    .object({
        userId: UserIdSchema,
        emoji: ReactionEmojiSchema,
    })
    .merge(AuditFieldsSchema);

/**
 * Full reaction document schema including document ID.
 * Used for reading reactions from Firestore.
 */
export const ReactionDocumentSchema = BaseReactionSchema
    .extend({
        id: z.string().min(1),
    })
    .strict();

/**
 * Schema for reaction data without the ID (for writing to Firestore).
 */
export const ReactionDataSchema = BaseReactionSchema;

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
