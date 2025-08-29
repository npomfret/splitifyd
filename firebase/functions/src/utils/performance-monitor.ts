import { logger } from '../logger';

/**
 * Performance monitoring utility for tracking operation durations
 */
export class PerformanceMonitor {
    private startTime: number;
    private operationName: string;
    private context: Record<string, any>;

    constructor(operationName: string, context: Record<string, any> = {}) {
        this.operationName = operationName;
        this.context = context;
        this.startTime = Date.now();
    }

    /**
     * End timing and log performance metrics
     */
    end(additionalContext?: Record<string, any>): number {
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
        context: Record<string, any> = {}
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
        additionalContext: Record<string, any> = {}
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
        additionalContext: Record<string, any> = {}
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
}

/**
 * Decorator to automatically monitor service methods
 * Usage: @MonitorPerformance('ServiceName', 'methodName')
 */
export function MonitorPerformance(serviceName: string, methodName?: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const actualMethodName = methodName || propertyName;

        descriptor.value = async function (...args: any[]) {
            return PerformanceMonitor.monitorServiceCall(
                serviceName,
                actualMethodName,
                () => originalMethod.apply(this, args),
                { 
                    // Add argument context for key operations
                    ...(args[0] && typeof args[0] === 'string' ? { resourceId: args[0] } : {}),
                    ...(args.length > 0 ? { argCount: args.length } : {})
                }
            );
        };

        return descriptor;
    };
}