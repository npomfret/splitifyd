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

// Automatically enable in development
if (import.meta.env.DEV) {
    enableStreamingDebug();
}
