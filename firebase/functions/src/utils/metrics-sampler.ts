/**
 * Metrics Sampler
 * 
 * Implements intelligent sampling for performance metrics to reduce overhead
 * while maintaining statistical significance.
 * 
 * Sampling Strategy:
 * - Service calls: 5% default sampling
 * - Database operations: 10% default sampling
 * - Slow operations (>1s): 100% sampling
 * - Failed operations: 100% sampling
 * - Deterministic sampling based on request/operation ID for trace consistency
 */

import { createHash } from 'crypto';
import { logger } from '../logger';

export interface SamplingConfig {
    // Base sampling rates by operation type
    serviceCallRate: number;      // Default: 0.05 (5%)
    databaseOperationRate: number; // Default: 0.10 (10%)
    queryOperationRate: number;    // Default: 0.10 (10%)
    batchOperationRate: number;    // Default: 0.20 (20%)
    transactionRate: number;       // Default: 0.20 (20%)
    triggerExecutionRate: number;  // Default: 0.15 (15%)
    validationRate: number;        // Default: 0.01 (1%)
    
    // Override sampling rates for specific conditions
    slowOperationThreshold: number;  // ms, operations slower than this are always sampled
    errorSamplingRate: number;        // Default: 1.0 (100% of errors)
    criticalOperationRate: number;   // Default: 1.0 (100% of critical operations)
    
    // Burst sampling for anomaly detection
    burstSamplingEnabled: boolean;   // Enable burst sampling during anomalies
    burstSamplingRate: number;        // Rate during burst (default: 0.50)
    burstSamplingDuration: number;    // Duration of burst sampling in ms
}

export class MetricsSampler {
    private static instance: MetricsSampler;
    private config: SamplingConfig;
    private burstSamplingEndTime: number = 0;
    private samplingDecisionCache: Map<string, boolean> = new Map();
    private readonly cacheMaxSize = 10000;
    private readonly cacheTTL = 60000; // 1 minute
    private lastCacheCleanup = Date.now();

    private constructor(config?: Partial<SamplingConfig>) {
        this.config = {
            // Default sampling rates
            serviceCallRate: 0.05,
            databaseOperationRate: 0.10,
            queryOperationRate: 0.10,
            batchOperationRate: 0.20,
            transactionRate: 0.20,
            triggerExecutionRate: 0.15,
            validationRate: 0.01,
            
            // Condition-based sampling
            slowOperationThreshold: 1000,
            errorSamplingRate: 1.0,
            criticalOperationRate: 1.0,
            
            // Burst sampling
            burstSamplingEnabled: true,
            burstSamplingRate: 0.50,
            burstSamplingDuration: 300000, // 5 minutes
            
            ...config
        };
    }

    static getInstance(config?: Partial<SamplingConfig>): MetricsSampler {
        if (!MetricsSampler.instance) {
            MetricsSampler.instance = new MetricsSampler(config);
        }
        return MetricsSampler.instance;
    }

    /**
     * Determine if an operation should be sampled
     */
    shouldSample(
        operationType: string,
        operationName: string,
        context: {
            duration?: number;
            success?: boolean;
            critical?: boolean;
            requestId?: string;
            userId?: string;
            groupId?: string;
        } = {}
    ): { sample: boolean; rate: number; reason?: string } {
        // Always sample errors
        if (context.success === false) {
            return { 
                sample: true, 
                rate: this.config.errorSamplingRate,
                reason: 'error' 
            };
        }

        // Always sample slow operations
        if (context.duration && context.duration > this.config.slowOperationThreshold) {
            return { 
                sample: true, 
                rate: 1.0,
                reason: 'slow_operation' 
            };
        }

        // Always sample critical operations
        if (context.critical) {
            return { 
                sample: true, 
                rate: this.config.criticalOperationRate,
                reason: 'critical_operation' 
            };
        }

        // Check if we're in burst sampling mode
        if (this.isInBurstMode()) {
            const sample = this.deterministicSample(
                operationName, 
                this.config.burstSamplingRate,
                context
            );
            return { 
                sample, 
                rate: this.config.burstSamplingRate,
                reason: 'burst_sampling' 
            };
        }

        // Get base sampling rate for operation type
        const baseSamplingRate = this.getBaseSamplingRate(operationType);

        // Use deterministic sampling for consistency
        const sample = this.deterministicSample(
            operationName, 
            baseSamplingRate,
            context
        );

        return { 
            sample, 
            rate: baseSamplingRate,
            reason: 'normal_sampling' 
        };
    }

    /**
     * Get base sampling rate for operation type
     */
    private getBaseSamplingRate(operationType: string): number {
        const typeMap: Record<string, number> = {
            'service-call': this.config.serviceCallRate,
            'database': this.config.databaseOperationRate,
            'query': this.config.queryOperationRate,
            'batch': this.config.batchOperationRate,
            'transaction': this.config.transactionRate,
            'trigger': this.config.triggerExecutionRate,
            'validation': this.config.validationRate,
            'subcollection-query': this.config.queryOperationRate,
            'collection-group-query': this.config.queryOperationRate,
            'trigger-execution': this.config.triggerExecutionRate,
        };

        return typeMap[operationType] || 0.05; // Default 5% if unknown type
    }

