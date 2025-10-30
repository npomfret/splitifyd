#!/usr/bin/env tsx

import * as fs from 'fs';
import * as readline from 'readline';
import * as os from 'os';
import * as path from 'path';

interface FunctionExecution {
    functionName: string;
    duration: number; // in milliseconds
    timestamp: Date;
    lineNumber: number;
}

interface MetricTypeData {
    count: number;
    successRate: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
    operations: Record<
        string,
        {
            count: number;
            successRate: number;
            avgDuration: number;
            p95: number;
        }
    >;
}

interface MetricsReportData {
    timestamp: string;
    samplingRate: number;
    api: MetricTypeData;
    db: MetricTypeData;
    trigger: MetricTypeData;
    memoryStats: {
        totalMetrics: number;
        apiCount: number;
        dbCount: number;
        triggerCount: number;
    };
}

interface SlowRequest {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    timestamp: Date;
    correlationId?: string;
}

interface FunctionStats {
    functionName: string;
    executions: FunctionExecution[];
    averageDuration: number;
    medianDuration: number;
    minDuration: number;
    maxDuration: number;
    standardDeviation: number;
    coefficientOfVariation: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number; // percentage change from first half to second half
    totalExecutions: number;
    firstExecution: Date;
    lastExecution: Date;
    outliers: number[]; // durations that are statistical outliers
    // Metrics data from lightweight metrics system (5% sampling)
    apiMetrics?: {
        sampledCount: number;
        sampledSuccessRate: number;
        sampledAvgDuration: number;
        sampledP95: number;
        lastSeen: Date;
    };
    dbMetrics?: {
        sampledCount: number;
        sampledSuccessRate: number;
        sampledAvgDuration: number;
        sampledP95: number;
        lastSeen: Date;
    };
    triggerMetrics?: {
        sampledCount: number;
        sampledSuccessRate: number;
        sampledAvgDuration: number;
        sampledP95: number;
        lastSeen: Date;
    };
}

interface PhaseTimingEntry {
    message: string; // e.g., "expense-deleted", "comments-listed"
    operation?: string; // e.g., "getUser", "verifyIdToken"
    correlationId?: string;
    timestamp: Date;
    phases: Record<string, number>; // e.g., { "queryMs": 6, "transactionMs": 9, "totalMs": 15 }
    lineNumber: number;
}

interface PhaseTimingStats {
    message: string;
    operation?: string;
    count: number;
    phases: Record<
        string,
        {
            avg: number;
            median: number;
            min: number;
            max: number;
            p95: number;
            p99: number;
            values: number[];
        }
    >;
}

class FunctionPerformanceAnalyzer {
    private executions: FunctionExecution[] = [];
    private functionMap: Map<string, FunctionExecution[]> = new Map();
    private metricsReports: MetricsReportData[] = [];
    private slowRequests: SlowRequest[] = [];
    private phaseTimings: PhaseTimingEntry[] = [];
    private timingsByMessage: Map<string, PhaseTimingEntry[]> = new Map();

