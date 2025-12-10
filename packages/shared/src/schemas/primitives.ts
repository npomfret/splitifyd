/**
 * Primitive Zod schemas that can be used anywhere without circular dependencies.
 * These schemas have NO dependencies on shared-types.ts
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Display Name Schema
// ---------------------------------------------------------------------------

// Display names can contain Unicode letters, numbers, spaces, and common punctuation
// Uses Unicode property escapes for international character support
// Confusable characters (0/O, I/l) are allowed but normalized during conflict checking
const DISPLAY_NAME_PATTERN = /^[\p{Letter}\p{Number}\s\-_.]+$/u;
const DEFAULT_DISPLAY_NAME_MIN = 2;
const DEFAULT_DISPLAY_NAME_MAX = 50;

export interface DisplayNameSchemaOptions {
    min?: number;
    max?: number;
    minMessage?: string;
    maxMessage?: string;
    patternMessage?: string;
    pattern?: RegExp | null;
}

export const createDisplayNameSchema = (options?: DisplayNameSchemaOptions) => {
    const min = options?.min ?? DEFAULT_DISPLAY_NAME_MIN;
    const max = options?.max ?? DEFAULT_DISPLAY_NAME_MAX;
    const minMessage = options?.minMessage ?? `Display name must be at least ${min} characters`;
    const maxMessage = options?.maxMessage ?? `Display name cannot exceed ${max} characters`;
    const patternMessage = options?.patternMessage ?? 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods';
    const pattern = options?.pattern === undefined ? DISPLAY_NAME_PATTERN : options.pattern;

    let schema = z
        .string()
        .trim()
        .min(min, minMessage)
        .max(max, maxMessage);

    if (pattern) {
        schema = schema.regex(pattern, patternMessage);
    }

    return schema;
};

export const DisplayNameSchema = createDisplayNameSchema();
