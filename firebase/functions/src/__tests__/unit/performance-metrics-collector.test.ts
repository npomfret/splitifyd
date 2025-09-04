import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMetricsCollector } from '../../utils/performance-metrics-collector';

describe('PerformanceMetricsCollector', () => {
    let collector: PerformanceMetricsCollector;

    beforeEach(() => {
        // Get fresh instance and clear any existing metrics
        collector = PerformanceMetricsCollector.getInstance();
        collector.clearMetrics();
        collector.stopPeriodicReporting();
    });

    afterEach(() => {
        collector.clearMetrics();
        collector.stopPeriodicReporting();
    });

    describe('Circular Buffer Functionality', () => {
        it('should store metrics in circular buffer correctly', () => {
            const operationName = 'test-operation';
            
            // Record some metrics
            for (let i = 0; i < 5; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(),
                    duration: 100 + i,
                    success: true,
                    operationType: 'test',
                    context: {}
                });
            }

            const stats = collector.getOperationStats(operationName);
            expect(stats).toBeDefined();
            expect(stats!.totalExecutions).toBe(5);
            expect(stats!.averageDuration).toBe(102); // (100+101+102+103+104)/5
        });

        it('should handle buffer wrap-around correctly', () => {
            const operationName = 'wrap-test';
            const maxMetrics = 1000;
            
            // Fill buffer beyond capacity
            const totalMetrics = maxMetrics + 100;
            for (let i = 0; i < totalMetrics; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(Date.now() + i),
                    duration: i,
                    success: true,
                    operationType: 'test',
                    context: {}
                });
            }

            const stats = collector.getOperationStats(operationName);
            expect(stats).toBeDefined();
            expect(stats!.totalExecutions).toBe(maxMetrics); // Should be capped at maxMetrics
            
            // Should contain the most recent metrics (from 100 to 1099)
            expect(stats!.minDuration).toBe(100);
            expect(stats!.maxDuration).toBe(1099);
        });

        it('should maintain chronological order after wrap-around', () => {
            const operationName = 'chronology-test';
            
            // Fill buffer with timestamps
            const now = Date.now();
            for (let i = 0; i < 1005; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(now + i * 1000),
                    duration: i,
                    success: true,
                    operationType: 'test',
                    context: {}
                });
            }

            const stats = collector.getOperationStats(operationName);
            expect(stats).toBeDefined();
            
            // Should have earliest timestamp from index 5 (after wrap-around)
            expect(stats!.firstExecuted.getTime()).toBe(now + 5 * 1000);
            expect(stats!.lastExecuted.getTime()).toBe(now + 1004 * 1000);
        });
    });

    describe('Stale Operation Pruning', () => {
        it('should not prune recently active operations', () => {
            const operationName = 'active-operation';
            
            collector.recordMetric(operationName, {
                timestamp: new Date(),
                duration: 100,
                success: true,
                operationType: 'test',
                context: {}
            });

            const debugBefore = collector.getDebugInfo();
            expect(debugBefore.operationCount).toBe(1);

            // Force periodic report (which includes pruning)
            collector['generatePeriodicReport']();

            const debugAfter = collector.getDebugInfo();
            expect(debugAfter.operationCount).toBe(1); // Should not be pruned
        });

        it('should prune stale operations after threshold time', () => {
            const operationName = 'stale-operation';
            
            // Record metric and manually set old lastUpdated time
            collector.recordMetric(operationName, {
                timestamp: new Date(),
                duration: 100,
                success: true,
                operationType: 'test',
                context: {}
            });

            // Manually set buffer's lastUpdated to be very old (older than 3 * 5 minutes)
            const buffer = collector['metrics'].get(operationName)!;
            buffer.lastUpdated = Date.now() - (16 * 60 * 1000); // 16 minutes ago (> 15 minutes threshold)

            const debugBefore = collector.getDebugInfo();
            expect(debugBefore.operationCount).toBe(1);

            // Force periodic report with pruning by calling the pruning method directly
            collector['pruneStaleOperations'](Date.now());

            const debugAfter = collector.getDebugInfo();
            expect(debugAfter.operationCount).toBe(0); // Should be pruned
        });
    });

    describe('Memory Management', () => {
        it('should maintain bounded memory per operation', () => {
            const operationName = 'memory-test';
            
            // Record many metrics
            for (let i = 0; i < 2000; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(),
                    duration: i,
                    success: true,
                    operationType: 'test',
                    context: {}
                });
            }

            const debugInfo = collector.getDebugInfo();
            expect(debugInfo.totalMetrics).toBe(1000); // Should be capped at maxMetricsPerOperation
        });

        it('should report accurate metrics count', () => {
            collector.recordMetric('op1', {
                timestamp: new Date(),
                duration: 100,
                success: true,
                operationType: 'test',
                context: {}
            });

            collector.recordMetric('op2', {
                timestamp: new Date(),
                duration: 200,
                success: true,
                operationType: 'test',
                context: {}
            });

            expect(collector.getMetricsCount()).toBe(2);
            
            const debugInfo = collector.getDebugInfo();
            expect(debugInfo.totalMetrics).toBe(2);
            expect(debugInfo.operationCount).toBe(2);
        });
    });

    describe('Statistics Calculation', () => {
        it('should calculate percentiles correctly with circular buffer', () => {
            const operationName = 'percentile-test';
            const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
            
            durations.forEach(duration => {
                collector.recordMetric(operationName, {
                    timestamp: new Date(),
                    duration,
                    success: true,
                    operationType: 'test',
                    context: {}
                });
            });

            const stats = collector.getOperationStats(operationName);
            expect(stats).toBeDefined();
            expect(stats!.medianDuration).toBe(600); // Median of sorted array [100,200,300,400,500,600,700,800,900,1000] is at index 5
            expect(stats!.p95Duration).toBe(1000); // 95th percentile (at index Math.floor(10 * 0.95) = 9)
            expect(stats!.minDuration).toBe(100);
            expect(stats!.maxDuration).toBe(1000);
        });

        it('should handle success rate calculations correctly', () => {
            const operationName = 'success-rate-test';
            
            // Record mix of successful and failed operations
            for (let i = 0; i < 10; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(),
                    duration: 100,
                    success: i < 8, // 8 successful, 2 failed
                    operationType: 'test',
                    context: {}
                });
            }

            const stats = collector.getOperationStats(operationName);
            expect(stats).toBeDefined();
            expect(stats!.totalExecutions).toBe(10);
            expect(stats!.successfulExecutions).toBe(8);
            expect(stats!.failedExecutions).toBe(2);
            expect(stats!.successRate).toBe(0.8);
        });
    });

    describe('Performance Alerts', () => {
        it('should detect high failure rates', async () => {
            const { logger } = await import('../../logger');
            const loggerWarnSpy = vi.spyOn(logger, 'warn');
            const operationName = 'failure-test';
            
            // Record mostly failed operations
            for (let i = 0; i < 10; i++) {
                collector.recordMetric(operationName, {
                    timestamp: new Date(),
                    duration: 100,
                    success: i < 2, // Only 2 successful out of 10
                    operationType: 'test',
                    context: {}
                });
            }

            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'High failure rate detected',
                expect.objectContaining({
                    operationName,
                    failureRate: 80
                })
            );

            loggerWarnSpy.mockRestore();
        });
    });

    describe('Lifecycle Management', () => {
        it('should clear metrics and reset state', () => {
            collector.recordMetric('test-op', {
                timestamp: new Date(),
                duration: 100,
                success: true,
                operationType: 'test',
                context: {}
            });

            expect(collector.getMetricsCount()).toBe(1);
            
            collector.clearMetrics();
            
            expect(collector.getMetricsCount()).toBe(0);
            expect(collector.getDebugInfo().operationCount).toBe(0);
        });

        it('should provide comprehensive debug information', () => {
            collector.recordMetric('debug-test', {
                timestamp: new Date(),
                duration: 100,
                success: true,
                operationType: 'test',
                context: {}
            });

            const debugInfo = collector.getDebugInfo();
            
            expect(debugInfo.operationCount).toBe(1);
            expect(debugInfo.totalMetrics).toBe(1);
            expect(debugInfo.memoryFootprint).toBeGreaterThan(0);
            expect(debugInfo.oldestOperation).toBeDefined();
            expect(debugInfo.oldestOperation!.name).toBe('debug-test');
        });
    });

    describe('Service Methods', () => {
        it('should record service calls with proper formatting', () => {
            collector.recordServiceCall('user-service', 'createUser', 150, true, { userId: '123' });
            
            const stats = collector.getOperationStats('user-service.createUser');
            expect(stats).toBeDefined();
            expect(stats!.operationType).toBe('service-call');
            expect(stats!.averageDuration).toBe(150);
        });

        it('should record database operations with proper formatting', () => {
            collector.recordDbOperation('read', 'users', 50, true, 5, { query: 'active' });
            
            const stats = collector.getOperationStats('db-read-users');
            expect(stats).toBeDefined();
            expect(stats!.operationType).toBe('database');
            expect(stats!.averageDuration).toBe(50);
        });

        it('should record batch operations with proper formatting', () => {
            collector.recordBatchOperation('process-emails', 2000, true, 100, 10, { batch: 'daily' });
            
            const stats = collector.getOperationStats('batch-process-emails');
            expect(stats).toBeDefined();
            expect(stats!.operationType).toBe('batch');
            expect(stats!.averageDuration).toBe(2000);
        });
    });
});