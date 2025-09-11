import { z } from 'zod';

/**
 * Zod schema for Comment documents stored in Firestore
 *
 * Note: Comments are stored in subcollections under groups or expenses:
 * groups/{groupId}/comments/{commentId}
 * expenses/{expenseId}/comments/{commentId}
 */
export const CommentDocumentSchema = z
    .object({
        id: z.string().min(1), // Document ID
        authorId: z.string().min(1),
        authorName: z.string().min(1),
        authorAvatar: z.string().nullable(),
        text: z.string().min(1),
        createdAt: z.any(), // Firestore Timestamp
        updatedAt: z.any(), // Firestore Timestamp
    })
    .strict();

/**
 * Zod schema for Comment data without the ID (for writing to Firestore)
 */
export const CommentDataSchema = CommentDocumentSchema.omit({ id: true });

/**
 * Type-safe parsed Comment document
 */
export type ParsedComment = z.infer<typeof CommentDocumentSchema>;

/**
 * Type-safe Comment data for writing
 */
export type CommentData = z.infer<typeof CommentDataSchema>;
