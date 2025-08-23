/**
 * Debug utilities for the streaming implementation
 */

import { streamingMetrics } from './streaming-metrics';
import { logInfo } from './browser-logger';

/**
 * Print streaming metrics to console (for development debugging)
 */
export function debugStreamingMetrics(): void {
    const debug = streamingMetrics.getDebugInfo();

    console.group('📊 Streaming Implementation Metrics');
    console.log('📈 Performance:', debug.performance);
    console.log('💰 Cost Estimates:', debug.cost);
    console.log('📋 Raw Metrics:', debug.metrics);
    console.groupEnd();
}

/**
 * Log streaming metrics at info level
 */
export function logStreamingMetrics(): void {
    const debug = streamingMetrics.getDebugInfo();
    logInfo('Streaming metrics snapshot', debug);
}

/**
 * Enable streaming debug mode (adds window.streamingDebug)
 */
export function enableStreamingDebug(): void {
    if (typeof window !== 'undefined') {
        (window as any).streamingDebug = {
            showMetrics: debugStreamingMetrics,
            getMetrics: () => streamingMetrics.getSnapshot(),
            getDebugInfo: () => streamingMetrics.getDebugInfo(),
            resetMetrics: () => streamingMetrics.reset(),
        };

        console.log('🔧 Streaming debug enabled. Use window.streamingDebug to access utilities.');
        console.log('Available methods:', Object.keys((window as any).streamingDebug));
    }
}

/**
 * Disable streaming debug mode
 */
export function disableStreamingDebug(): void {
    if (typeof window !== 'undefined' && (window as any).streamingDebug) {
        delete (window as any).streamingDebug;
        console.log('🔧 Streaming debug disabled.');
    }
}

// Automatically enable in development
if (import.meta.env.DEV) {
    enableStreamingDebug();
}
