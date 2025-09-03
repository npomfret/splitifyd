/**
 * Unit tests for production monitoring implementation
 * Tests the scalable membership architecture monitoring capabilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../../../utils/performance-monitor';
import { logger } from '../../../logger';
import { performanceMetricsCollector } from '../../../utils/performance-metrics-collector';

// Mock dependencies
vi.mock('../../../logger');
vi.mock('../../../utils/performance-metrics-collector');

const mockLogger = vi.mocked(logger);
const mockMetricsCollector = vi.mocked(performanceMetricsCollector);

describe('Performance Monitoring for Scalable Membership Architecture', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Subcollection Query Monitoring', () => {
        it('should monitor subcollection query with success metrics', async () => {
            const groupId = 'test-group-123';
            const userId = 'test-user-456';
            
            const mockResult = [
                { userId: 'user-1', memberRole: 'admin' },
                { userId: 'user-2', memberRole: 'member' }
            ];

            let duration = 0;
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(150); // Simulate 150ms operation
                duration = 150;
                return mockResult;
            });

            const result = await PerformanceMonitor.monitorSubcollectionQuery(
                'GET_MEMBERS',
                groupId,
                operation,
                { userId }
            );

            expect(result).toEqual(mockResult);
            expect(operation).toHaveBeenCalledOnce();

            // Verify structured logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                'subcollection_query_completed',
                expect.objectContaining({
                    operation: 'subcollection.getMembers',
                    group_id: groupId,
                    result_count: 2,
                    success: true,
                    threshold_warning_ms: 100,
                    threshold_critical_ms: 500
                })
            );

            // Should log warning for slow query (150ms > 100ms threshold)
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Slow subcollection query detected',
                expect.objectContaining({
                    operation: 'subcollection.getMembers',
                    groupId,
                    resultCount: 2,
                    migration_phase: 'scalable_membership'
                })
            );

            // Verify metrics recording
            expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
                'subcollection.getMembers',
                expect.objectContaining({
                    duration: expect.any(Number),
                    success: true,
                    operationType: 'subcollection-query',
                    context: expect.objectContaining({
                        migrationPhase: 'scalable_membership',
                        queryType: 'subcollection'
                    })
                })
            );
        });

        it('should monitor subcollection query failures with error tracking', async () => {
            const groupId = 'test-group-123';
            const error = new Error('Firestore permission denied');
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(75);
                throw error;
            });

            await expect(
                PerformanceMonitor.monitorSubcollectionQuery(
                    'GET_MEMBER',
                    groupId,
                    operation
                )
            ).rejects.toThrow('Firestore permission denied');

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'subcollection_query_failed',
                expect.objectContaining({
                    operation: 'subcollection.getMember',
                    group_id: groupId,
                    success: false,
                    error: 'Firestore permission denied'
                })
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Subcollection query failed',
                expect.objectContaining({
                    operation: 'subcollection.getMember',
                    groupId,
                    error: 'Firestore permission denied',
                    migration_phase: 'scalable_membership'
                })
            );

            // Verify failure metrics recording
            expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
                'subcollection.getMember',
                expect.objectContaining({
                    success: false,
                    operationType: 'subcollection-query',
                    context: expect.objectContaining({
                        error: 'Firestore permission denied',
                        migrationPhase: 'scalable_membership'
                    })
                })
            );
        });

        it('should alert on critical subcollection query performance', async () => {
            const groupId = 'test-group-123';
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(600); // 600ms > 500ms critical threshold
                return [];
            });

            await PerformanceMonitor.monitorSubcollectionQuery(
                'GET_MEMBERS',
                groupId,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Critical subcollection query performance',
                expect.objectContaining({
                    operation: 'subcollection.getMembers',
                    threshold_ms: 500,
                    groupId,
                    recommendation: 'Check Firestore indexes and query structure',
                    migration_phase: 'scalable_membership'
                })
            );
        });

        it('should alert on large subcollection result sets', async () => {
            const groupId = 'test-group-123';
            
            // Create mock result with >1000 members (exceeds threshold)
            const largeResult = Array.from({ length: 1200 }, (_, i) => ({
                userId: `user-${i}`,
                memberRole: 'member'
            }));
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(50);
                return largeResult;
            });

            await PerformanceMonitor.monitorSubcollectionQuery(
                'GET_MEMBERS',
                groupId,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Large subcollection result set detected',
                expect.objectContaining({
                    operation: 'subcollection.getMembers',
                    groupId,
                    resultCount: 1200,
                    recommendation: 'Consider pagination or result limiting',
                    migration_phase: 'scalable_membership'
                })
            );
        });
    });

    describe('Collection Group Query Monitoring', () => {
        it('should monitor collectionGroup query with user context', async () => {
            const userId = 'test-user-123';
            const mockGroups = [
                { id: 'group-1', name: 'Group 1' },
                { id: 'group-2', name: 'Group 2' },
                { id: 'group-3', name: 'Group 3' }
            ];

            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(180); // 180ms
                return mockGroups;
            });

            const result = await PerformanceMonitor.monitorCollectionGroupQuery(
                'USER_GROUPS',
                userId,
                operation,
                { queryComplexity: 'moderate' }
            );

            expect(result).toEqual(mockGroups);

            // Verify structured logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                'collection_group_query_completed',
                expect.objectContaining({
                    operation: 'collectionGroup.userGroups',
                    user_id: userId,
                    result_count: 3,
                    success: true,
                    threshold_warning_ms: 200,
                    threshold_critical_ms: 1000
                })
            );

            // Should not warn (180ms < 200ms threshold)
            expect(mockLogger.warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Slow collectionGroup query detected'),
                expect.any(Object)
            );
        });

        it('should alert on users with excessive group memberships', async () => {
            const userId = 'power-user-123';
            
            // Create mock result with >100 groups (exceeds threshold)
            const excessiveGroups = Array.from({ length: 150 }, (_, i) => ({
                id: `group-${i}`,
                name: `Group ${i}`
            }));
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(300);
                return excessiveGroups;
            });

            await PerformanceMonitor.monitorCollectionGroupQuery(
                'USER_GROUPS',
                userId,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'User with excessive group memberships',
                expect.objectContaining({
                    operation: 'collectionGroup.userGroups',
                    userId,
                    groupCount: 150,
                    recommendation: 'Consider user education or membership limits',
                    migration_phase: 'scalable_membership'
                })
            );
        });

        it('should alert on critical collectionGroup performance', async () => {
            const userId = 'test-user-123';
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(1200); // 1200ms > 1000ms critical threshold
                return [];
            });

            await PerformanceMonitor.monitorCollectionGroupQuery(
                'USER_GROUPS',
                userId,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Critical collectionGroup query performance',
                expect.objectContaining({
                    operation: 'collectionGroup.userGroups',
                    threshold_ms: 1000,
                    userId,
                    recommendation: 'Verify collectionGroup composite index exists',
                    migration_phase: 'scalable_membership'
                })
            );
        });
    });

    describe('Trigger Execution Monitoring', () => {
        it('should monitor trigger execution with step tracking', async () => {
            const documentPath = 'groups/test-group-123';
            const stepTimings: Record<string, number> = {};
            
            const operation = vi.fn(async (stepTracker: any) => {
                // Simulate multi-step trigger execution
                await stepTracker('member-fetch', async () => {
                    vi.advanceTimersByTime(150);
                    return ['user1', 'user2'];
                });
                
                await stepTracker('change-doc-creation', async () => {
                    vi.advanceTimersByTime(50);
                    return { id: 'change-123' };
                });
                
                return 'trigger-completed';
            });

            const result = await PerformanceMonitor.monitorTriggerExecution(
                'CHANGE_TRACKER',
                documentPath,
                operation
            );

            expect(result).toBe('trigger-completed');

            // Verify completion logging
            expect(mockLogger.info).toHaveBeenCalledWith(
                'trigger_execution_completed',
                expect.objectContaining({
                    trigger: 'trigger.changeTracker',
                    document_path: documentPath,
                    step_count: 2,
                    success: true,
                    step_timings: expect.any(Object)
                })
            );

            // Verify metrics recording with step context
            expect(mockMetricsCollector.recordMetric).toHaveBeenCalledWith(
                'trigger.changeTracker',
                expect.objectContaining({
                    success: true,
                    operationType: 'trigger-execution',
                    context: expect.objectContaining({
                        documentPath,
                        stepCount: 2,
                        migrationPhase: 'scalable_membership'
                    })
                })
            );
        });

        it('should alert on slow trigger steps', async () => {
            const documentPath = 'groups/test-group-123';
            
            const operation = vi.fn(async (stepTracker: any) => {
                await stepTracker('slow-member-fetch', async () => {
                    vi.advanceTimersByTime(600); // 600ms > 500ms step threshold
                    return ['user1'];
                });
                
                return 'completed';
            });

            await PerformanceMonitor.monitorTriggerExecution(
                'CHANGE_TRACKER',
                documentPath,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Slow trigger step detected',
                expect.objectContaining({
                    trigger: 'trigger.changeTracker',
                    step: 'slow-member-fetch',
                    duration_ms: 600,
                    documentPath,
                    migration_phase: 'scalable_membership'
                })
            );
        });

        it('should handle trigger step failures with detailed logging', async () => {
            const documentPath = 'groups/test-group-123';
            const stepError = new Error('Member fetch timeout');
            
            const operation = vi.fn(async (stepTracker: any) => {
                await stepTracker('member-fetch', async () => {
                    vi.advanceTimersByTime(100);
                    throw stepError;
                });
            });

            await expect(
                PerformanceMonitor.monitorTriggerExecution(
                    'CHANGE_TRACKER',
                    documentPath,
                    operation
                )
            ).rejects.toThrow('Member fetch timeout');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Trigger step failed',
                expect.objectContaining({
                    trigger: 'trigger.changeTracker',
                    step: 'member-fetch',
                    documentPath,
                    error: 'Member fetch timeout',
                    migration_phase: 'scalable_membership'
                })
            );
        });

        it('should alert on critical trigger execution time', async () => {
            const documentPath = 'groups/test-group-123';
            
            const operation = vi.fn(async () => {
                vi.advanceTimersByTime(6000); // 6000ms > 5000ms critical threshold
                return 'slow-completion';
            });

            await PerformanceMonitor.monitorTriggerExecution(
                'CHANGE_TRACKER',
                documentPath,
                operation
            );

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Critical trigger execution time',
                expect.objectContaining({
                    trigger: 'trigger.changeTracker',
                    threshold_ms: 5000,
                    documentPath,
                    recommendation: 'Review trigger logic and database operations',
                    migration_phase: 'scalable_membership'
                })
            );
        });
    });

    describe('Monitoring Configuration Integration', () => {
        it('should use dynamic thresholds based on operation type', async () => {
            // Test subcollection operation thresholds
            const subcollectionOperation = vi.fn(async () => {
                vi.advanceTimersByTime(120); // Between warning (100ms) and critical (500ms)
                return [];
            });

            await PerformanceMonitor.monitorSubcollectionQuery(
                'GET_MEMBERS',
                'test-group',
                subcollectionOperation
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'subcollection_query_completed',
                expect.objectContaining({
                    threshold_warning_ms: 100,
                    threshold_critical_ms: 500
                })
            );

            // Should trigger warning but not critical
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Slow subcollection query detected',
                expect.anything()
            );

            // Test collectionGroup operation thresholds  
            vi.clearAllMocks();
            
            const collectionGroupOperation = vi.fn(async () => {
                vi.advanceTimersByTime(250); // Between warning (200ms) and critical (1000ms)
                return [];
            });

            await PerformanceMonitor.monitorCollectionGroupQuery(
                'USER_GROUPS',
                'test-user',
                collectionGroupOperation
            );

            expect(mockLogger.info).toHaveBeenCalledWith(
                'collection_group_query_completed',
                expect.objectContaining({
                    threshold_warning_ms: 200,
                    threshold_critical_ms: 1000
                })
            );
        });

        it('should include migration phase context in all monitoring operations', async () => {
            const operations = [
                () => PerformanceMonitor.monitorSubcollectionQuery('GET_MEMBERS', 'group-1', async () => []),
                () => PerformanceMonitor.monitorCollectionGroupQuery('USER_GROUPS', 'user-1', async () => []),
                () => PerformanceMonitor.monitorTriggerExecution('CHANGE_TRACKER', 'groups/group-1', async () => 'done')
            ];

            for (const operation of operations) {
                await operation();
            }

            // All operations should include migration phase context
            const metricsRecordCalls = mockMetricsCollector.recordMetric.mock.calls;
            metricsRecordCalls.forEach(call => {
                const context = call[1].context;
                expect(context).toHaveProperty('migrationPhase', 'scalable_membership');
            });
        });
    });
});