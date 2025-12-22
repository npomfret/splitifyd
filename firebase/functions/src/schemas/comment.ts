import { toAttachmentId, toUserId } from '@billsplit-wl/shared';
import { z } from 'zod';

import { FirestoreTimestampSchema } from './common';
import { ReactionCountsSchema, UserReactionsMapSchema } from './reaction';

/**
 * Schema for comment attachment references stored in Firestore.
 * Matches CommentAttachmentRef from shared types.
 */
const CommentAttachmentRefSchema = z.object({
    attachmentId: z.string().min(1).transform(toAttachmentId),
    fileName: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
});

/**
 * Zod schema for Comment documents stored in Firestore
 *
 * Note: Comments are stored in subcollections under groups or expenses:
 * groups/{groupId}/comments/{commentId}
 */
export const CommentDocumentSchema = z
    .object({
        id: z.string().min(1), // Document ID
        authorId: z.string().min(1).transform(toUserId),
        authorName: z.string().min(1),
        authorAvatar: z.string().optional().nullable(),
        text: z.string().min(1),
        attachments: z.array(CommentAttachmentRefSchema).optional().default([]),
        createdAt: FirestoreTimestampSchema,
        updatedAt: FirestoreTimestampSchema,
        reactionCounts: ReactionCountsSchema.nullable().optional(), // Aggregate emoji reaction counts
        userReactions: UserReactionsMapSchema.nullable().optional(), // All users' reactions (denormalized)
    })
    .strict();

/**
 * Zod schema for Comment data without the ID (for writing to Firestore)
 */
export const CommentDataSchema = CommentDocumentSchema.omit({ id: true });
