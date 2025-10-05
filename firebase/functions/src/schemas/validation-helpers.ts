import { z } from 'zod';
import { validateWithMonitoring } from './validation-monitor';
import type { ContextualLogger } from '../utils/contextual-logger';

/**
 * Validate data during update operations
 */
export function validateUpdate<T extends z.ZodSchema>(
    schema: T,
    updatedData: unknown,
    schemaName: string,
    context: {
        documentId?: string;
        collection?: string;
        uid?: string;
        logger?: ContextualLogger;
    },
): z.infer<T> {
    return validateWithMonitoring(schema, updatedData, {
        schemaName,
        operation: 'update',
        ...context,
    });
}