    async parseLogFile(filePath: string): Promise<void> {
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let lineNumber = 0;
        let currentTimestamp = new Date();

        for await (const line of rl) {
            lineNumber++;

            // Try to extract timestamp from log lines (if present)
            const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}\.\d+Z?)\]/);
            if (timestampMatch) {
                currentTimestamp = new Date(timestampMatch[1]);
            }

            // Match the function completion pattern
            // Example: [1] i  functions: Finished "us-central1-trackGroupChanges" in 6.845084ms
            const functionMatch = line.match(/Finished "([^"]+)" in ([\d.]+)ms/);
            if (functionMatch) {
                const functionName = functionMatch[1];
                const duration = parseFloat(functionMatch[2]);

                const execution: FunctionExecution = {
                    functionName,
                    duration,
                    timestamp: new Date(currentTimestamp),
                    lineNumber,
                };

                this.executions.push(execution);

                if (!this.functionMap.has(functionName)) {
                    this.functionMap.set(functionName, []);
                }
                this.functionMap.get(functionName)!.push(execution);
            }

            // Match metrics-report entries
            // Example: [1] i  functions: metrics-report {"timestamp":"2024-...","api":{...}}
            const metricsMatch = line.match(/metrics-report\s+({.+})/);
            if (metricsMatch) {
                try {
                    const metricsData = JSON.parse(metricsMatch[1]) as MetricsReportData;
                    this.metricsReports.push(metricsData);
                } catch (error) {
                    // Skip malformed metrics-report entries
                    console.warn(`Warning: Could not parse metrics-report at line ${lineNumber}`);
                }
            }

            // Match slow-request entries
            // Example: [info] >  {"correlationId":"...","method":"POST","path":"/expenses","statusCode":201,"duration":2103,"severity":"WARNING","message":"slow-request"}
            if (line.includes('slow-request')) {
                // Extract JSON starting from first {
                const jsonStartIndex = line.indexOf('{');
                if (jsonStartIndex !== -1) {
                    // Find the matching closing brace by counting depth
                    let depth = 0;
                    let jsonEndIndex = -1;
                    for (let i = jsonStartIndex; i < line.length; i++) {
                        if (line[i] === '{') depth++;
                        if (line[i] === '}') {
                            depth--;
                            if (depth === 0) {
                                jsonEndIndex = i + 1;
                                break;
                            }
                        }
                    }

                    if (jsonEndIndex !== -1) {
                        try {
                            const jsonString = line.substring(jsonStartIndex, jsonEndIndex);
                            const slowRequestData = JSON.parse(jsonString);
                            if (slowRequestData.message === 'slow-request') {
                                // Deduplicate: Firebase emulator logs each entry twice
                                const isDuplicate = this.slowRequests.some(
                                    (existing) =>
                                        existing.correlationId === slowRequestData.correlationId &&
                                        existing.duration === slowRequestData.duration &&
                                        existing.path === slowRequestData.path,
                                );

                                if (!isDuplicate) {
                                    this.slowRequests.push({
                                        method: slowRequestData.method,
                                        path: slowRequestData.path,
                                        statusCode: slowRequestData.statusCode,
                                        duration: slowRequestData.duration,
                                        timestamp: new Date(currentTimestamp),
                                        correlationId: slowRequestData.correlationId,
                                    });
                                }
                            }
                        } catch (error) {
                            // Skip malformed slow-request entries
                            console.warn(`Warning: Could not parse slow-request at line ${lineNumber}`);
                        }
                    }
                }
            }

            // Match PerformanceTimer timing entries
            // Example: [info] >  {"message":"expense-deleted","timings":{"queryMs":6,"transactionMs":9,"totalMs":15},...}
            if (line.includes('"timings"') && line.includes('{')) {
                const jsonStartIndex = line.indexOf('{');
                if (jsonStartIndex !== -1) {
                    // Find the matching closing brace by counting depth
                    let depth = 0;
                    let jsonEndIndex = -1;
                    for (let i = jsonStartIndex; i < line.length; i++) {
                        if (line[i] === '{') depth++;
                        if (line[i] === '}') {
                            depth--;
                            if (depth === 0) {
                                jsonEndIndex = i + 1;
                                break;
                            }
                        }
                    }

                    if (jsonEndIndex !== -1) {
                        try {
                            const jsonString = line.substring(jsonStartIndex, jsonEndIndex);
                            const timingData = JSON.parse(jsonString);

                            // Validate it has timings object
                            if (timingData.timings && typeof timingData.timings === 'object' && timingData.message) {
                                const entry: PhaseTimingEntry = {
                                    message: timingData.message,
                                    operation: timingData.operation,
                                    correlationId: timingData.correlationId,
                                    timestamp: new Date(currentTimestamp),
                                    phases: timingData.timings,
                                    lineNumber,
                                };

                                // Deduplicate: Firebase emulator logs each entry twice (compact + verbose with metadata)
                                // Skip if we already have an entry with same correlation ID and identical timing
                                const isDuplicate = this.phaseTimings.some(
                                    (existing) =>
                                        existing.correlationId === entry.correlationId &&
                                        existing.message === entry.message &&
                                        JSON.stringify(existing.phases) === JSON.stringify(entry.phases),
                                );

                                if (!isDuplicate) {
                                    this.phaseTimings.push(entry);

                                    // Group by message
                                    const key = timingData.message;
                                    if (!this.timingsByMessage.has(key)) {
                                        this.timingsByMessage.set(key, []);
                                    }
                                    this.timingsByMessage.get(key)!.push(entry);
                                }
                            }
                        } catch (error) {
                            // Skip malformed timing entries
                            // Silently ignore to avoid noise
                        }
                    }
                }
            }
        }

        console.log(`📊 Parsed ${this.executions.length} function executions from ${lineNumber} lines`);
        console.log(`🔍 Found ${this.functionMap.size} unique functions`);
        console.log(`📈 Found ${this.metricsReports.length} metrics reports`);
        console.log(`🐌 Found ${this.slowRequests.length} slow requests (>1s)`);
        console.log(`⏱️  Found ${this.phaseTimings.length} phase timing entries (${this.timingsByMessage.size} unique operations)`);
    }

    analyzePerformance(): Map<string, FunctionStats> {
        const stats = new Map<string, FunctionStats>();

        for (const [functionName, executions] of this.functionMap) {
            if (executions.length === 0) continue;

            const sortedDurations = executions.map((e) => e.duration).sort((a, b) => a - b);

            const sum = sortedDurations.reduce((a, b) => a + b, 0);
            const avg = sum / sortedDurations.length;
            const median = this.calculateMedian(sortedDurations);
            const min = sortedDurations[0];
            const max = sortedDurations[sortedDurations.length - 1];

            // Calculate standard deviation and coefficient of variation
            const variance = sortedDurations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / sortedDurations.length;
            const standardDeviation = Math.sqrt(variance);
            const coefficientOfVariation = avg > 0 ? standardDeviation / avg : 0;

            // Calculate trend by comparing first half vs second half of executions
            const { trend, trendPercentage } = this.calculateTrend(executions);

            // Detect statistical outliers using IQR method
            const outliers = this.detectOutliers(sortedDurations);

            const functionStats: FunctionStats = {
                functionName,
                executions,
                averageDuration: avg,
                medianDuration: median,
                minDuration: min,
                maxDuration: max,
                standardDeviation,
                coefficientOfVariation,
                trend,
                trendPercentage,
                totalExecutions: executions.length,
                firstExecution: executions[0].timestamp,
                lastExecution: executions[executions.length - 1].timestamp,
                outliers,
            };

            // Try to match with metrics data
            this.enrichWithMetricsData(functionName, functionStats);

            stats.set(functionName, functionStats);
        }

        return stats;
    }

    private enrichWithMetricsData(functionName: string, functionStats: FunctionStats): void {
        // Enrich with API metrics
        const apiData = this.aggregateMetricsForType(functionName, 'api');
        if (apiData) {
            functionStats.apiMetrics = apiData;
        }

        // Enrich with DB metrics
        const dbData = this.aggregateMetricsForType(functionName, 'db');
        if (dbData) {
            functionStats.dbMetrics = dbData;
        }

        // Enrich with Trigger metrics
        const triggerData = this.aggregateMetricsForType(functionName, 'trigger');
        if (triggerData) {
            functionStats.triggerMetrics = triggerData;
        }
    }

    private aggregateMetricsForType(
        operationName: string,
        metricType: 'api' | 'db' | 'trigger',
    ): { sampledCount: number; sampledSuccessRate: number; sampledAvgDuration: number; sampledP95: number; lastSeen: Date; } | null {
        let totalSampledCount = 0;
        let totalSampledDuration = 0;
        let totalSuccessful = 0;
        let maxP95 = 0;
        let latestSeen = new Date(0);

        for (const report of this.metricsReports) {
            const metricTypeData = report[metricType];
            if (!metricTypeData || !metricTypeData.operations) continue;

            const operationData = metricTypeData.operations[operationName];
            if (operationData) {
                totalSampledCount += operationData.count;
                totalSampledDuration += operationData.avgDuration * operationData.count;
                totalSuccessful += Math.round(operationData.count * operationData.successRate);
                maxP95 = Math.max(maxP95, operationData.p95);

                const reportDate = new Date(report.timestamp);
                if (reportDate > latestSeen) {
                    latestSeen = reportDate;
                }
            }
        }

        if (totalSampledCount > 0) {
            return {
                sampledCount: totalSampledCount,
                sampledSuccessRate: totalSuccessful / totalSampledCount,
                sampledAvgDuration: totalSampledDuration / totalSampledCount,
                sampledP95: maxP95,
                lastSeen: latestSeen,
            };
        }

        return null;
    }

    analyzePhaseTimings(): Map<string, PhaseTimingStats> {
        const stats = new Map<string, PhaseTimingStats>();

        for (const [message, entries] of this.timingsByMessage) {
            if (entries.length === 0) continue;

            // Collect all phase names across all entries for this message
            const allPhaseNames = new Set<string>();
            for (const entry of entries) {
                for (const phaseName of Object.keys(entry.phases)) {
                    allPhaseNames.add(phaseName);
                }
            }

            // Build stats for each phase
            const phaseStats: Record<string, { avg: number; median: number; min: number; max: number; p95: number; p99: number; values: number[]; }> = {};

            for (const phaseName of allPhaseNames) {
                const values: number[] = [];

                // Collect all values for this phase
                for (const entry of entries) {
                    if (entry.phases[phaseName] !== undefined) {
                        values.push(entry.phases[phaseName]);
                    }
                }

                if (values.length > 0) {
                    const sorted = [...values].sort((a, b) => a - b);
                    const sum = sorted.reduce((a, b) => a + b, 0);
                    const avg = sum / sorted.length;
                    const median = this.calculateMedian(sorted);
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];
                    const p95Index = Math.floor(sorted.length * 0.95);
                    const p99Index = Math.floor(sorted.length * 0.99);
                    const p95 = sorted[Math.min(p95Index, sorted.length - 1)];
                    const p99 = sorted[Math.min(p99Index, sorted.length - 1)];

                    phaseStats[phaseName] = {
                        avg,
                        median,
                        min,
                        max,
                        p95,
                        p99,
                        values,
                    };
                }
            }

            // Get a representative operation name (use first entry's operation)
            const operation = entries[0].operation;

            stats.set(message, {
                message,
                operation,
                count: entries.length,
                phases: phaseStats,
            });
        }

        return stats;
    }

    private calculateMedian(sortedArray: number[]): number {
        const mid = Math.floor(sortedArray.length / 2);
        return sortedArray.length % 2 === 0 ? (sortedArray[mid - 1] + sortedArray[mid]) / 2 : sortedArray[mid];
    }

    private detectOutliers(sortedDurations: number[]): number[] {
        if (sortedDurations.length < 4) return [];

        const q1Index = Math.floor(sortedDurations.length * 0.25);
        const q3Index = Math.floor(sortedDurations.length * 0.75);
        const q1 = sortedDurations[q1Index];
        const q3 = sortedDurations[q3Index];
        const iqr = q3 - q1;

        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        return sortedDurations.filter((d) => d < lowerBound || d > upperBound);
    }

    private getRandomSample<T>(array: T[], sampleSize: number): T[] {
        if (array.length <= sampleSize) return [...array];

        const sample = [...array];
        // Fisher-Yates shuffle algorithm for random sampling
        for (let i = sample.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sample[i], sample[j]] = [sample[j], sample[i]];
        }

        return sample.slice(0, sampleSize);
    }

    private calculateTrend(executions: FunctionExecution[]): { trend: 'increasing' | 'decreasing' | 'stable'; trendPercentage: number; } {
        // Require minimum sample size for statistical validity
        if (executions.length < 20) {
            return { trend: 'stable', trendPercentage: 0 };
        }

        // Sort by timestamp to ensure chronological order
        const sortedExecutions = [...executions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // For large datasets, use random sampling within time windows for better statistical validity
        let firstHalf: FunctionExecution[], secondHalf: FunctionExecution[];

        if (sortedExecutions.length > 100) {
            // Split by time, then randomly sample within each half
            const totalTimeSpan = sortedExecutions[sortedExecutions.length - 1].timestamp.getTime() - sortedExecutions[0].timestamp.getTime();
            const midTimestamp = sortedExecutions[0].timestamp.getTime() + totalTimeSpan / 2;

            const firstHalfAll = sortedExecutions.filter((e) => e.timestamp.getTime() <= midTimestamp);
            const secondHalfAll = sortedExecutions.filter((e) => e.timestamp.getTime() > midTimestamp);

            // Random sample of 50 from each half for statistical analysis
            const sampleSize = Math.min(50, Math.floor(firstHalfAll.length / 2));
            firstHalf = this.getRandomSample(firstHalfAll, sampleSize);
            secondHalf = this.getRandomSample(secondHalfAll, sampleSize);
        } else {
            // For smaller datasets, use simple time-based split
            const totalTimeSpan = sortedExecutions[sortedExecutions.length - 1].timestamp.getTime() - sortedExecutions[0].timestamp.getTime();
            const midTimestamp = sortedExecutions[0].timestamp.getTime() + totalTimeSpan / 2;

            firstHalf = sortedExecutions.filter((e) => e.timestamp.getTime() <= midTimestamp);
            secondHalf = sortedExecutions.filter((e) => e.timestamp.getTime() > midTimestamp);
        }

        // Ensure both halves have minimum samples for statistical significance
        if (firstHalf.length < 10 || secondHalf.length < 10) {
            return { trend: 'stable', trendPercentage: 0 };
        }

        const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.duration, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.duration, 0) / secondHalf.length;

        const percentageChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

        // Use coefficient of variation to adjust threshold based on data variability
        const allDurations = sortedExecutions.map((e) => e.duration);
        const mean = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
        const variance = allDurations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / allDurations.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / mean;

        // Adjust threshold based on data variability - more variable data needs larger threshold
        const baseThreshold = 15; // Increased for more conservative trend detection
        const adjustedThreshold = baseThreshold * (1 + coefficientOfVariation * 0.5);

        let trend: 'increasing' | 'decreasing' | 'stable';
        if (percentageChange > adjustedThreshold) {
            trend = 'increasing';
        } else if (percentageChange < -adjustedThreshold) {
            trend = 'decreasing';
        } else {
            trend = 'stable';
        }

        return { trend, trendPercentage: percentageChange };
    }

    private printMetricsSummary(): void {
        if (this.metricsReports.length === 0) {
            console.log('📊 LIGHTWEIGHT METRICS: Not available in this log\n');
            return;
        }

        console.log('📊 LIGHTWEIGHT METRICS SUMMARY');
        console.log('▔'.repeat(60));

        const latestReport = this.metricsReports[this.metricsReports.length - 1];
        const totalApiSamples = this.metricsReports.reduce((sum, r) => sum + r.api.count, 0);
        const totalDbSamples = this.metricsReports.reduce((sum, r) => sum + r.db.count, 0);
        const totalTriggerSamples = this.metricsReports.reduce((sum, r) => sum + r.trigger.count, 0);

        console.log(`🔍 Sampling Rate: ${latestReport.samplingRate * 100}%`);
        console.log(`⏰ Reports Found: ${this.metricsReports.length}`);
        console.log('');

        console.log('📈 TOTAL SAMPLES BY TYPE:');
        console.log(`   🌐 API Operations:     ${totalApiSamples.toLocaleString().padStart(8)} samples`);
        console.log(`   💾 DB Operations:      ${totalDbSamples.toLocaleString().padStart(8)} samples`);
        console.log(`   ⚡ Trigger Operations: ${totalTriggerSamples.toLocaleString().padStart(8)} samples`);
        console.log('');

        // Show latest metrics for each type
        if (latestReport.api.count > 0) {
            console.log('🌐 API METRICS (Latest):');
            console.log(`   Success Rate: ${(latestReport.api.successRate * 100).toFixed(1)}%`);
            console.log(`   Avg Duration: ${latestReport.api.avgDuration.toFixed(1)}ms`);
            console.log(`   P95 Duration: ${latestReport.api.p95}ms`);
            console.log('');
        }

        if (latestReport.db.count > 0) {
            console.log('💾 DB METRICS (Latest):');
            console.log(`   Success Rate: ${(latestReport.db.successRate * 100).toFixed(1)}%`);
            console.log(`   Avg Duration: ${latestReport.db.avgDuration.toFixed(1)}ms`);
            console.log(`   P95 Duration: ${latestReport.db.p95}ms`);
            console.log('');
        }

        if (latestReport.trigger.count > 0) {
            console.log('⚡ TRIGGER METRICS (Latest):');
            console.log(`   Success Rate: ${(latestReport.trigger.successRate * 100).toFixed(1)}%`);
            console.log(`   Avg Duration: ${latestReport.trigger.avgDuration.toFixed(1)}ms`);
            console.log(`   P95 Duration: ${latestReport.trigger.p95}ms`);
            console.log('');
        }
    }

    private printPhaseTimingsSummary(timingStats: Map<string, PhaseTimingStats>): void {
        if (timingStats.size === 0) {
            console.log('⏱️  PHASE TIMINGS: Not available in this log\n');
            return;
        }

        console.log('⏱️  OPERATION PHASE TIMINGS (PerformanceTimer)');
        console.log('▔'.repeat(60));
        console.log(`📊 Total operations tracked: ${timingStats.size}`);
        console.log('');

        // Sort by total average time (slowest first)
        const sortedStats = Array.from(timingStats.values()).sort((a, b) => {
            const aTotal = a.phases.totalMs?.avg || 0;
            const bTotal = b.phases.totalMs?.avg || 0;
            return bTotal - aTotal;
        });

        // Show top 15 operations
        const topOperations = sortedStats.slice(0, 15);

        for (const stat of topOperations) {
            const totalMs = stat.phases.totalMs;
            const operationLabel = stat.operation ? `${stat.message} (${stat.operation})` : stat.message;

            console.log(`\n┌─ 📋 ${operationLabel}`);
            console.log(`├─ 🔢 Sample Count: ${stat.count}`);

            if (totalMs) {
                console.log(`├─ ⏱️  Total Time: avg=${totalMs.avg.toFixed(1)}ms, p95=${totalMs.p95}ms, p99=${totalMs.p99}ms`);
            }

            // Show phase breakdown (excluding totalMs)
            const phases = Object.keys(stat.phases).filter((p) => p !== 'totalMs').sort();
            if (phases.length > 0) {
                console.log(`├─ 📊 Phase Breakdown:`);
                for (const phaseName of phases) {
                    const phase = stat.phases[phaseName];
                    const percentage = totalMs ? ((phase.avg / totalMs.avg) * 100).toFixed(0) : '?';
                    console.log(`│  ├─ ${phaseName.padEnd(20)}: avg=${phase.avg.toFixed(1).padStart(6)}ms (${percentage.padStart(3)}%), p95=${phase.p95.toString().padStart(4)}ms`);
                }
                console.log(`└─`);
            } else {
                console.log(`└─ (no phase breakdown available)`);
            }
        }

        if (sortedStats.length > 15) {
            console.log(`\n... and ${sortedStats.length - 15} more operations`);
        }

        console.log('');
    }

    printSummary(stats: Map<string, FunctionStats>, timingStats: Map<string, PhaseTimingStats>): void {
        console.log('\n' + '📊'.repeat(50));
        console.log('PERFORMANCE ANALYSIS SUMMARY'.padStart(75));
        console.log('📊'.repeat(50) + '\n');

        // Top 5 slowest operations
        const sortedTimingStats = Array.from(timingStats.values()).sort((a, b) => {
            const aTotal = a.phases.totalMs?.avg || 0;
            const bTotal = b.phases.totalMs?.avg || 0;
            return bTotal - aTotal;
        });

        console.log('⏱️  TOP 5 SLOWEST OPERATIONS:\n');
        sortedTimingStats.slice(0, 5).forEach((stat, idx) => {
            const totalMs = stat.phases.totalMs;
            const operationLabel = stat.operation ? `${stat.message} (${stat.operation})` : stat.message;

            let totalAvg = totalMs?.avg;
            if (!totalMs && Object.keys(stat.phases).length > 0) {
                totalAvg = Object.values(stat.phases).reduce((sum, phase) => sum + phase.avg, 0);
            }

            console.log(`${idx + 1}. ${operationLabel}`);
            console.log(`   Avg: ${totalAvg?.toFixed(1) || 'N/A'}ms | P95: ${totalMs?.p95 || 'N/A'}ms | Samples: ${stat.count}`);
        });

        // Slow requests summary
        if (this.slowRequests.length > 0) {
            console.log('\n🐢 SLOW REQUESTS (>1 second):\n');
            const sortedSlowRequests = [...this.slowRequests].sort((a, b) => b.duration - a.duration);
            sortedSlowRequests.slice(0, 5).forEach((req, idx) => {
                console.log(`${idx + 1}. ${req.method} ${req.path} → ${req.duration}ms`);
            });
            if (this.slowRequests.length > 5) {
                console.log(`   ... and ${this.slowRequests.length - 5} more`);
            }
        }

        console.log('\n' + '📊'.repeat(50));
        console.log('For detailed analysis, see the HTML report'.padStart(75));
        console.log('📊'.repeat(50) + '\n');
    }

    printReport(stats: Map<string, FunctionStats>, timingStats: Map<string, PhaseTimingStats>): void {
        console.log('\n' + '🚀'.repeat(50));
        console.log('🎯 FIREBASE FUNCTIONS PERFORMANCE DASHBOARD 🎯'.padStart(75));
        console.log('🚀'.repeat(50) + '\n');

        this.printMetricsSummary();
        this.printPhaseTimingsSummary(timingStats);

        // Sort by trend percentage (worst degradation first)
        const sortedStats = Array.from(stats.values()).sort((a, b) => b.trendPercentage - a.trendPercentage);

        // Functions with issues (getting slower)
        const degrading = sortedStats.filter((s) => s.trend === 'increasing');
        if (degrading.length > 0) {
            console.log('🚨 PERFORMANCE ALERTS - Functions Getting SLOWER');
            console.log('═'.repeat(60));

            for (const stat of degrading) {
                console.log(`\n┌─ 🔥 ${stat.functionName}`);
                console.log(`├─ 📈 TREND: ${stat.trendPercentage.toFixed(1)}% SLOWER over time`);
                console.log(`├─ ⏱️  AVG TIME: ${stat.averageDuration.toFixed(1)}ms`);
                console.log(`├─ 📊 EXECUTIONS: ${stat.totalExecutions.toLocaleString()}`);

                // Show metrics from all available sources
                if (stat.apiMetrics) {
                    const accuracy = ((stat.apiMetrics.sampledCount / stat.totalExecutions) * 100).toFixed(1);
                    console.log(`├─ 🌐 API METRICS: ${stat.apiMetrics.sampledCount} samples (${accuracy}% coverage)`);
                    console.log(`│  ├─ Success Rate: ${(stat.apiMetrics.sampledSuccessRate * 100).toFixed(1)}%`);
                    console.log(`│  └─ P95: ${stat.apiMetrics.sampledP95}ms`);
                }
                if (stat.dbMetrics) {
                    const accuracy = ((stat.dbMetrics.sampledCount / stat.totalExecutions) * 100).toFixed(1);
                    console.log(`├─ 💾 DB METRICS: ${stat.dbMetrics.sampledCount} samples (${accuracy}% coverage)`);
                    console.log(`│  ├─ Success Rate: ${(stat.dbMetrics.sampledSuccessRate * 100).toFixed(1)}%`);
                    console.log(`│  └─ P95: ${stat.dbMetrics.sampledP95}ms`);
                }
                if (stat.triggerMetrics) {
                    const accuracy = ((stat.triggerMetrics.sampledCount / stat.totalExecutions) * 100).toFixed(1);
                    console.log(`├─ ⚡ TRIGGER METRICS: ${stat.triggerMetrics.sampledCount} samples (${accuracy}% coverage)`);
                    console.log(`│  ├─ Success Rate: ${(stat.triggerMetrics.sampledSuccessRate * 100).toFixed(1)}%`);
                    console.log(`│  └─ P95: ${stat.triggerMetrics.sampledP95}ms`);
                }

                console.log(`├─ 📏 RANGE: ${stat.minDuration.toFixed(0)}ms - ${stat.maxDuration.toFixed(0)}ms`);
                if (stat.outliers.length > 0) {
                    console.log(`└─ ⚠️  ${stat.outliers.length} outliers detected`);
                } else {
                    console.log(`└─ ✨ No outliers detected`);
                }
            }
            console.log('');
        }

        // Functions with improving performance
        const improving = sortedStats.filter((s) => s.trend === 'decreasing');
        if (improving.length > 0) {
            console.log('🎉 PERFORMANCE WINS - Functions Getting FASTER');
            console.log('═'.repeat(60));

            for (const stat of improving) {
                console.log(`\n┌─ 🚀 ${stat.functionName}`);
                console.log(`├─ 📈 TREND: ${Math.abs(stat.trendPercentage).toFixed(1)}% FASTER over time`);
                console.log(`├─ ⏱️  AVG TIME: ${stat.averageDuration.toFixed(1)}ms`);

                // Show metrics from all available sources
                let hasMetrics = false;
                if (stat.apiMetrics) {
                    console.log(`├─ 🌐 API: Success ${(stat.apiMetrics.sampledSuccessRate * 100).toFixed(1)}%, P95 ${stat.apiMetrics.sampledP95}ms`);
                    hasMetrics = true;
                }
                if (stat.dbMetrics) {
                    console.log(`├─ 💾 DB: Success ${(stat.dbMetrics.sampledSuccessRate * 100).toFixed(1)}%, P95 ${stat.dbMetrics.sampledP95}ms`);
                    hasMetrics = true;
                }
                if (stat.triggerMetrics) {
                    console.log(`├─ ⚡ TRIGGER: Success ${(stat.triggerMetrics.sampledSuccessRate * 100).toFixed(1)}%, P95 ${stat.triggerMetrics.sampledP95}ms`);
                    hasMetrics = true;
                }

                if (!hasMetrics) {
                    console.log(`└─ 📊 ${stat.totalExecutions.toLocaleString()} executions`);
                } else {
                    console.log(`└─ 📊 ${stat.totalExecutions.toLocaleString()} executions`);
                }
            }
            console.log('');
        }

        // Functions with stable performance
        const stable = sortedStats.filter((s) => s.trend === 'stable');
        if (stable.length > 0) {
            console.log('✅ STABLE PERFORMANCE - All Good Here');
            console.log('═'.repeat(60));

            // Group stable functions by performance level
            const fast = stable.filter((s) => s.averageDuration < 100);
            const medium = stable.filter((s) => s.averageDuration >= 100 && s.averageDuration < 500);
            const slow = stable.filter((s) => s.averageDuration >= 500);

            if (fast.length > 0) {
                console.log(`🏎️  FAST (< 100ms): ${fast.map((s) => `${s.functionName} (${s.averageDuration.toFixed(0)}ms)`).join(', ')}`);
            }
            if (medium.length > 0) {
                console.log(`🚗 MEDIUM (100-500ms): ${medium.map((s) => `${s.functionName} (${s.averageDuration.toFixed(0)}ms)`).join(', ')}`);
            }
            if (slow.length > 0) {
                console.log(`🐌 SLOW (> 500ms): ${slow.map((s) => `${s.functionName} (${s.averageDuration.toFixed(0)}ms)`).join(', ')}`);
            }
            console.log('');
        }

        // Health Score & Summary
        console.log('📋 SYSTEM HEALTH REPORT');
        console.log('═'.repeat(60));

        const totalExecutions = Array.from(stats.values()).reduce((sum, s) => sum + s.totalExecutions, 0);
        const avgDegradation = degrading.length > 0 ? degrading.reduce((sum, s) => sum + s.trendPercentage, 0) / degrading.length : 0;

        // Calculate health score
        const slowCount = Array.from(stats.values()).filter((s) => s.averageDuration >= 500).length;
        const healthScore = Math.max(0, 100 - degrading.length * 15 - slowCount * 5 + improving.length * 10);
        const healthEmoji = healthScore >= 90 ? '🟢' : healthScore >= 70 ? '🟡' : '🔴';

        console.log(`${healthEmoji} OVERALL HEALTH SCORE: ${healthScore.toFixed(0)}/100`);
        console.log(`📊 Total Executions: ${totalExecutions.toLocaleString()}`);
        console.log(`🔍 Functions Analyzed: ${stats.size}`);
        console.log('');

        console.log('📈 PERFORMANCE BREAKDOWN:');
        console.log(`   🚨 Getting Slower: ${degrading.length} (${((degrading.length / stats.size) * 100).toFixed(1)}%)`);
        console.log(`   ✅ Stable: ${stable.length} (${((stable.length / stats.size) * 100).toFixed(1)}%)`);
        console.log(`   🚀 Getting Faster: ${improving.length} (${((improving.length / stats.size) * 100).toFixed(1)}%)`);

        if (degrading.length > 0) {
            console.log(`   ⚠️  Avg Degradation: +${avgDegradation.toFixed(1)}%`);
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (degrading.length > 0) {
            console.log('   🔧 Focus on optimizing the slower functions above');
            console.log('   📊 Consider adding more monitoring to degrading functions');
        }
        if (improving.length > 0) {
            console.log('   ✨ Great job on the performance improvements!');
        }
        if (stable.length === stats.size) {
            console.log('   🎉 All functions are performing consistently!');
        }
        console.log('');

        // Notable Records
        console.log('🏆 NOTABLE RECORDS');
        console.log('═'.repeat(60));

        const allStats = Array.from(stats.values());

        if (allStats.length > 0) {
            const slowestFunction = allStats.sort((a, b) => b.maxDuration - a.maxDuration)[0];
            const mostExecuted = allStats.sort((a, b) => b.totalExecutions - a.totalExecutions)[0];
            const mostVariable = allStats.sort((a, b) => b.maxDuration / b.minDuration - a.maxDuration / a.minDuration)[0];

            console.log(`🐌 SLOWEST EXECUTION:`);
            console.log(`   ${slowestFunction.functionName} → ${slowestFunction.maxDuration.toFixed(0)}ms`);
            console.log(`📈 MOST POPULAR:`);
            console.log(`   ${mostExecuted.functionName} → ${mostExecuted.totalExecutions.toLocaleString()} executions`);
            console.log(`🎢 MOST VARIABLE:`);
            console.log(`   ${mostVariable.functionName} → ${(mostVariable.maxDuration / mostVariable.minDuration).toFixed(1)}x variance`);
        } else {
            console.log('❌ NO DATA FOUND');
            console.log('Expected log format: [timestamp] functions: Finished "function-name" in XXX.XXXms');
            console.log('Make sure you\'re analyzing Firebase Functions debug logs!');
        }

        // Display slow API requests (>1s)
        if (this.slowRequests.length > 0) {
            console.log('\n' + '⏱️ '.repeat(50));
            console.log('🐢 SLOW API REQUESTS (>1 second)'.padStart(75));
            console.log('⏱️ '.repeat(50));

            // Sort by duration descending
            const sortedSlowRequests = this.slowRequests.sort((a, b) => b.duration - a.duration);

            console.log(`\nTotal slow requests: ${this.slowRequests.length}\n`);

            // Show top 20 slowest requests
            const displayCount = Math.min(20, sortedSlowRequests.length);
            for (let i = 0; i < displayCount; i++) {
                const req = sortedSlowRequests[i];
                const timestamp = req.timestamp.toISOString().split('T')[1].substring(0, 12);
                const correlationId = req.correlationId ? ` [${req.correlationId}]` : '';
                console.log(`${(i + 1).toString().padStart(4)} ${req.method.padEnd(6)} ${req.path.padEnd(40)} → ${req.duration}ms (${req.statusCode}) [${timestamp}]${correlationId}`);
            }

            if (sortedSlowRequests.length > displayCount) {
                console.log(`\n... and ${sortedSlowRequests.length - displayCount} more slow requests`);
            }
        }

        console.log('\n' + '🎯'.repeat(50));
        console.log('END OF PERFORMANCE DASHBOARD'.padStart(75));
        console.log('🎯'.repeat(50));
    }

    printFilteredReport(filterText: string): void {
        console.log('\n' + '🔍'.repeat(50));
        console.log(`FILTERED REPORT: "${filterText}"`.padStart(75));
        console.log('🔍'.repeat(50) + '\n');

        // Filter slow requests
        const filteredSlowRequests = this.slowRequests.filter(
            (req) => req.correlationId?.includes(filterText) || req.path?.includes(filterText) || req.method?.includes(filterText),
        );

        // Filter phase timings
        const filteredPhaseTimings = this.phaseTimings.filter(
            (timing) =>
                timing.correlationId?.includes(filterText) ||
                timing.message?.includes(filterText) ||
                timing.operation?.includes(filterText) ||
                JSON.stringify(timing.phases).includes(filterText),
        );

        console.log('📊 FILTERED RESULTS:');
        console.log(`   Phase Timing Entries: ${filteredPhaseTimings.length}`);
        console.log(`   Slow Requests: ${filteredSlowRequests.length}`);
        console.log('');

        if (filteredPhaseTimings.length === 0 && filteredSlowRequests.length === 0) {
            console.log('❌ No matching entries found for the given filter.');
            console.log('');
            return;
        }

        // Show phase timings
        if (filteredPhaseTimings.length > 0) {
            console.log('⏱️  PHASE TIMING ENTRIES');
            console.log('═'.repeat(60));

            // Sort by timestamp
            const sortedTimings = [...filteredPhaseTimings].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            for (const timing of sortedTimings) {
                const timestamp = timing.timestamp.toISOString().split('T')[1].substring(0, 12);
                const correlationId = timing.correlationId ? ` [${timing.correlationId}]` : '';
                const operation = timing.operation ? ` (${timing.operation})` : '';

                console.log(`\n┌─ 📋 ${timing.message}${operation}`);
                console.log(`├─ 🕐 ${timestamp}${correlationId}`);
                console.log(`├─ 📊 Phase Timings:`);

                // Show all phases
                const phaseNames = Object.keys(timing.phases).sort();
                for (const phaseName of phaseNames) {
                    const value = timing.phases[phaseName];
                    console.log(`│  ├─ ${phaseName.padEnd(20)}: ${value.toString().padStart(6)}ms`);
                }
                console.log(`└─ Line: ${timing.lineNumber}`);
            }
            console.log('');
        }

        // Show slow requests
        if (filteredSlowRequests.length > 0) {
            console.log('🐢 SLOW API REQUESTS (>1 second)');
            console.log('═'.repeat(60));

            const sortedSlowRequests = [...filteredSlowRequests].sort((a, b) => b.duration - a.duration);

            for (let i = 0; i < sortedSlowRequests.length; i++) {
                const req = sortedSlowRequests[i];
                const timestamp = req.timestamp.toISOString().split('T')[1].substring(0, 12);
                const correlationId = req.correlationId ? ` [${req.correlationId}]` : '';
                console.log(`${(i + 1).toString().padStart(4)}. ${req.method.padEnd(6)} ${req.path.padEnd(40)} → ${req.duration}ms (${req.statusCode}) [${timestamp}]${correlationId}`);
            }
            console.log('');
        }

        console.log('🔍'.repeat(50));
        console.log('END OF FILTERED REPORT'.padStart(75));
        console.log('🔍'.repeat(50));
    }

    printExampleCommand(logFilePath: string): void {
        // Find the slowest request
        if (this.slowRequests.length === 0) {
            return;
        }

        const sortedSlowRequests = [...this.slowRequests].sort((a, b) => b.duration - a.duration);
        const slowestRequest = sortedSlowRequests[0];

        if (!slowestRequest.correlationId) {
            return;
        }

        console.log('\n' + '💡'.repeat(50));
        console.log('EXAMPLE: Analyze the slowest request in detail:'.padStart(75));
        console.log('💡'.repeat(50));
        console.log('');
        console.log(`The slowest request took ${slowestRequest.duration}ms:`);
        console.log(`  ${slowestRequest.method} ${slowestRequest.path}`);
        console.log(`  Correlation ID: ${slowestRequest.correlationId}`);
        console.log('');
        console.log('To see all timing data for this request, run:');
        console.log('');
        console.log(`  ./scripts/analyze-performance.ts ${logFilePath} --filter "${slowestRequest.correlationId}"`);
        console.log('');
        console.log('💡'.repeat(50) + '\n');
    }

    exportToCSV(stats: Map<string, FunctionStats>, outputPath: string): void {
        const rows = ['Function,Executions,Avg Duration (ms),Median (ms),Min (ms),Max (ms),Std Dev (ms),CV (%),Outliers,Trend,Trend %'];

        for (const stat of stats.values()) {
            rows.push(
                [
                    stat.functionName,
                    stat.totalExecutions,
                    stat.averageDuration.toFixed(2),
                    stat.medianDuration.toFixed(2),
                    stat.minDuration.toFixed(2),
                    stat.maxDuration.toFixed(2),
                    stat.standardDeviation.toFixed(2),
                    (stat.coefficientOfVariation * 100).toFixed(1),
                    stat.outliers.length,
                    stat.trend,
                    stat.trendPercentage.toFixed(1),
                ]
                    .join(','),
            );
        }

        fs.writeFileSync(outputPath, rows.join('\n'));
        console.log(`\n📁 CSV report exported to: ${outputPath}`);
    }

    exportToJSON(stats: Map<string, FunctionStats>, outputPath: string): void {
        const data = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFunctions: stats.size,
                totalExecutions: Array.from(stats.values()).reduce((sum, s) => sum + s.totalExecutions, 0),
                degradingFunctions: Array.from(stats.values()).filter((s) => s.trend === 'increasing').length,
                stableFunctions: Array.from(stats.values()).filter((s) => s.trend === 'stable').length,
                improvingFunctions: Array.from(stats.values()).filter((s) => s.trend === 'decreasing').length,
            },
            functions: Array.from(stats.values()).map((stat) => ({
                ...stat,
                executions: stat.executions.map((e) => ({
                    duration: e.duration,
                    timestamp: e.timestamp.toISOString(),
                    lineNumber: e.lineNumber,
                })),
            })),
        };

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`📁 JSON report exported to: ${outputPath}`);
    }

    generateHTMLReport(
        stats: Map<string, FunctionStats>,
        timingStats: Map<string, PhaseTimingStats>,
        outputPath: string,
    ): void {
        const html = this.buildHTMLReport(stats, timingStats);
        fs.writeFileSync(outputPath, html);
        const absolutePath = path.resolve(outputPath);
        console.log(`\n📊 HTML report generated: file://${absolutePath}`);
    }

    private buildHTMLReport(
        stats: Map<string, FunctionStats>,
        timingStats: Map<string, PhaseTimingStats>,
    ): string {
        const timestamp = new Date().toISOString();
        const totalExecutions = Array.from(stats.values()).reduce((sum, s) => sum + s.totalExecutions, 0);
        const degradingFunctions = Array.from(stats.values()).filter((s) => s.trend === 'increasing').length;

        const sortedTimingStats = Array.from(timingStats.values()).sort((a, b) => {
            const aTotal = a.phases.totalMs?.avg || 0;
            const bTotal = b.phases.totalMs?.avg || 0;
            return bTotal - aTotal;
        });

        const sortedSlowRequests = [...this.slowRequests].sort((a, b) => b.duration - a.duration);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Firebase Functions Performance Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #2d3748;
            padding: 20px;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        header h1 { font-size: 2.5em; margin-bottom: 10px; }
        header .subtitle { opacity: 0.9; font-size: 1.1em; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            border-left: 4px solid #667eea;
        }
        .card h2 {
            font-size: 1.3em;
            margin-bottom: 15px;
            color: #4a5568;
        }
        .metric {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        .metric-label {
            font-size: 0.9em;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        table {
            width: 100%;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            margin-bottom: 30px;
        }
        thead {
            background: #667eea;
            color: white;
        }
        th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }
        th:hover { background: #5568d3; }
        td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:hover { background: #f7fafc; }
        .phase-breakdown {
            font-size: 0.85em;
            color: #718096;
            margin: 0;
            padding: 0;
            list-style: none;
        }
        .phase-breakdown li {
            padding: 2px 0;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-danger { background: #fed7d7; color: #c53030; }
        .badge-warning { background: #feebc8; color: #c05621; }
        .badge-success { background: #c6f6d5; color: #2f855a; }
        .section-title {
            font-size: 1.8em;
            margin: 40px 0 20px 0;
            color: #2d3748;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-title::before {
            content: '';
            width: 4px;
            height: 30px;
            background: #667eea;
            border-radius: 2px;
        }
        .timestamp {
            text-align: center;
            color: #718096;
            margin-top: 40px;
            padding: 20px;
        }
        .alert {
            background: #fff5f5;
            border-left: 4px solid #fc8181;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .alert-title {
            font-weight: 600;
            color: #c53030;
            margin-bottom: 5px;
        }
        .table-description {
            background: #edf2f7;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 0.9em;
            color: #4a5568;
            line-height: 1.6;
        }
        .table-description strong {
            color: #2d3748;
        }
        .table-description .intro {
            font-weight: 600;
            margin-bottom: 8px;
            color: #2d3748;
        }
        .table-description ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
        }
        .table-description li {
            padding: 3px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎯 Firebase Functions Performance Dashboard</h1>
            <div class="subtitle">Comprehensive analysis of function execution times, phase timings, and slow requests</div>
        </header>

        <div class="summary-grid">
            <div class="card">
                <div class="metric-label">Total Function Executions</div>
                <div class="metric">${totalExecutions.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="metric-label">Unique Functions Tracked</div>
                <div class="metric">${stats.size}</div>
            </div>
            <div class="card">
                <div class="metric-label">Phase Timing Operations</div>
                <div class="metric">${this.phaseTimings.length.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="metric-label">Slow Requests (>1s)</div>
                <div class="metric">${this.slowRequests.length}</div>
            </div>
        </div>

        ${degradingFunctions > 0 ? `
        <div class="alert">
            <div class="alert-title">⚠️ Performance Alerts</div>
            <div>${degradingFunctions} function(s) showing performance degradation over time</div>
        </div>
        ` : ''}

        <h2 class="section-title">⏱️ Operation Phase Timings</h2>
        <div class="table-description">
            <div class="intro">Understanding the metrics:</div>
            <ul>
                <li><strong>Count</strong> = number of samples recorded for this operation</li>
                <li><strong>Avg Total</strong> = average total duration across all phases</li>
                <li><strong>P95</strong> = 95th percentile (5% of requests take longer than this)</li>
                <li><strong>P99</strong> = 99th percentile (1% of requests take longer than this)</li>
                <li><strong>Phase Breakdown</strong> = shows how time is distributed across operation phases (e.g., query vs transaction time)</li>
                <li>Click any column header to sort</li>
            </ul>
        </div>
        <table>
            <thead>
                <tr>
                    <th onclick="sortTable(0, this)">Operation</th>
                    <th onclick="sortTable(1, this)" style="text-align: right">Count</th>
                    <th onclick="sortTable(2, this)" style="text-align: right">Avg Total (ms)</th>
                    <th onclick="sortTable(3, this)" style="text-align: right">P95 (ms)</th>
                    <th onclick="sortTable(4, this)" style="text-align: right">P99 (ms)</th>
                    <th>Phase Breakdown</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTimingStats.slice(0, 20).map((stat) => {
            const totalMs = stat.phases.totalMs;
            const operationLabel = stat.operation ? `${stat.message} (${stat.operation})` : stat.message;
            const phases = Object.keys(stat.phases).filter((p) => p !== 'totalMs').sort();

            // Calculate total from sum of phases if totalMs doesn't exist
            let totalAvg = totalMs?.avg;
            let totalP95 = totalMs?.p95;
            let totalP99 = totalMs?.p99;

            if (!totalMs && phases.length > 0) {
                totalAvg = phases.reduce((sum, phaseName) => sum + stat.phases[phaseName].avg, 0);
                totalP95 = phases.reduce((sum, phaseName) => sum + stat.phases[phaseName].p95, 0);
                totalP99 = phases.reduce((sum, phaseName) => sum + stat.phases[phaseName].p99, 0);
            }

            const phaseBreakdown = phases.map((phaseName) => {
                const phase = stat.phases[phaseName];
                const percentage = totalAvg ? ((phase.avg / totalAvg) * 100).toFixed(0) : '?';
                return `<li>${phaseName}: <strong>${phase.avg.toFixed(1)}ms</strong> (${percentage}%)</li>`;
            }).join('');

            return `
                    <tr>
                        <td><strong>${operationLabel}</strong></td>
                        <td style="text-align: right">${stat.count.toLocaleString()}</td>
                        <td style="text-align: right">${totalAvg !== undefined ? totalAvg.toFixed(1) : 'N/A'}</td>
                        <td style="text-align: right">${totalP95 !== undefined ? totalP95.toFixed(0) : 'N/A'}</td>
                        <td style="text-align: right">${totalP99 !== undefined ? totalP99.toFixed(0) : 'N/A'}</td>
                        <td><ul class="phase-breakdown">${phaseBreakdown || '<li>N/A</li>'}</ul></td>
                    </tr>`;
        }).join('')}
            </tbody>
        </table>

        ${this.slowRequests.length > 0 ? `
        <h2 class="section-title">🐢 Slow API Requests (>1 second)</h2>
        <div class="table-description">
            <div class="intro">These requests took longer than 1 second to complete:</div>
            <ul>
                <li>Use the <strong>Correlation ID</strong> to trace the request through logs and identify bottlenecks</li>
                <li>The <strong>Status</strong> code is color-coded: green (2xx), yellow (4xx), red (5xx)</li>
            </ul>
        </div>
        <table>
            <thead>
                <tr>
                    <th onclick="sortTable(0, this)">Method</th>
                    <th onclick="sortTable(1, this)">Path</th>
                    <th onclick="sortTable(2, this)" style="text-align: right">Duration (ms)</th>
                    <th onclick="sortTable(3, this)" style="text-align: center">Status</th>
                    <th onclick="sortTable(4, this)">Timestamp</th>
                    <th>Correlation ID</th>
                </tr>
            </thead>
            <tbody>
                ${sortedSlowRequests.slice(0, 50).map((req) => {
            const timestamp = req.timestamp.toISOString().split('T')[1].substring(0, 12);
            const statusBadge = req.statusCode >= 500 ? 'badge-danger' : req.statusCode >= 400 ? 'badge-warning' : 'badge-success';

            return `
                    <tr>
                        <td><strong>${req.method}</strong></td>
                        <td><code style="font-size: 0.9em;">${req.path}</code></td>
                        <td style="text-align: right"><strong>${req.duration.toLocaleString()}</strong></td>
                        <td style="text-align: center"><span class="badge ${statusBadge}">${req.statusCode}</span></td>
                        <td>${timestamp}</td>
                        <td><code style="font-size: 0.85em;">${req.correlationId || 'N/A'}</code></td>
                    </tr>`;
        }).join('')}
            </tbody>
        </table>
        ` : ''}

        <div class="timestamp">
            Report generated: ${timestamp}
        </div>
    </div>

    <script>
        function sortTable(columnIndex, headerElement) {
            const table = headerElement.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));

            // Determine sort direction
            const isAscending = headerElement.classList.contains('sort-asc');

            // Clear all sort indicators
            table.querySelectorAll('th').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });

            // Set new sort indicator
            headerElement.classList.add(isAscending ? 'sort-desc' : 'sort-asc');

            rows.sort((a, b) => {
                const aValue = a.cells[columnIndex].textContent.trim();
                const bValue = b.cells[columnIndex].textContent.trim();

                // Try to parse as number
                const aNum = parseFloat(aValue.replace(/,/g, ''));
                const bNum = parseFloat(bValue.replace(/,/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }

                // String comparison
                return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });

            rows.forEach(row => tbody.appendChild(row));
        }
    </script>
</body>
</html>`;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    // Default to firebase-debug.log if no path provided
    const logFilePath = args.length > 0 && !args[0].startsWith('--') ? args[0] : 'firebase-debug.log';

    if (!fs.existsSync(logFilePath)) {
        console.error(`Error: Log file not found: ${logFilePath}`);
        process.exit(1);
    }

    // Handle optional filter (correlationId or any text)
    const filterIndex = args.indexOf('--filter');
    const filterText = filterIndex !== -1 && args[filterIndex + 1] ? args[filterIndex + 1] : null;

    const analyzer = new FunctionPerformanceAnalyzer();

    console.log(`📂 Analyzing log file: ${logFilePath}`);
    if (filterText) {
        console.log(`🔍 Filtering by: "${filterText}"`);
    }
    await analyzer.parseLogFile(logFilePath);

    const stats = analyzer.analyzePerformance();
    const timingStats = analyzer.analyzePhaseTimings();

    // Check output modes
    const htmlOnlyMode = args.includes('--html-only');
    const fullConsoleMode = args.includes('--full-console');

    if (filterText) {
        // Filtered reports always show full console output
        if (!htmlOnlyMode) {
            analyzer.printFilteredReport(filterText);
        }
    } else {
        // Regular reports: show summary by default, full only if requested
        if (htmlOnlyMode) {
            // Skip all console output
        } else if (fullConsoleMode) {
            // Show full detailed console report
            analyzer.printReport(stats, timingStats);
        } else {
            // Show simplified summary
            analyzer.printSummary(stats, timingStats);
        }
    }

    // Generate HTML report (store in system tmp folder)
    const htmlIndex = args.indexOf('--html');
    let htmlPath: string;

    if (htmlIndex !== -1 && args[htmlIndex + 1] && !args[htmlIndex + 1].startsWith('--')) {
        // User specified a custom path
        htmlPath = args[htmlIndex + 1];
    } else {
        // Default: use system tmp folder with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `firebase-performance-${timestamp}.html`;
        htmlPath = path.join(os.tmpdir(), filename);
    }

    // Always generate HTML report
    analyzer.generateHTMLReport(stats, timingStats, htmlPath);

    // Handle optional CSV export (look through all args, not just after logFilePath)
    const csvIndex = args.indexOf('--csv');
    if (csvIndex !== -1 && args[csvIndex + 1]) {
        analyzer.exportToCSV(stats, args[csvIndex + 1]);
    }

    // Handle optional JSON export
    const jsonIndex = args.indexOf('--json');
    if (jsonIndex !== -1 && args[jsonIndex + 1]) {
        analyzer.exportToJSON(stats, args[jsonIndex + 1]);
    }

    // Print example command for analyzing slowest request
    analyzer.printExampleCommand(logFilePath);
}

main().catch(console.error);
