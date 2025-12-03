import * as functions from 'firebase-functions';
import { LogContext, LoggerContext } from './logger-context';

/**
 * Logger instance that can have its own additional context
 */
export interface ContextualLogger {
    debug(label: string, data?: Record<string, any>): void;
    info(label: string, data?: Record<string, any>): void;
    warn(label: string, data?: Record<string, any>): void;
    error(message: string, error: Error | any, context?: any): void;
    child(context: Partial<LogContext>): ContextualLogger;
}

/**
 * Implementation of contextual logger that automatically includes context
 */
class ContextualLoggerImpl implements ContextualLogger {
    constructor(private additionalContext: Partial<LogContext> = {}) {}

    /**
     * Get the combined context (AsyncLocalStorage + instance context)
     */
    private getFullContext(): LogContext {
        const asyncContext = LoggerContext.get();
        return { ...asyncContext, ...this.additionalContext };
    }

    /**
     * Build log data with context fields and additional data
     */
    private buildLogData(context: LogContext, data?: Record<string, any>, includeRequestFields = false): Record<string, any> {
        const logData: Record<string, any> = {};

        // Add ID if provided (maintains existing pattern)
        if (data?.id) {
            logData.id = data.id;
        }

        // Add context fields if they exist
        if (context.uid) logData.uid = context.uid;
        if (context.correlationId) logData.correlationId = context.correlationId;
        if (context.groupId) logData.groupId = context.groupId;
        if (context.expenseId) logData.expenseId = context.expenseId;
        if (context.settlementId) logData.settlementId = context.settlementId;
        if (context.operation) logData.operation = context.operation;
        if (context.service) logData.service = context.service;

        // Add request fields for errors
        if (includeRequestFields) {
            if (context.requestPath) logData.requestPath = context.requestPath;
            if (context.requestMethod) logData.requestMethod = context.requestMethod;
        }

        // Add any additional data fields (excluding already handled ones)
        if (data) {
            Object.keys(data).forEach((key) => {
                if (key !== 'id' && key !== 'uid' && key !== 'correlationId') {
                    logData[key] = data[key];
                }
            });
        }

        return logData;
    }

    /**
     * Log debug message with automatic context inclusion
     */
    debug(label: string, data?: Record<string, any>): void {
        const context = this.getFullContext();
        const logData = this.buildLogData(context, data);
        functions.logger.debug(label, logData);
    }

    /**
     * Log info message with automatic context inclusion
     * Only logs when something actually changes (maintains existing pattern)
     */
    info(label: string, data?: Record<string, any>): void {
        const context = this.getFullContext();
        const logData = this.buildLogData(context, data);
        functions.logger.info(label, logData);
    }

    /**
     * Log warning with automatic context inclusion
     */
    warn(label: string, data?: Record<string, any>): void {
        const context = this.getFullContext();
        const logData = this.buildLogData(context, data);
        functions.logger.warn(label, logData);
    }

    /**
     * Log error with automatic context inclusion
     * Keeps errors rich and detailed (maintains existing pattern)
     */
    error(message: string, error: Error | any, additionalContext?: any): void {
        const context = this.getFullContext();

        let errorData: Record<string, unknown>;
        if (error instanceof Error) {
            // Capture all enumerable properties (e.g., code, path, issues for Zod/Firebase errors)
            const enumerableProps: Record<string, unknown> = {};
            for (const key of Object.keys(error)) {
                enumerableProps[key] = (error as unknown as Record<string, unknown>)[key];
            }
            errorData = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                ...enumerableProps,
            };
        } else {
            errorData = error;
        }

        const logData = this.buildLogData(context, { error: errorData }, true);

        // Add any additional context provided
        if (additionalContext) {
            Object.assign(logData, additionalContext);
        }

        functions.logger.error(message, logData);
    }

    /**
     * Create a child logger with additional context
     * Useful for services that want to add their own context
     */
    child(context: Partial<LogContext>): ContextualLogger {
        const combinedContext = { ...this.additionalContext, ...context };
        return new ContextualLoggerImpl(combinedContext);
    }
}

/**
 * Main logger instance
 * Automatically includes context from AsyncLocalStorage
 */
export const logger: ContextualLogger = new ContextualLoggerImpl();
