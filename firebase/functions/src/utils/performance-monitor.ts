import { logger } from '../logger';

/**
 * Context for performance monitoring operations
 */
export interface PerformanceContext {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Context for validation monitoring operations
 */
export interface ValidationContext extends PerformanceContext {
    documentId?: string;
    collection?: string;
    documentCount?: number;
    userId?: string;
    validationMode?: 'standard' | 'strict' | 'monitoring';
    operation?: string;
}

/**
 * Context for sync validation monitoring operations
 */
export interface SyncValidationContext extends PerformanceContext {
    documentId?: string;
    collection?: string;
    fieldName?: string;
    userId?: string;
}

/**
 * Performance monitoring utility for tracking operation durations
 */
export class PerformanceMonitor {
    private startTime: number;
    private operationName: string;
    private context: PerformanceContext;

    constructor(operationName: string, context: PerformanceContext = {}) {
        this.operationName = operationName;
        this.context = context;
        this.startTime = Date.now();
    }

    /**
     * End timing and log performance metrics
     */
    end(additionalContext?: PerformanceContext): number {
        const duration = Date.now() - this.startTime;
        const logContext = { 
            ...this.context, 
            ...additionalContext,
            duration_ms: duration 
        };

        // Log slow operations (> 1000ms) as warnings
        if (duration > 1000) {
            logger.warn(`slow-operation`, {
                operation: this.operationName,
                ...logContext
            });
        } 
        // Log moderately slow operations (> 500ms) as info
        else if (duration > 500) {
            logger.info(`moderate-duration-operation`, {
                operation: this.operationName,
                ...logContext
            });
        }
        // Only log debug for very detailed monitoring (can be filtered out in production)
        else {
            // For now, skip debug logging to avoid noise
            // Future: Add debug level when needed
        }

        return duration;
    }

    /**
     * Convenience method to wrap an async function with performance monitoring
     */
    static async monitor<T>(
        operationName: string,
        operation: () => Promise<T>,
        context: PerformanceContext = {}
    ): Promise<T> {
        const monitor = new PerformanceMonitor(operationName, context);
        
        try {
            const result = await operation();
            monitor.end({ success: true });
            return result;
        } catch (error) {
            monitor.end({ success: false, error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Monitor database operations specifically
     */
    static async monitorDbOperation<T>(
        operationType: 'read' | 'write' | 'query' | 'transaction',
        collection: string,
        operation: () => Promise<T>,
        additionalContext: PerformanceContext = {}
    ): Promise<T> {
        return this.monitor(
            `db-${operationType}`,
            operation,
            { 
                collection,
                operationType,
                ...additionalContext 
            }
        );
    }

    /**
     * Monitor service method calls
     */
    static async monitorServiceCall<T>(
        serviceName: string,
        methodName: string,
        operation: () => Promise<T>,
        additionalContext: PerformanceContext = {}
    ): Promise<T> {
        return this.monitor(
            `service-call`,
            operation,
            { 
                service: serviceName,
                method: methodName,
                ...additionalContext 
            }
        );
    }

    /**
     * Monitor validation operations specifically
     */
    static async monitorValidation<T>(
        validationType: 'document' | 'batch' | 'strict' | 'pre-operation',
        schemaName: string,
        operation: () => Promise<T>,
        context: ValidationContext = {}
    ): Promise<T> {
        const monitor = new PerformanceMonitor(`validation-${validationType}`, {
            schemaName,
            ...context,
            validationType,
        });
        
        try {
            const result = await operation();
            monitor.end({ 
                success: true,
                validationResult: 'passed'
            });
            return result;
        } catch (error) {
            const isValidationError = error instanceof Error && (
                error.message.includes('validation failed') ||
                error.name === 'EnhancedValidationError'
            );

            monitor.end({ 
                success: false,
                validationResult: isValidationError ? 'failed' : 'error',
                error: error instanceof Error ? error.message : String(error),
                errorType: isValidationError ? 'validation' : 'system'
            });

            // Log validation failures with enhanced context
            if (isValidationError) {
                logger.warn(`Validation failed`, {
                    validationType,
                    schemaName,
                    documentId: context.documentId,
                    collection: context.collection,
                    userId: context.userId,
                    validationMode: context.validationMode || 'standard',
                    operation: context.operation,
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            throw error;
        }
    }

    /**
     * Monitor sync validation operations (for immediate validation checks)
     */
    static monitorSyncValidation<T>(
        validationType: 'schema' | 'field' | 'constraint',
        schemaName: string,
        operation: () => T,
        context: SyncValidationContext = {}
    ): T {
        const startTime = Date.now();
        
        try {
            const result = operation();
            const duration = Date.now() - startTime;

            // Log slow sync validations (>50ms for sync operations)
            if (duration > 50) {
                logger.warn(`Slow sync validation detected`, {
                    validationType,
                    schemaName,
                    duration_ms: duration,
                    ...context
                });
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const isValidationError = error instanceof Error && (
                error.message.includes('validation failed') ||
                error.name === 'ZodError' ||
                error.name === 'EnhancedValidationError'
            );

            // Log validation failures
            if (isValidationError) {
                logger.info(`Sync validation failed`, {
                    validationType,
                    schemaName,
                    duration_ms: duration,
                    validationResult: 'failed',
                    error: error instanceof Error ? error.message : String(error),
                    ...context
                });
            }

            throw error;
        }
    }
}