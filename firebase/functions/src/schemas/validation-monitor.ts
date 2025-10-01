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
    additionalContext?: Record<string, any>;
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

    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalValidations > 0 ? (this.metrics.successfulValidations / this.metrics.totalValidations) * 100 : 0,
            topFailures: Array.from(this.metrics.failures.entries())
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5),
        };
    }

    reset(): void {
        this.metrics = {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            failures: new Map(),
        };
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
        additionalContext?: Record<string, any>;
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
export class EnhancedValidationError extends Error {
    constructor(
        public readonly validationError: ValidationError,
        public readonly zodError: z.ZodError,
    ) {
        super(`Schema validation failed for ${validationError.schemaName}: ${formatZodError(zodError)}`);
        this.name = 'EnhancedValidationError';
    }

    /**
     * Get user-friendly error message for API responses
     */
    getUserFriendlyMessage(): string {
        const firstError = this.zodError.issues[0];
        if (!firstError) {
            return 'Invalid data format';
        }

        const field = firstError.path.join('.');
        const message = firstError.message;

        return field ? `${field}: ${message}` : message;
    }
}

/**
 * Format ZodError into readable string
 */
function formatZodError(error: z.ZodError): string {
    return error.issues
        .map((err: z.ZodIssue) => {
            const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
            return `${path}${err.message}`;
        })
        .join(', ');
}

/**
 * Safe validation that logs failures but doesn't throw
 * Useful for monitoring without breaking the application
 */
export function validateSafely<T extends z.ZodSchema>(
    schema: T,
    data: unknown,
    context: {
        schemaName: string;
        operation: 'read' | 'write' | 'update';
        documentId?: string;
        collection?: string;
        logger?: ContextualLogger;
    },
): { success: true; data: z.infer<T> } | { success: false; error: EnhancedValidationError } {
    try {
        const validatedData = validateWithMonitoring(schema, data, context);
        return { success: true, data: validatedData };
    } catch (error) {
        if (error instanceof EnhancedValidationError) {
            return { success: false, error };
        }
        throw error; // Re-throw non-validation errors
    }
}

/**
 * Get current validation metrics
 */
function getValidationMetrics() {
    return ValidationMetrics.getInstance().getMetrics();
}

/**
 * Reset validation metrics (useful for testing)
 */
function resetValidationMetrics() {
    ValidationMetrics.getInstance().reset();
}

/**
 * Middleware to log validation metrics periodically
 */
function startValidationMetricsLogging(intervalMinutes: number = 60) {
    const intervalMs = intervalMinutes * 60 * 1000;

    setInterval(() => {
        const metrics = getValidationMetrics();
        if (metrics.totalValidations > 0) {
            logger.info('Validation metrics report', metrics);
        }
    }, intervalMs);
}
