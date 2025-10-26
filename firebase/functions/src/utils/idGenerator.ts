import { randomBytes } from 'crypto';
import type { GroupId, UserId } from '@splitifyd/shared';

/**
 * Generates a secure share token suitable for URLs.
 * Generates 12 random bytes and returns a 16-character base64url string.
 */
export const generateShareToken = (): string => {
    const bytes = randomBytes(12);
    return bytes.toString('base64url').substring(0, 16);
};

/**
 * Generates a consistent document ID for top-level membership documents.
 * Format: {userId}_{groupId}
 */
export const newTopLevelMembershipDocId = (userId: UserId, groupId: GroupId): string => `${userId}_${groupId}`;
