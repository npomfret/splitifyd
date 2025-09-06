/**
 * Configuration for production monitoring of the scalable membership architecture
 * 
 * This file defines performance thresholds and monitoring rules specifically
 * for the subcollection-based membership system introduced in the scalability migration.
 */

export interface SamplingRateConfig {
    /** Sampling rate for service calls (0.0-1.0) */
    serviceCallRate: number;
    /** Sampling rate for database operations */
    databaseOperationRate: number;
    /** Sampling rate for query operations */
    queryOperationRate: number;
    /** Sampling rate for batch operations */
    batchOperationRate: number;
    /** Sampling rate for transaction operations */
    transactionRate: number;
    /** Sampling rate for trigger executions */
    triggerExecutionRate: number;
    /** Sampling rate for validation operations */
    validationRate: number;
    
    /** Special conditions */
    errorSamplingRate: number;        // Errors are always important
    slowOperationRate: number;        // Slow ops need attention
    criticalOperationRate: number;    // Critical ops must be tracked
}

export interface SubcollectionMonitoringThresholds {
    /** Query execution time warning threshold (ms) */
    queryWarningThreshold: number;
    /** Query execution time critical threshold (ms) */
    queryCriticalThreshold: number;
    /** Maximum expected document count before alerting */
    maxDocumentCount: number;
    /** Failure rate threshold (0.0-1.0) for alerts */
    failureRateThreshold: number;
    /** Minimum sample size for statistical alerts */
    minSampleSize: number;
}

export interface TriggerMonitoringThresholds {
    /** Trigger execution time warning threshold (ms) */
    executionWarningThreshold: number;
    /** Trigger execution time critical threshold (ms) */
    executionCriticalThreshold: number;
    /** Maximum member fetch time within triggers (ms) */
    memberFetchThreshold: number;
    /** Change document creation timeout (ms) */
    changeDocumentThreshold: number;
}

export interface CollectionGroupMonitoringThresholds {
    /** CollectionGroup query warning threshold (ms) */
    queryWarningThreshold: number;
    /** CollectionGroup query critical threshold (ms) */
    queryCriticalThreshold: number;
    /** Maximum groups per user before performance warning */
    maxGroupsPerUser: number;
    /** Index usage monitoring - warn if not using expected index */
    expectedIndexUsage: boolean;
}

/**
 * Sampling rates configuration for performance monitoring
 */
export const SAMPLING_RATES: SamplingRateConfig = {
    // Base sampling rates by operation type
    serviceCallRate: 0.05,           // 5% of service calls
    databaseOperationRate: 0.10,      // 10% of database operations
    queryOperationRate: 0.10,         // 10% of queries
    batchOperationRate: 0.20,         // 20% of batch operations
    transactionRate: 0.20,            // 20% of transactions
    triggerExecutionRate: 0.15,       // 15% of trigger executions
    validationRate: 0.01,             // 1% of validations (very frequent)
    
    // Special conditions - always sample these
    errorSamplingRate: 1.0,           // 100% of errors
    slowOperationRate: 1.0,           // 100% of slow operations
    criticalOperationRate: 1.0,       // 100% of critical operations
};

/**
 * Production monitoring configuration for scalable membership architecture
 */
export const SUBCOLLECTION_MONITORING_CONFIG: {
    subcollectionQueries: SubcollectionMonitoringThresholds;
    triggers: TriggerMonitoringThresholds;
    collectionGroup: CollectionGroupMonitoringThresholds;
    sampling: SamplingRateConfig;
} = {
    subcollectionQueries: {
        queryWarningThreshold: 100,    // Subcollection queries should be < 100ms
        queryCriticalThreshold: 500,   // Alert if > 500ms (indicates index issues)
        maxDocumentCount: 1000,        // Alert if group has > 1000 members
        failureRateThreshold: 0.05,    // Alert if > 5% of queries fail
        minSampleSize: 10,             // Need at least 10 samples for statistical analysis
    },
    triggers: {
        executionWarningThreshold: 1000,   // Triggers should complete in < 1s
        executionCriticalThreshold: 5000,  // Alert if trigger takes > 5s
        memberFetchThreshold: 200,         // Member fetching within triggers should be < 200ms
        changeDocumentThreshold: 100,      // Change document creation should be < 100ms
    },
    collectionGroup: {
        queryWarningThreshold: 200,    // CollectionGroup queries should be < 200ms
        queryCriticalThreshold: 1000,  // Alert if > 1s (may indicate missing composite index)
        maxGroupsPerUser: 100,         // Alert if user is in > 100 groups
        expectedIndexUsage: true,      // Expect queries to use the collectionGroup index
    },
    sampling: SAMPLING_RATES,
};

/**
 * Monitoring labels for categorizing different types of subcollection operations
 */
export const MONITORING_LABELS = {
    SUBCOLLECTION_OPERATIONS: {
        GET_MEMBER: 'subcollection.getMember',
        GET_MEMBERS: 'subcollection.getMembers', 
        CREATE_MEMBER: 'subcollection.createMember',
        UPDATE_MEMBER: 'subcollection.updateMember',
        DELETE_MEMBER: 'subcollection.deleteMember',
    },
    COLLECTION_GROUP_OPERATIONS: {
        USER_GROUPS: 'collectionGroup.userGroups',
        MEMBER_LOOKUP: 'collectionGroup.memberLookup',
    },
    TRIGGER_OPERATIONS: {
        CHANGE_TRACKER: 'trigger.changeTracker',
        MEMBER_FETCH_IN_TRIGGER: 'trigger.memberFetch',
        CHANGE_DOC_CREATION: 'trigger.changeDocCreation',
    },
} as const;

/**
 * Get appropriate monitoring threshold based on operation type and collection
 */
export function getMonitoringThreshold(
    operationType: string,
    collection: string
): { warning: number; critical: number } {
    // Subcollection operations
    if (collection.includes('/members')) {
        return {
            warning: SUBCOLLECTION_MONITORING_CONFIG.subcollectionQueries.queryWarningThreshold,
            critical: SUBCOLLECTION_MONITORING_CONFIG.subcollectionQueries.queryCriticalThreshold,
        };
    }

    // CollectionGroup operations
    if (operationType === 'collection-group') {
        return {
            warning: SUBCOLLECTION_MONITORING_CONFIG.collectionGroup.queryWarningThreshold,
            critical: SUBCOLLECTION_MONITORING_CONFIG.collectionGroup.queryCriticalThreshold,
        };
    }

    // Trigger operations
    if (operationType.startsWith('trigger.')) {
        return {
            warning: SUBCOLLECTION_MONITORING_CONFIG.triggers.executionWarningThreshold,
            critical: SUBCOLLECTION_MONITORING_CONFIG.triggers.executionCriticalThreshold,
        };
    }

    // Default thresholds
    return { warning: 500, critical: 2000 };
}

/**
 * Determine if a query result count indicates a potential performance issue
 */
export function isLargeResultSet(count: number, operationType: string): boolean {
    if (operationType === 'collection-group') {
        return count > SUBCOLLECTION_MONITORING_CONFIG.collectionGroup.maxGroupsPerUser;
    }
    
    if (operationType.includes('subcollection')) {
        return count > SUBCOLLECTION_MONITORING_CONFIG.subcollectionQueries.maxDocumentCount;
    }

    return false;
}

