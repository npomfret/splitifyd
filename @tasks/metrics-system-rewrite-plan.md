# Metrics System Complete Rewrite Plan

## Overview
Complete rewrite of the performance metrics system to be lightweight, in-memory only, with bounded collections and simple aggregation.

## Core Principles
1. **No Firestore storage** - Everything stays in memory
2. **5% sampling rate** - Only record 5% of measured operations  
3. **Bounded collections** - Max 100 items per metric type
4. **No environment differences** - Same behavior in test/dev/prod
5. **Periodic aggregation** - Scheduled function logs aggregated data
6. **No backward compatibility** - Delete all old code

## Architecture Design

### 1. Simple In-Memory Metrics Collector
```typescript
// Simple singleton with bounded circular buffers
class LightweightMetrics {
    private static instance: LightweightMetrics;
    
    // Circular buffers - max 100 entries each
    private apiMetrics: CircularBuffer<Metric> = new CircularBuffer(100);
    private dbMetrics: CircularBuffer<Metric> = new CircularBuffer(100);
    private triggerMetrics: CircularBuffer<Metric> = new CircularBuffer(100);
    
    // 5% sampling rate
    private readonly SAMPLE_RATE = 0.05;
    
    record(type: MetricType, operation: string, duration: number, success: boolean) {
        // Simple random sampling
        if (Math.random() > this.SAMPLE_RATE) return;
        
        const metric = {
            timestamp: Date.now(),
            operation,
            duration,
            success
        };
        
        // Add to appropriate buffer (overwrites oldest when full)
        switch(type) {
            case 'api': this.apiMetrics.add(metric); break;
            case 'db': this.dbMetrics.add(metric); break;  
            case 'trigger': this.triggerMetrics.add(metric); break;
        }
    }
    
    getSnapshot() {
        return {
            api: this.apiMetrics.toArray(),
            db: this.dbMetrics.toArray(),
            trigger: this.triggerMetrics.toArray()
        };
    }
    
    clear() {
        this.apiMetrics.clear();
        this.dbMetrics.clear();
        this.triggerMetrics.clear();
    }
}
```

### 2. Circular Buffer Implementation
```typescript
class CircularBuffer<T> {
    private buffer: T[] = [];
    private pointer = 0;
    
    constructor(private maxSize: number) {}
    
    add(item: T) {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push(item);
        } else {
            this.buffer[this.pointer] = item;
            this.pointer = (this.pointer + 1) % this.maxSize;
        }
    }
    
    toArray(): T[] {
        return [...this.buffer];
    }
    
    clear() {
        this.buffer = [];
        this.pointer = 0;
    }
}
```

### 3. Scheduled Aggregation Function
```typescript
// Runs every 30 minutes
export const logMetricsAggregation = onSchedule(
    { schedule: 'every 30 minutes' },
    async () => {
        const metrics = LightweightMetrics.getInstance();
        const snapshot = metrics.getSnapshot();
        
        // Calculate simple aggregates
        const aggregates = {
            api: calculateAggregates(snapshot.api),
            db: calculateAggregates(snapshot.db),
            trigger: calculateAggregates(snapshot.trigger),
            timestamp: new Date().toISOString()
        };
        
        // Just log the aggregates - no storage
        logger.info('Performance Metrics Report', aggregates);
        
        // Clear old metrics older than 1 hour
        clearOldMetrics(snapshot);
    }
);

function calculateAggregates(metrics: Metric[]) {
    if (!metrics.length) return null;
    
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const successCount = metrics.filter(m => m.success).length;
    
    return {
        count: metrics.length,
        successRate: successCount / metrics.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50: durations[Math.floor(durations.length * 0.5)],
        p95: durations[Math.floor(durations.length * 0.95)],
        p99: durations[Math.floor(durations.length * 0.99)]
    };
}
```

## Implementation Steps

### Phase 1: Delete Old System (Step 1-5)

#### Step 1: Remove Core Metrics Files
Delete these files completely:
- `/firebase/functions/src/utils/performance-monitor.ts`
- `/firebase/functions/src/utils/performance-metrics-collector.ts`
- `/firebase/functions/src/utils/metrics-storage.ts`
- `/firebase/functions/src/utils/metrics-storage-factory.ts`
- `/firebase/functions/src/utils/test-metrics-storage.ts`
- `/firebase/functions/src/utils/metrics-sampler.ts`
- `/firebase/functions/src/utils/query-performance-tracker.ts`

