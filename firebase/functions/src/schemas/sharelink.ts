import { toISOString } from '@splitifyd/shared';
import { z } from 'zod';

/**
 * Zod schema for ShareLink documents stored in Firestore
 *
 * Note: ShareLinks are stored in subcollections under groups:
 * groups/{groupId}/shareLinks/{shareLinkId}
 */
export const ShareLinkDocumentSchema = z
    .object({
        id: z.string().min(1), // Document ID
        token: z.string().min(16), // The actual share token used in URLs
        createdBy: z.string().min(1), // UID of the user who created this share link
        createdAt: z.string().datetime().transform(toISOString), // ISO timestamp string
        updatedAt: z.string().datetime().transform(toISOString), // ISO timestamp string
        expiresAt: z.string().datetime().transform(toISOString), // Expiration timestamp (ISO format)
    })
    .strict();

/**
 * Zod schema for ShareLink data without the ID (for writing to Firestore)
 * This matches the Omit<ShareLink, 'id'> pattern used in the codebase
 */
export const ShareLinkDataSchema = ShareLinkDocumentSchema.omit({ id: true });

/**
 * Type-safe parsed ShareLink document
 */
export type ParsedShareLink = z.infer<typeof ShareLinkDocumentSchema>;
