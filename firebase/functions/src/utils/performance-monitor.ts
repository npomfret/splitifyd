import { logger } from '../logger';
import { performanceMetricsCollector } from './performance-metrics-collector';
import { 
    getMonitoringThreshold, 
    isLargeResultSet, 
    MONITORING_LABELS 
} from '../monitoring/monitoring-config';

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
 * Context for query performance monitoring
 */
export interface QueryContext extends PerformanceContext {
    collection?: string;
    collectionGroup?: string;
    queryType?: 'single' | 'collection' | 'collection-group' | 'indexed' | 'scan';
    filterCount?: number;
    orderByCount?: number;
    resultCount?: number;
    indexUsed?: boolean;
    operation?: string;
}

/**
 * Context for batch operation monitoring  
 */
export interface BatchOperationContext extends PerformanceContext {
    batchSize?: number;
    stepCount?: number;
    currentStep?: string;
    totalOperations?: number;
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
            const duration = monitor.end({ success: true });
            
            // Record in metrics collector
            performanceMetricsCollector.recordMetric(operationName, {
                timestamp: new Date(),
                duration,
                success: true,
                operationType: 'general',
                context
            });
            
            return result;
        } catch (error) {
            const duration = monitor.end({ success: false, error: error instanceof Error ? error.message : String(error) });
            
            // Record in metrics collector
            performanceMetricsCollector.recordMetric(operationName, {
                timestamp: new Date(),
                duration,
                success: false,
                operationType: 'general',
                context
            });
            
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
        const startTime = Date.now();
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            
            // Extract result count if possible
            let resultCount: number | undefined;
            if (result && typeof result === 'object') {
                if ('size' in result) {
                    resultCount = (result as any).size;
                } else if ('length' in result) {
                    resultCount = (result as any).length;
                } else if ('docs' in result && Array.isArray((result as any).docs)) {
                    resultCount = (result as any).docs.length;
                }
            }
            
            // Record in metrics collector
            performanceMetricsCollector.recordDbOperation(
                operationType,
                collection,
                duration,
                true,
                resultCount,
                additionalContext
            );
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Record in metrics collector
            performanceMetricsCollector.recordDbOperation(
                operationType,
                collection,
                duration,
                false,
                undefined,
                additionalContext
            );
            
            throw error;
        }
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
        const startTime = Date.now();
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            
            // Record in metrics collector
            performanceMetricsCollector.recordServiceCall(
                serviceName,
                methodName,
                duration,
                true,
                additionalContext
            );
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Record in metrics collector
            performanceMetricsCollector.recordServiceCall(
                serviceName,
                methodName,
                duration,
                false,
                additionalContext
            );
            
            throw error;
        }
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

    /**
     * Monitor Firestore query operations with detailed performance tracking
     */
    static async monitorQuery<T>(
        queryType: 'single' | 'collection' | 'collection-group' | 'indexed' | 'scan',
        operation: () => Promise<T>,
        context: QueryContext = {}
    ): Promise<T> {
        const monitor = new PerformanceMonitor(`firestore-query-${queryType}`, {
            queryType,
            ...context,
        });
        
        try {
            const result = await operation();
            const duration = monitor.end({ 
                success: true,
                queryResult: 'completed'
            });

            // Enhanced slow query detection with different thresholds by query type
            const slowThreshold = queryType === 'single' ? 100 : 
                                 queryType === 'indexed' ? 200 :
                                 queryType === 'scan' ? 1000 : 500;

            if (duration > slowThreshold) {
                logger.warn(`Slow ${queryType} query detected`, {
                    queryType,
                    collection: context.collection,
                    collectionGroup: context.collectionGroup,
                    duration_ms: duration,
                    resultCount: context.resultCount,
                    filterCount: context.filterCount,
                    indexUsed: context.indexUsed,
                    slowThreshold,
                    operation: context.operation
                });
            }

            // Alert on potential full collection scans
            if (queryType === 'scan' && context.resultCount !== undefined && context.resultCount > 100) {
                logger.warn(`Large collection scan detected`, {
                    collection: context.collection,
                    resultCount: context.resultCount,
                    duration_ms: duration,
                    operation: context.operation,
                    recommendation: 'Consider adding composite index'
                });
            }

            return result;
        } catch (error) {
            monitor.end({ 
                success: false, 
                queryResult: 'error',
                error: error instanceof Error ? error.message : String(error) 
            });
            throw error;
        }
    }

    /**
     * Monitor batch operations with step-by-step tracking
     */
    static async monitorBatchOperation<T>(
        operationName: string,
        operation: (stepTracker: (stepName: string, stepOperation: () => Promise<any>) => Promise<any>) => Promise<T>,
        context: BatchOperationContext = {}
    ): Promise<T> {
        const overallMonitor = new PerformanceMonitor(`batch-${operationName}`, {
            operationName,
            ...context,
        });

        const stepTimings: { [stepName: string]: number } = {};
        let stepCount = 0;

        const stepTracker = async <S>(stepName: string, stepOperation: () => Promise<S>): Promise<S> => {
            stepCount++;
            const stepMonitor = new PerformanceMonitor(`batch-step-${stepName}`, {
                batchOperation: operationName,
                stepName,
                stepIndex: stepCount,
            });

            try {
                const result = await stepOperation();
                const stepDuration = stepMonitor.end({ success: true });
                stepTimings[stepName] = stepDuration;
                return result;
            } catch (error) {
                stepMonitor.end({ 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error) 
                });
                throw error;
            }
        };

        try {
            const result = await operation(stepTracker);
            const totalDuration = overallMonitor.end({ 
                success: true,
                stepCount,
                stepTimings: JSON.stringify(stepTimings)
            });

            // Log detailed batch operation performance
            logger.info(`Batch operation completed`, {
                operationName,
                totalDuration_ms: totalDuration,
                stepCount,
                stepTimings,
                batchSize: context.batchSize,
                averageStepTime: stepCount > 0 ? totalDuration / stepCount : 0
            });

            return result;
        } catch (error) {
            overallMonitor.end({ 
                success: false,
                stepCount,
                error: error instanceof Error ? error.message : String(error),
                stepTimings: JSON.stringify(stepTimings)
            });
            throw error;
        }
    }

    /**
     * Monitor transaction operations with conflict tracking
     */
    static async monitorTransaction<T>(
        transactionName: string,
        operation: () => Promise<T>,
        context: PerformanceContext = {}
    ): Promise<T> {
        return this.monitor(
            `transaction-${transactionName}`,
            async () => {
                try {
                    const result = await operation();
                    return result;
                } catch (error) {
                    // Track transaction-specific errors
                    const isConflictError = error instanceof Error && (
                        error.message.includes('CONCURRENT_UPDATE') ||
                        error.message.includes('transaction failed') ||
                        error.message.includes('aborted')
                    );

                    if (isConflictError) {
                        logger.warn(`Transaction conflict detected`, {
                            transactionName,
                            error: error.message,
                            context,
                            recommendation: 'Consider optimistic locking or retry logic'
                        });
                    }

                    throw error;
                }
            },
            {
                transactionName,
                ...context
            }
        );
    }

    // ========================================================================
    // SCALABLE MEMBERSHIP MONITORING - For Firestore Migration Completion
    // ========================================================================

    /**
     * Monitor subcollection queries with specialized thresholds and alerts
     * Specifically designed for the scalable membership architecture
     */
    static async monitorSubcollectionQuery<T>(
        operationType: keyof typeof MONITORING_LABELS.SUBCOLLECTION_OPERATIONS,
        groupId: string,
        operation: () => Promise<T>,
        additionalContext: PerformanceContext = {}
    ): Promise<T> {
        const startTime = Date.now();
        const operationLabel = MONITORING_LABELS.SUBCOLLECTION_OPERATIONS[operationType];
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            
            // Extract result count if available
            let resultCount: number | undefined;
            if (result && typeof result === 'object') {
                if ('length' in result && Array.isArray(result)) {
                    resultCount = result.length;
                } else if ('size' in result) {
                    resultCount = (result as any).size;
                }
            }
            
            const context = {
                groupId,
                resultCount,
                operationType,
                operationLabel,
                ...additionalContext
            };

            // Get dynamic thresholds for subcollection operations
            const thresholds = getMonitoringThreshold(operationLabel, `groups/${groupId}/members`);
            
            // Log performance metrics with structured format
            logger.info('subcollection_query_completed', {
                operation: operationLabel,
                duration_ms: duration,
                group_id: groupId,
                result_count: resultCount,
                success: true,
                threshold_warning_ms: thresholds.warning,
                threshold_critical_ms: thresholds.critical
            });

            // Check for performance issues
            if (duration > thresholds.critical) {
                logger.warn('Critical subcollection query performance', {
                    operation: operationLabel,
                    duration_ms: duration,
                    threshold_ms: thresholds.critical,
                    groupId,
                    resultCount,
                    recommendation: 'Check Firestore indexes and query structure',
                    migration_phase: 'scalable_membership'
                });
            } else if (duration > thresholds.warning) {
                logger.warn('Slow subcollection query detected', {
                    operation: operationLabel,
                    duration_ms: duration,
                    threshold_ms: thresholds.warning,
                    groupId,
                    resultCount,
                    migration_phase: 'scalable_membership'
                });
            }

            // Check for large result sets that may indicate scaling issues
            if (resultCount && isLargeResultSet(resultCount, 'subcollection')) {
                logger.warn('Large subcollection result set detected', {
                    operation: operationLabel,
                    groupId,
                    resultCount,
                    recommendation: 'Consider pagination or result limiting',
                    migration_phase: 'scalable_membership'
                });
            }

            // Record in metrics collector with specialized context
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration,
                success: true,
                operationType: 'subcollection-query',
                context: {
                    ...context,
                    migrationPhase: 'scalable_membership',
                    queryType: 'subcollection'
                }
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Log structured error metrics
            logger.error('subcollection_query_failed', {
                operation: operationLabel,
                duration_ms: duration,
                group_id: groupId,
                success: false,
                error: errorMessage
            });

            logger.error('Subcollection query failed', {
                operation: operationLabel,
                groupId,
                duration_ms: duration,
                error: errorMessage,
                migration_phase: 'scalable_membership',
                context: additionalContext
            });

            // Record failure in metrics collector
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration,
                success: false,
                operationType: 'subcollection-query',
                context: {
                    groupId,
                    error: errorMessage,
                    migrationPhase: 'scalable_membership',
                    queryType: 'subcollection',
                    ...additionalContext
                }
            });

            throw error;
        }
    }

    /**
     * Monitor collectionGroup queries specifically for the scalable membership architecture
     */
    static async monitorCollectionGroupQuery<T>(
        operationType: keyof typeof MONITORING_LABELS.COLLECTION_GROUP_OPERATIONS,
        userId: string,
        operation: () => Promise<T>,
        additionalContext: PerformanceContext = {}
    ): Promise<T> {
        const startTime = Date.now();
        const operationLabel = MONITORING_LABELS.COLLECTION_GROUP_OPERATIONS[operationType];
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            
            // Extract result count
            let resultCount: number | undefined;
            if (result && typeof result === 'object') {
                if ('length' in result && Array.isArray(result)) {
                    resultCount = result.length;
                } else if ('size' in result) {
                    resultCount = (result as any).size;
                }
            }

            const context = {
                userId,
                resultCount,
                operationType,
                operationLabel,
                queryType: 'collection-group',
                ...additionalContext
            };

            // Get thresholds for collectionGroup operations
            const thresholds = getMonitoringThreshold('collection-group', 'members');
            
            // Log performance metrics
            logger.info('collection_group_query_completed', {
                operation: operationLabel,
                duration_ms: duration,
                user_id: userId,
                result_count: resultCount,
                success: true,
                threshold_warning_ms: thresholds.warning,
                threshold_critical_ms: thresholds.critical
            });

            // Performance alerting
            if (duration > thresholds.critical) {
                logger.warn('Critical collectionGroup query performance', {
                    operation: operationLabel,
                    duration_ms: duration,
                    threshold_ms: thresholds.critical,
                    userId,
                    resultCount,
                    recommendation: 'Verify collectionGroup composite index exists',
                    migration_phase: 'scalable_membership'
                });
            } else if (duration > thresholds.warning) {
                logger.warn('Slow collectionGroup query detected', {
                    operation: operationLabel,
                    duration_ms: duration,
                    threshold_ms: thresholds.warning,
                    userId,
                    resultCount,
                    migration_phase: 'scalable_membership'
                });
            }

            // Alert on users with excessive group memberships
            if (resultCount && isLargeResultSet(resultCount, 'collection-group')) {
                logger.warn('User with excessive group memberships', {
                    operation: operationLabel,
                    userId,
                    groupCount: resultCount,
                    recommendation: 'Consider user education or membership limits',
                    migration_phase: 'scalable_membership'
                });
            }

            // Record metrics
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration,
                success: true,
                operationType: 'collection-group-query',
                context: {
                    ...context,
                    migrationPhase: 'scalable_membership'
                }
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            logger.error('collection_group_query_failed', {
                operation: operationLabel,
                duration_ms: duration,
                user_id: userId,
                success: false,
                error: errorMessage
            });

            logger.error('CollectionGroup query failed', {
                operation: operationLabel,
                userId,
                duration_ms: duration,
                error: errorMessage,
                migration_phase: 'scalable_membership',
                context: additionalContext
            });

            // Record failure
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration,
                success: false,
                operationType: 'collection-group-query',
                context: {
                    userId,
                    error: errorMessage,
                    migrationPhase: 'scalable_membership',
                    queryType: 'collection-group',
                    ...additionalContext
                }
            });

            throw error;
        }
    }

    /**
     * Monitor trigger execution with detailed step tracking
     * Specifically for change-tracker and other subcollection-related triggers
     */
    static async monitorTriggerExecution<T>(
        triggerName: keyof typeof MONITORING_LABELS.TRIGGER_OPERATIONS,
        documentPath: string,
        operation: (stepTracker: (stepName: string, stepOp: () => Promise<any>) => Promise<any>) => Promise<T>,
        additionalContext: PerformanceContext = {}
    ): Promise<T> {
        const startTime = Date.now();
        const operationLabel = MONITORING_LABELS.TRIGGER_OPERATIONS[triggerName];
        const stepTimings: Record<string, number> = {};
        let stepCount = 0;

        const stepTracker = async <S>(stepName: string, stepOperation: () => Promise<S>): Promise<S> => {
            const stepStart = Date.now();
            stepCount++;
            
            try {
                const result = await stepOperation();
                const stepDuration = Date.now() - stepStart;
                stepTimings[stepName] = stepDuration;
                
                // Log individual step if it's slow
                if (stepDuration > 500) {
                    logger.warn('Slow trigger step detected', {
                        trigger: operationLabel,
                        step: stepName,
                        duration_ms: stepDuration,
                        documentPath,
                        migration_phase: 'scalable_membership'
                    });
                }
                
                return result;
            } catch (error) {
                const stepDuration = Date.now() - stepStart;
                stepTimings[`${stepName}_failed`] = stepDuration;
                
                logger.error('Trigger step failed', {
                    trigger: operationLabel,
                    step: stepName,
                    duration_ms: stepDuration,
                    documentPath,
                    error: error instanceof Error ? error.message : String(error),
                    migration_phase: 'scalable_membership'
                });
                
                throw error;
            }
        };

        try {
            const result = await operation(stepTracker);
            const totalDuration = Date.now() - startTime;
            
            const context = {
                documentPath,
                stepCount,
                stepTimings,
                operationLabel,
                ...additionalContext
            };

            // Get thresholds for trigger operations
            const thresholds = getMonitoringThreshold('trigger.general', 'triggers');
            
            // Log completion metrics
            logger.info('trigger_execution_completed', {
                trigger: operationLabel,
                duration_ms: totalDuration,
                document_path: documentPath,
                step_count: stepCount,
                success: true,
                step_timings: stepTimings
            });

            // Performance alerting for triggers
            if (totalDuration > thresholds.critical) {
                logger.warn('Critical trigger execution time', {
                    trigger: operationLabel,
                    duration_ms: totalDuration,
                    threshold_ms: thresholds.critical,
                    documentPath,
                    stepCount,
                    stepTimings,
                    recommendation: 'Review trigger logic and database operations',
                    migration_phase: 'scalable_membership'
                });
            } else if (totalDuration > thresholds.warning) {
                logger.warn('Slow trigger execution detected', {
                    trigger: operationLabel,
                    duration_ms: totalDuration,
                    threshold_ms: thresholds.warning,
                    documentPath,
                    stepCount,
                    stepTimings,
                    migration_phase: 'scalable_membership'
                });
            }

            // Record metrics
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration: totalDuration,
                success: true,
                operationType: 'trigger-execution',
                context: {
                    ...context,
                    migrationPhase: 'scalable_membership'
                }
            });

            return result;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            logger.error('trigger_execution_failed', {
                trigger: operationLabel,
                duration_ms: totalDuration,
                document_path: documentPath,
                step_count: stepCount,
                success: false,
                error: errorMessage,
                step_timings: stepTimings
            });

            logger.error('Trigger execution failed', {
                trigger: operationLabel,
                documentPath,
                duration_ms: totalDuration,
                stepCount,
                stepTimings,
                error: errorMessage,
                migration_phase: 'scalable_membership',
                context: additionalContext
            });

            // Record failure
            performanceMetricsCollector.recordMetric(operationLabel, {
                timestamp: new Date(),
                duration: totalDuration,
                success: false,
                operationType: 'trigger-execution',
                context: {
                    documentPath,
                    stepCount,
                    stepTimings,
                    error: errorMessage,
                    migrationPhase: 'scalable_membership',
                    ...additionalContext
                }
            });

            throw error;
        }
    }
}