import { z } from 'zod';
import { logger } from '../logger';
import type { ContextualLogger } from '../utils/contextual-logger';

/**
 * Validation metrics and monitoring utilities
 *
 * Tracks validation failures, performance metrics, and provides
 * enhanced error reporting for schema validation issues.
 */

/**
 * Additional context for validation errors
 */
interface ValidationContext {
    requestId?: string;
    clientVersion?: string;
    source?: string;
    [key: string]: string | number | boolean | undefined;
}

/**
 * Validation error details for monitoring
 */
interface ValidationError {
    schemaName: string;
    documentId?: string;
    errorDetails: z.ZodError;
    operation: 'read' | 'write' | 'update';
    collection?: string;
    timestamp: Date;
    uid?: string;
    additionalContext?: ValidationContext;
}

/**
 * Validation metrics counter
 */
class ValidationMetrics {
    private static instance: ValidationMetrics;
    private metrics = {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        failures: new Map<string, number>(), // schema -> count
    };

    static getInstance(): ValidationMetrics {
        if (!ValidationMetrics.instance) {
            ValidationMetrics.instance = new ValidationMetrics();
        }
        return ValidationMetrics.instance;
    }

    recordSuccess(): void {
        this.metrics.totalValidations++;
        this.metrics.successfulValidations++;
    }

    recordFailure(schemaName: string): void {
        this.metrics.totalValidations++;
        this.metrics.failedValidations++;

        const count = this.metrics.failures.get(schemaName) || 0;
        this.metrics.failures.set(schemaName, count + 1);
    }
}

/**
 * Enhanced validation function with monitoring and detailed error reporting
 */
export function validateWithMonitoring<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
    context: {
        schemaName: string;
        operation: 'read' | 'write' | 'update';
        documentId?: string;
        collection?: string;
        uid?: string;
        logger?: ContextualLogger;
        additionalContext?: ValidationContext;
    },
): z.infer<T> {
    const metrics = ValidationMetrics.getInstance();
    const startTime = Date.now();

    try {
        const result = schema.parse(data);

        // Record success metrics
        metrics.recordSuccess();

        // Log performance for slow validations
        const duration = Date.now() - startTime;
        if (duration > 100) {
            // Log validations taking more than 100ms
            const logContext = context.logger || logger;
            logContext.warn('Slow validation detected', {
                schemaName: context.schemaName,
                duration,
                operation: context.operation,
                documentId: context.documentId,
            });
        }

        return result;
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Record failure metrics
            metrics.recordFailure(context.schemaName);

            // Create detailed validation error
            const validationError: ValidationError = {
                schemaName: context.schemaName,
                documentId: context.documentId,
                errorDetails: error,
                operation: context.operation,
                collection: context.collection,
                timestamp: new Date(),
                uid: context.uid,
                additionalContext: context.additionalContext,
            };

            // Log detailed error information
            const logContext = context.logger || logger;
            logContext.error('Schema validation failed', {
                ...validationError,
                formattedErrors: formatZodError(error),
                invalidData: JSON.stringify(data, null, 2),
                duration: Date.now() - startTime,
            });

            // Re-throw with enhanced context
            throw new EnhancedValidationError(validationError, error);
        }

        // Re-throw non-Zod errors
        throw error;
    }
}

/**
 * Enhanced validation error with additional context
 */
class EnhancedValidationError extends Error {
    constructor(
        public readonly validationError: ValidationError,
        public readonly zodError: z.ZodError,
    ) {
        super(`Schema validation failed for ${validationError.schemaName}: ${formatZodError(zodError)}`);
        this.name = 'EnhancedValidationError';
    }
}

/**
 * Format ZodError into readable string
 */
function formatZodError(error: z.ZodError): string {
    return error
        .issues
        .map((err: z.ZodIssue) => {
            const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
            return `${path}${err.message}`;
        })
        .join(', ');
}
