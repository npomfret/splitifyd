import * as functions from 'firebase-functions';
import { LoggerContext, LogContext } from './logger-context';

/**
 * Logger instance that can have its own additional context
 */
export interface ContextualLogger {
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
     * Log info message with automatic context inclusion
     * Only logs when something actually changes (maintains existing pattern)
     */
    info(label: string, data?: Record<string, any>): void {
        const context = this.getFullContext();
        
        // Build the log data
        const logData: Record<string, any> = {};
        
        // Add ID if provided (maintains existing pattern)
        if (data?.id) {
            logData.id = data.id;
        }
        
        // Add context fields if they exist
        if (context.userId) logData.userId = context.userId;
        if (context.correlationId) logData.correlationId = context.correlationId;
        if (context.groupId) logData.groupId = context.groupId;
        if (context.expenseId) logData.expenseId = context.expenseId;
        if (context.settlementId) logData.settlementId = context.settlementId;
        if (context.operation) logData.operation = context.operation;
        if (context.service) logData.service = context.service;
        
        // Add any additional data fields (excluding 'id' which we already handled)
        if (data) {
            Object.keys(data).forEach(key => {
                if (key !== 'id' && key !== 'userId' && key !== 'correlationId') {
                    logData[key] = data[key];
                }
            });
        }
        
        functions.logger.info(label, logData);
    }
    
    /**
     * Log warning with automatic context inclusion
     */
    warn(label: string, data?: Record<string, any>): void {
        const context = this.getFullContext();
        
        const logData: Record<string, any> = {};
        
        // Add context fields that have values
        if (context.userId) logData.userId = context.userId;
        if (context.correlationId) logData.correlationId = context.correlationId;
        if (context.groupId) logData.groupId = context.groupId;
        if (context.expenseId) logData.expenseId = context.expenseId;
        if (context.settlementId) logData.settlementId = context.settlementId;
        if (context.operation) logData.operation = context.operation;
        if (context.service) logData.service = context.service;
        
        // Add any additional data fields
        if (data) {
            Object.keys(data).forEach(key => {
                if (key !== 'id' && key !== 'userId' && key !== 'correlationId') {
                    logData[key] = data[key];
                }
            });
        }
        
        functions.logger.warn(label, logData);
    }
    
    /**
     * Log error with automatic context inclusion
     * Keeps errors rich and detailed (maintains existing pattern)
     */
    error(message: string, error: Error | any, additionalContext?: any): void {
        const context = this.getFullContext();
        
        const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : error;
        
        const logData: Record<string, any> = {
            error: errorData,
        };
        
        // Add context fields
        if (context.userId) logData.userId = context.userId;
        if (context.correlationId) logData.correlationId = context.correlationId;
        if (context.groupId) logData.groupId = context.groupId;
        if (context.expenseId) logData.expenseId = context.expenseId;
        if (context.settlementId) logData.settlementId = context.settlementId;
        if (context.requestPath) logData.requestPath = context.requestPath;
        if (context.requestMethod) logData.requestMethod = context.requestMethod;
        if (context.operation) logData.operation = context.operation;
        if (context.service) logData.service = context.service;
        
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

/**
 * Also export as contextualLogger for clarity
 */
export const contextualLogger = logger;