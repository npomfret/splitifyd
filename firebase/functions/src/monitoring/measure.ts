/**
 * Simple measurement wrapper functions
 *
 * Provides clean API for measuring function execution time
 * and recording metrics with the lightweight metrics system.
 */

import { metrics, MetricType } from './lightweight-metrics';

/**
 * Generic measurement wrapper
 */
export async function measure<T>(type: MetricType, operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    let success = true;

    try {
        const result = await fn();
        return result;
    } catch (error) {
        success = false;
        throw error;
    } finally {
        const duration = Date.now() - start;
        metrics.record(type, operation, duration, success);
    }
}

/**
 * Convenience function for API operations
 */
export const measureApi = <T>(operation: string, fn: () => Promise<T>): Promise<T> => measure('api', operation, fn);

/**
 * Convenience function for database operations
 */
export const measureDb = <T>(operation: string, fn: () => Promise<T>): Promise<T> => measure('db', operation, fn);

/**
 * Convenience function for trigger operations
 */
export const measureTrigger = <T>(operation: string, fn: () => Promise<T>): Promise<T> => measure('trigger', operation, fn);

/**
 * Synchronous measurement wrapper (for non-async operations)
 */
export function measureSync<T>(type: MetricType, operation: string, fn: () => T): T {
    const start = Date.now();
    let success = true;

    try {
        const result = fn();
        return result;
    } catch (error) {
        success = false;
        throw error;
    } finally {
        const duration = Date.now() - start;
        metrics.record(type, operation, duration, success);
    }
}

/**
 * Synchronous convenience functions
 */
export const measureApiSync = <T>(operation: string, fn: () => T): T => measureSync('api', operation, fn);

export const measureDbSync = <T>(operation: string, fn: () => T): T => measureSync('db', operation, fn);

export const measureTriggerSync = <T>(operation: string, fn: () => T): T => measureSync('trigger', operation, fn);
