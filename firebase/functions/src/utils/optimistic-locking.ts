import { Errors } from './errors';
import { logger } from '../logger';

/**
 * Optimistic locking utilities using updatedAt ISO string timestamps
 * Prevents concurrent update conflicts across all collections
 *
 * DTO-EVERYWHERE MIGRATION: Now works with ISO string timestamps from DTOs
 * instead of Firestore Timestamp objects
 */

/**
 * Extract and validate updatedAt ISO string from DTO
 * Provides comprehensive validation with proper error handling and logging
 *
 * @param data - DTO object containing updatedAt field
 * @param docId - Optional document ID for error logging
 * @returns ISO 8601 string timestamp
 * @throws Error if updatedAt is missing or invalid
 */
export const getUpdatedAtISO = (data: any, docId?: string): string => {
    const updatedAt = data?.updatedAt;

    if (!updatedAt) {
        logger.error('Document missing updatedAt timestamp', { docId, dataKeys: Object.keys(data || {}) });
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'missing_timestamp' });
    }

    if (typeof updatedAt !== 'string') {
        logger.error('Invalid updatedAt type - expected ISO string', {
            docId,
            type: typeof updatedAt,
            value: updatedAt,
        });
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'invalid_timestamp_type' });
    }

    // Validate ISO string format (basic check)
    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) {
        logger.error('Invalid updatedAt ISO string', { docId, value: updatedAt });
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'invalid_iso_string' });
    }

    // Validate timestamp reasonableness (not too far in past/future)
    const now = Date.now();
    const timestampMs = date.getTime();
    const hourInMs = 60 * 60 * 1000;
    const dayInMs = 24 * hourInMs;

    if (timestampMs > now + hourInMs) {
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'future_timestamp' });
    }

    if (timestampMs < now - 30 * dayInMs) {
        // Don't throw error for old timestamps - just log warning
        logger.warn('Old timestamp detected', { docId, updatedAt, ageInDays: Math.floor((now - timestampMs) / dayInMs) });
    }

    return updatedAt;
};

/**
 * Compare two ISO string timestamps for optimistic locking
 *
 * @param timestamp1 - First ISO timestamp
 * @param timestamp2 - Second ISO timestamp
 * @returns true if timestamps are equal, false otherwise
 */
export const areTimestampsEqual = (timestamp1: string | undefined, timestamp2: string | undefined): boolean => {
    if (!timestamp1 || !timestamp2) {
        return false;
    }
    // Direct string comparison works for ISO 8601 strings
    return timestamp1 === timestamp2;
};
