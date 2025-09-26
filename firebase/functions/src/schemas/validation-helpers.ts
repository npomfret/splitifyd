import { z } from 'zod';
import * as admin from 'firebase-admin';
import { validateWithMonitoring, validateSafely, EnhancedValidationError } from './validation-monitor';
import type { ContextualLogger } from '../utils/contextual-logger';

/**
 * Validation helper utilities for common Firestore operations
 *
 * Provides convenient wrappers for validating documents during
 * read and write operations with proper monitoring.
 */

/**
 * Validate a Firestore document after reading
 */
export function validateFirestoreDocument<T extends z.ZodSchema>(schema: T, doc: admin.firestore.DocumentSnapshot, schemaName: string, logger?: ContextualLogger): z.infer<T> {
    const data = doc.data();
    if (!data) {
        throw new Error(`Document ${doc.id} does not exist or has no data`);
    }

    // Add the document ID to the data
    const dataWithId = { ...data, id: doc.id };

    return validateWithMonitoring(schema, dataWithId, {
        schemaName,
        operation: 'read',
        documentId: doc.id,
        collection: doc.ref.parent.id,
        logger,
    });
}

/**
 * Validate data before writing to Firestore
 */
export function validateBeforeWrite<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
    schemaName: string,
    context: {
        documentId?: string;
        collection?: string;
        uid?: string;
        logger?: ContextualLogger;
    },
): z.infer<T> {
    return validateWithMonitoring(schema, data, {
        schemaName,
        operation: 'write',
        ...context,
    });
}

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

/**
 * Safely validate with monitoring but don't throw on validation errors
 * Useful for gradual migration or monitoring existing data quality
 */
export function monitorValidation<T extends z.ZodSchema>(
    schema: T,
    doc: admin.firestore.DocumentSnapshot,
    schemaName: string,
    logger?: ContextualLogger,
): { isValid: boolean; data?: z.infer<T>; error?: EnhancedValidationError } {
    const data = doc.data();
    if (!data) {
        return { isValid: false };
    }

    const dataWithId = { ...data, id: doc.id };
    const result = validateSafely(schema, dataWithId, {
        schemaName,
        operation: 'read',
        documentId: doc.id,
        collection: doc.ref.parent.id,
        logger,
    });

    if (result.success) {
        return { isValid: true, data: result.data };
    } else {
        return { isValid: false, error: result.error };
    }
}

/**
 * Validate an array of documents with error aggregation
 */
export function validateDocumentBatch<T extends z.ZodSchema>(
    schema: T,
    docs: admin.firestore.DocumentSnapshot[],
    schemaName: string,
    options: {
        skipInvalid?: boolean; // Skip invalid docs instead of throwing
        logger?: ContextualLogger;
    } = {},
): {
    validDocuments: Array<{ doc: admin.firestore.DocumentSnapshot; data: z.infer<T> }>;
    invalidDocuments: Array<{ doc: admin.firestore.DocumentSnapshot; error: EnhancedValidationError }>;
} {
    const validDocuments: Array<{ doc: admin.firestore.DocumentSnapshot; data: z.infer<T> }> = [];
    const invalidDocuments: Array<{ doc: admin.firestore.DocumentSnapshot; error: EnhancedValidationError }> = [];

    for (const doc of docs) {
        try {
            const data = validateFirestoreDocument(schema, doc, schemaName, options.logger);
            validDocuments.push({ doc, data });
        } catch (error) {
            if (error instanceof EnhancedValidationError) {
                invalidDocuments.push({ doc, error });
                if (!options.skipInvalid) {
                    throw error; // Re-throw if not skipping invalid docs
                }
            } else {
                throw error; // Re-throw non-validation errors
            }
        }
    }

    return { validDocuments, invalidDocuments };
}

/**
 * Create a validated transform function for use in services
 *
 * Example:
 * ```typescript
 * const transformGroupDocument = createValidatedTransform(
 *     GroupDocumentSchema,
 *     'GroupDocument',
 *     (data) => ({
 *         ...data,
 *         // Additional transformations
 *     })
 * );
 * ```
 */
export function createValidatedTransform<TSchema extends z.ZodSchema, TResult>(schema: TSchema, schemaName: string, transform: (validatedData: z.infer<TSchema>) => TResult) {
    return (doc: admin.firestore.DocumentSnapshot, logger?: ContextualLogger): TResult => {
        const validatedData = validateFirestoreDocument(schema, doc, schemaName, logger);
        return transform(validatedData);
    };
}

/**
 * Wrap a Firestore write operation with validation
 */
export async function safeWrite<T>(
    writeOperation: () => Promise<T>,
    validationFn: () => void, // Function that performs validation
    context: {
        operationType: string;
        documentId?: string;
        collection?: string;
        logger?: ContextualLogger;
    },
): Promise<T> {
    try {
        // Validate before writing
        validationFn();

        // Perform the write operation
        return await writeOperation();
    } catch (error) {
        if (error instanceof EnhancedValidationError) {
            const logContext = context.logger;
            if (logContext) {
                logContext.error(`${context.operationType} failed validation`, {
                    documentId: context.documentId,
                    collection: context.collection,
                    validationError: error.getUserFriendlyMessage(),
                });
            }
        }
        throw error;
    }
}
