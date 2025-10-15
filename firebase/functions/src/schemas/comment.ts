import { z } from 'zod';


import {FirestoreTimestampSchema} from "./common";

/**
 * Zod schema for Comment documents stored in Firestore
 *
 * Note: Comments are stored in subcollections under groups or expenses:
 * groups/{groupId}/comments/{commentId}
 */
export const CommentDocumentSchema = z
    .object({
        id: z.string().min(1), // Document ID
        authorId: z.string().min(1),
        authorName: z.string().min(1),
        authorAvatar: z.string().optional().nullable(),
        text: z.string().min(1),
        createdAt: FirestoreTimestampSchema,
        updatedAt: FirestoreTimestampSchema,
    })
    .strict();

/**
 * Zod schema for Comment data without the ID (for writing to Firestore)
 */
export const CommentDataSchema = CommentDocumentSchema.omit({ id: true });