#### Step 2: Remove Scheduled Functions
Delete these files:
- `/firebase/functions/src/scheduled/metrics-aggregation.ts`
- `/firebase/functions/src/scheduled/metrics-cleanup.ts`

#### Step 3: Remove Firestore Integration
Remove from `IFirestoreReader.ts`:
- `queryPerformanceMetrics()` method
- `queryAggregatedStats()` method

Remove from `FirestoreReader.ts`:
- Implementation of above methods
- All performance metrics related code

Remove from `IFirestoreWriter.ts`:
- `writePerformanceMetrics()` method
- `writePerformanceStats()` method

Remove from `FirestoreWriter.ts`:
- Implementation of above methods

#### Step 4: Clean Service Registration
In `/firebase/functions/src/services/serviceRegistration.ts`:
- Remove `metricsStorage` singleton
- Remove `getMetricsStorage()` function
- Remove all metrics-related imports

#### Step 5: Remove PerformanceMonitor Usage
Search and remove all instances of:
- `PerformanceMonitor.monitorServiceCall()`
- `PerformanceMonitor.monitorBatch()`
- `import { PerformanceMonitor }`
- Any performance monitoring wrapping

Files to clean:
- All services in `/firebase/functions/src/services/`
- All triggers in `/firebase/functions/src/triggers/`
- `/firebase/functions/src/index.ts`

### Phase 2: Build New System (Step 6-10)

#### Step 6: Create Lightweight Metrics Module
Create `/firebase/functions/src/monitoring/lightweight-metrics.ts`:
```typescript
export interface Metric {
    timestamp: number;
    operation: string;
    duration: number;
    success: boolean;
}

export type MetricType = 'api' | 'db' | 'trigger';

class CircularBuffer<T> {
    // Implementation as shown above
}

export class LightweightMetrics {
    // Implementation as shown above
}

export const metrics = LightweightMetrics.getInstance();
```

#### Step 7: Create Simple Measurement Wrapper
Create `/firebase/functions/src/monitoring/measure.ts`:
```typescript
import { metrics, MetricType } from './lightweight-metrics';

export async function measure<T>(
    type: MetricType,
    operation: string,
    fn: () => Promise<T>
): Promise<T> {
    const start = Date.now();
    let success = true;
    
    try {
        return await fn();
    } catch (error) {
        success = false;
        throw error;
    } finally {
        const duration = Date.now() - start;
        metrics.record(type, operation, duration, success);
    }
}

// Convenience functions
export const measureApi = <T>(op: string, fn: () => Promise<T>) => 
    measure('api', op, fn);

export const measureDb = <T>(op: string, fn: () => Promise<T>) => 
    measure('db', op, fn);

export const measureTrigger = <T>(op: string, fn: () => Promise<T>) => 
    measure('trigger', op, fn);
```

#### Step 8: Create Aggregation Function
Create `/firebase/functions/src/scheduled/metrics-logger.ts`:
```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from '../logger';
import { metrics } from '../monitoring/lightweight-metrics';

export const logMetrics = onSchedule(
    {
        schedule: 'every 30 minutes',
        timeZone: 'UTC',
        region: 'us-central1',
        memory: '256MiB',
        maxInstances: 1,
    },
    async () => {
        const snapshot = metrics.getSnapshot();
        
        // Calculate aggregates
        const report = {
            timestamp: new Date().toISOString(),
            api: calculateStats(snapshot.api),
            db: calculateStats(snapshot.db),
            trigger: calculateStats(snapshot.trigger)
        };
        
        // Log the report
        logger.info('📊 Performance Metrics Report', report);
        
        // Clear metrics older than 1 hour
        const oneHourAgo = Date.now() - 3600000;
        metrics.clearOlderThan(oneHourAgo);
    }
);

function calculateStats(metrics: Metric[]) {
    // Implementation shown above
}
```

#### Step 9: Update Service Implementations
Example for GroupService:
```typescript
// Before:
async getGroup(groupId: string): Promise<Group> {
    return PerformanceMonitor.monitorServiceCall(
        'GroupService',
        'getGroup',
        async () => {
            // implementation
        }
    );
}

// After:
import { measureDb } from '../monitoring/measure';

async getGroup(groupId: string): Promise<Group> {
    return measureDb('GroupService.getGroup', async () => {
        // implementation
    });
}
```

