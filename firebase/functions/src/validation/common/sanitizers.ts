import { sanitizeString } from '../../utils/security';

/**
 * Shared sanitisation helpers for request validation.
 * Re-export utilities here to make sanitisation usage consistent.
 */

export const sanitizeInputString = (value: string): string => sanitizeString(value);
