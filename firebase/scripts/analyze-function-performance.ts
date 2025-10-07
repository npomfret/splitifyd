#!/usr/bin/env tsx

import * as fs from 'fs';
import * as readline from 'readline';

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

class FunctionPerformanceAnalyzer {
    private executions: FunctionExecution[] = [];
    private functionMap: Map<string, FunctionExecution[]> = new Map();
    private metricsReports: MetricsReportData[] = [];
    private slowRequests: SlowRequest[] = [];

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
                                this.slowRequests.push({
                                    method: slowRequestData.method,
                                    path: slowRequestData.path,
                                    statusCode: slowRequestData.statusCode,
                                    duration: slowRequestData.duration,
                                    timestamp: new Date(currentTimestamp),
                                    correlationId: slowRequestData.correlationId,
                                });
                            }
                        } catch (error) {
                            // Skip malformed slow-request entries
                            console.warn(`Warning: Could not parse slow-request at line ${lineNumber}`);
                        }
                    }
                }
            }
        }

        console.log(`📊 Parsed ${this.executions.length} function executions from ${lineNumber} lines`);
        console.log(`🔍 Found ${this.functionMap.size} unique functions`);
        console.log(`📈 Found ${this.metricsReports.length} metrics reports`);
        console.log(`🐌 Found ${this.slowRequests.length} slow requests (>1s)`);
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
    ): { sampledCount: number; sampledSuccessRate: number; sampledAvgDuration: number; sampledP95: number; lastSeen: Date } | null {
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

    private calculateTrend(executions: FunctionExecution[]): { trend: 'increasing' | 'decreasing' | 'stable'; trendPercentage: number } {
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

    printReport(stats: Map<string, FunctionStats>): void {
        console.log('\n' + '🚀'.repeat(50));
        console.log('🎯 FIREBASE FUNCTIONS PERFORMANCE DASHBOARD 🎯'.padStart(75));
        console.log('🚀'.repeat(50) + '\n');

        this.printMetricsSummary();

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
            console.log("Make sure you're analyzing Firebase Functions debug logs!");
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
                console.log(`${(i + 1).toString().padStart(4)} ${req.method.padEnd(6)} ${req.path.padEnd(40)} → ${req.duration}ms (${req.statusCode}) [${timestamp}]`);
            }

            if (sortedSlowRequests.length > displayCount) {
                console.log(`\n... and ${sortedSlowRequests.length - displayCount} more slow requests`);
            }
        }

        console.log('\n' + '🎯'.repeat(50));
        console.log('END OF PERFORMANCE DASHBOARD'.padStart(75));
        console.log('🎯'.repeat(50));
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
                ].join(','),
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

    const analyzer = new FunctionPerformanceAnalyzer();

    console.log(`📂 Analyzing log file: ${logFilePath}`);
    await analyzer.parseLogFile(logFilePath);

    const stats = analyzer.analyzePerformance();
    analyzer.printReport(stats);

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
}

main().catch(console.error);