#### Step 10: Register Scheduled Function
In `/firebase/functions/src/index.ts`:
```typescript
// Remove old metrics functions
// export { aggregateMetrics, aggregateMetricsDaily } from './scheduled/metrics-aggregation';

// Add new lightweight logger
export { logMetrics } from './scheduled/metrics-logger';
```

### Phase 3: Testing & Verification (Step 11-12)

#### Step 11: Test the New System
1. Run integration tests - should be much faster
2. Check that metrics are being collected (add temporary debug logging)
3. Verify scheduled function runs and logs aggregates
4. Confirm memory usage stays bounded

#### Step 12: Clean Up
1. Remove any debug logging
2. Remove old test files related to metrics
3. Update any documentation

## Files to Delete Completely

### Core Metrics System (7 files)
- `/firebase/functions/src/utils/performance-monitor.ts`
- `/firebase/functions/src/utils/performance-metrics-collector.ts`
- `/firebase/functions/src/utils/metrics-storage.ts`
- `/firebase/functions/src/utils/metrics-storage-factory.ts`
- `/firebase/functions/src/utils/test-metrics-storage.ts`
- `/firebase/functions/src/utils/metrics-sampler.ts`
- `/firebase/functions/src/utils/query-performance-tracker.ts`

### Scheduled Functions (2 files)
- `/firebase/functions/src/scheduled/metrics-aggregation.ts`
- `/firebase/functions/src/scheduled/metrics-cleanup.ts`

### Test Files
- Any test files specifically for metrics system

## Files to Create

### New Lightweight System (3 files)
1. `/firebase/functions/src/monitoring/lightweight-metrics.ts` - Core metrics collector
2. `/firebase/functions/src/monitoring/measure.ts` - Measurement wrapper functions
3. `/firebase/functions/src/scheduled/metrics-logger.ts` - Scheduled aggregation

## Files to Modify

### Remove Metrics Methods From:
1. `/firebase/functions/src/services/firestore/IFirestoreReader.ts`
2. `/firebase/functions/src/services/firestore/FirestoreReader.ts`
3. `/firebase/functions/src/services/firestore/IFirestoreWriter.ts`
4. `/firebase/functions/src/services/firestore/FirestoreWriter.ts`
5. `/firebase/functions/src/services/serviceRegistration.ts`

### Update Service Files (replace PerformanceMonitor with measure):
- `/firebase/functions/src/services/GroupService.ts`
- `/firebase/functions/src/services/ExpenseService.ts`
- `/firebase/functions/src/services/SettlementService.ts`
- `/firebase/functions/src/services/CommentService.ts`
- `/firebase/functions/src/services/GroupShareService.ts`
- `/firebase/functions/src/services/GroupMemberService.ts`
- `/firebase/functions/src/services/GroupPermissionService.ts`
- `/firebase/functions/src/services/PolicyService.ts`
- `/firebase/functions/src/services/UserPolicyService.ts`
- `/firebase/functions/src/services/UserService2.ts`
- `/firebase/functions/src/services/balance/BalanceCalculationService.ts`
- `/firebase/functions/src/services/FirestoreValidationService.ts`

### Update Trigger Files:
- `/firebase/functions/src/triggers/change-tracker.ts`
- `/firebase/functions/src/triggers/notification-triggers.ts`

### Update Index:
- `/firebase/functions/src/index.ts` - Export new scheduled function

## Expected Benefits

1. **Performance**: 
   - No Firestore queries for metrics
   - Integration tests run in ~90 seconds consistently
   - Minimal memory overhead (max 300 metrics in memory)

2. **Simplicity**:
   - ~200 lines of code vs thousands
   - No complex sampling logic
   - No Firestore schema management

3. **Reliability**:
   - No accumulating data
   - No cleanup needed
   - Same behavior in all environments

4. **Cost**:
   - No Firestore reads/writes for metrics
   - Reduced function execution time
   - Lower memory usage

## Implementation Time Estimate

- Phase 1 (Delete): 30 minutes
- Phase 2 (Build): 1 hour
- Phase 3 (Test): 30 minutes
- **Total**: ~2 hours

## Notes

- The 5% sampling rate means we'll capture enough data for trends without overhead
- Circular buffers ensure memory never grows unbounded
- Logging aggregates is sufficient for monitoring - no need to store
- This approach eliminates the root cause of test slowdowns completely