    /**
     * Deterministic sampling based on operation identifier
     * Ensures consistent sampling decisions for the same operation
     */
    private deterministicSample(
        operationName: string,
        samplingRate: number,
        context: {
            requestId?: string;
            userId?: string;
            groupId?: string;
        }
    ): boolean {
        // Create a unique key for this operation
        const key = this.createOperationKey(operationName, context);

        // Check cache first
        const cachedDecision = this.getCachedDecision(key);
        if (cachedDecision !== undefined) {
            return cachedDecision;
        }

        // Generate deterministic hash
        const hash = createHash('md5')
            .update(key)
            .digest();

        // Convert first 4 bytes to number (0 to 2^32-1)
        const hashValue = hash.readUInt32BE(0);
        
        // Normalize to 0-1 range
        const normalizedValue = hashValue / 0xFFFFFFFF;

        // Make sampling decision
        const shouldSample = normalizedValue < samplingRate;

        // Cache the decision
        this.cacheDecision(key, shouldSample);

        return shouldSample;
    }

    /**
     * Create a unique key for an operation
     */
    private createOperationKey(
        operationName: string,
        context: {
            requestId?: string;
            userId?: string;
            groupId?: string;
        }
    ): string {
        const parts = [operationName];

        if (context.requestId) {
            parts.push(context.requestId);
        } else {
            // Use time bucket for operations without request ID
            // This ensures some consistency within a time window
            const timeBucket = Math.floor(Date.now() / 10000); // 10 second buckets
            parts.push(`time:${timeBucket}`);
        }

        if (context.userId) {
            parts.push(`user:${context.userId}`);
        }

        if (context.groupId) {
            parts.push(`group:${context.groupId}`);
        }

        return parts.join(':');
    }

    /**
     * Get cached sampling decision
     */
    private getCachedDecision(key: string): boolean | undefined {
        // Clean cache periodically
        this.cleanCacheIfNeeded();

        const cached = this.samplingDecisionCache.get(key);
        return cached;
    }

    /**
     * Cache sampling decision
     */
    private cacheDecision(key: string, decision: boolean): void {
        // Limit cache size
        if (this.samplingDecisionCache.size >= this.cacheMaxSize) {
            // Remove oldest entries (simple FIFO)
            const toRemove = this.samplingDecisionCache.size - this.cacheMaxSize + 1;
            const keys = Array.from(this.samplingDecisionCache.keys());
            for (let i = 0; i < toRemove; i++) {
                this.samplingDecisionCache.delete(keys[i]);
            }
        }

        this.samplingDecisionCache.set(key, decision);
    }

    /**
     * Clean cache periodically
     */
    private cleanCacheIfNeeded(): void {
        const now = Date.now();
        if (now - this.lastCacheCleanup > this.cacheTTL) {
            this.samplingDecisionCache.clear();
            this.lastCacheCleanup = now;
        }
    }

    /**
     * Enable burst sampling for anomaly detection
     */
    enableBurstSampling(durationMs?: number): void {
        if (!this.config.burstSamplingEnabled) {
            return;
        }

        const duration = durationMs || this.config.burstSamplingDuration;
        this.burstSamplingEndTime = Date.now() + duration;

        logger.info('Burst sampling enabled', {
            duration,
            rate: this.config.burstSamplingRate,
            endTime: new Date(this.burstSamplingEndTime).toISOString()
        });
    }

    /**
     * Disable burst sampling
     */
    disableBurstSampling(): void {
        this.burstSamplingEndTime = 0;
        logger.info('Burst sampling disabled');
    }

    /**
     * Check if currently in burst sampling mode
     */
    private isInBurstMode(): boolean {
        return this.config.burstSamplingEnabled && 
               this.burstSamplingEndTime > Date.now();
    }

    /**
     * Update sampling configuration
     */
    updateConfig(updates: Partial<SamplingConfig>): void {
        this.config = {
            ...this.config,
            ...updates
        };

        logger.info('Sampling configuration updated', updates);
    }

    /**
     * Get current sampling configuration
     */
    getConfig(): SamplingConfig {
        return { ...this.config };
    }

    /**
     * Get sampling statistics
     */
    getStats(): {
        cacheSize: number;
        burstMode: boolean;
        burstEndTime: number | null;
        config: SamplingConfig;
    } {
        return {
            cacheSize: this.samplingDecisionCache.size,
            burstMode: this.isInBurstMode(),
            burstEndTime: this.burstSamplingEndTime > 0 ? this.burstSamplingEndTime : null,
            config: this.getConfig()
        };
    }

    /**
     * Reset sampler state
     */
    reset(): void {
        this.samplingDecisionCache.clear();
        this.burstSamplingEndTime = 0;
        this.lastCacheCleanup = Date.now();
    }
}

// Export singleton instance
export const metricsSampler = MetricsSampler.getInstance();