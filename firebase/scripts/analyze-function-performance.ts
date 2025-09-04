#!/usr/bin/env tsx

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

interface FunctionExecution {
  functionName: string;
  duration: number;  // in milliseconds
  timestamp: Date;
  lineNumber: number;
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
}

class FunctionPerformanceAnalyzer {
  private executions: FunctionExecution[] = [];
  private functionMap: Map<string, FunctionExecution[]> = new Map();

  async parseLogFile(filePath: string): Promise<void> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
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
      const match = line.match(/Finished "([^"]+)" in ([\d.]+)ms/);
      
      if (match) {
        const functionName = match[1];
        const duration = parseFloat(match[2]);
        
        const execution: FunctionExecution = {
          functionName,
          duration,
          timestamp: new Date(currentTimestamp),
          lineNumber
        };

        this.executions.push(execution);
        
        if (!this.functionMap.has(functionName)) {
          this.functionMap.set(functionName, []);
        }
        this.functionMap.get(functionName)!.push(execution);
      }
    }

    console.log(`Parsed ${this.executions.length} function executions from ${lineNumber} lines`);
    console.log(`Found ${this.functionMap.size} unique functions`);
  }

  analyzePerformance(): Map<string, FunctionStats> {
    const stats = new Map<string, FunctionStats>();

    for (const [functionName, executions] of this.functionMap) {
      if (executions.length === 0) continue;

      const sortedDurations = executions
        .map(e => e.duration)
        .sort((a, b) => a - b);

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
        outliers
      };

      stats.set(functionName, functionStats);
    }

    return stats;
  }

  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
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
    
    return sortedDurations.filter(d => d < lowerBound || d > upperBound);
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

  private calculateTrend(executions: FunctionExecution[]): { trend: 'increasing' | 'decreasing' | 'stable', trendPercentage: number } {
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
      const midTimestamp = sortedExecutions[0].timestamp.getTime() + (totalTimeSpan / 2);
      
      const firstHalfAll = sortedExecutions.filter(e => e.timestamp.getTime() <= midTimestamp);
      const secondHalfAll = sortedExecutions.filter(e => e.timestamp.getTime() > midTimestamp);
      
      // Random sample of 50 from each half for statistical analysis
      const sampleSize = Math.min(50, Math.floor(firstHalfAll.length / 2));
      firstHalf = this.getRandomSample(firstHalfAll, sampleSize);
      secondHalf = this.getRandomSample(secondHalfAll, sampleSize);
    } else {
      // For smaller datasets, use simple time-based split
      const totalTimeSpan = sortedExecutions[sortedExecutions.length - 1].timestamp.getTime() - sortedExecutions[0].timestamp.getTime();
      const midTimestamp = sortedExecutions[0].timestamp.getTime() + (totalTimeSpan / 2);
      
      firstHalf = sortedExecutions.filter(e => e.timestamp.getTime() <= midTimestamp);
      secondHalf = sortedExecutions.filter(e => e.timestamp.getTime() > midTimestamp);
    }

    // Ensure both halves have minimum samples for statistical significance
    if (firstHalf.length < 10 || secondHalf.length < 10) {
      return { trend: 'stable', trendPercentage: 0 };
    }

    const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.duration, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.duration, 0) / secondHalf.length;

    const percentageChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    // Use coefficient of variation to adjust threshold based on data variability
    const allDurations = sortedExecutions.map(e => e.duration);
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

  printReport(stats: Map<string, FunctionStats>): void {
    console.log('\n' + '='.repeat(100));
    console.log('FUNCTION PERFORMANCE ANALYSIS REPORT');
    console.log('='.repeat(100));

    // Sort by trend percentage (worst degradation first)
    const sortedStats = Array.from(stats.values()).sort((a, b) => b.trendPercentage - a.trendPercentage);

    // Functions with increasing execution time (getting slower)
    const degrading = sortedStats.filter(s => s.trend === 'increasing');
    if (degrading.length > 0) {
      console.log('\n🔴 FUNCTIONS WITH DEGRADING PERFORMANCE (Statistically Significant Slowdown):');
      console.log('-'.repeat(100));
      for (const stat of degrading) {
        console.log(`\n📊 ${stat.functionName}`);
        const trendText = stat.trendPercentage > 0 ? 'slower' : 'faster';
        console.log(`   📈 Performance Trend: ${Math.abs(stat.trendPercentage).toFixed(1)}% ${trendText} over time`);
        console.log(`   📋 Sample Size: ${stat.totalExecutions} executions (${stat.totalExecutions >= 100 ? 'with random sampling' : 'full dataset'})`);
        console.log(`   ⏱️  Duration Stats: avg=${stat.averageDuration.toFixed(2)}ms, median=${stat.medianDuration.toFixed(2)}ms`);
        console.log(`   📏 Variability: std=${stat.standardDeviation.toFixed(2)}ms, cv=${(stat.coefficientOfVariation * 100).toFixed(1)}%`);
        console.log(`   🎯 Range: ${stat.minDuration.toFixed(2)}ms - ${stat.maxDuration.toFixed(2)}ms`);
        
        if (stat.outliers.length > 0) {
          console.log(`   ⚠️  Outliers: ${stat.outliers.length} detected (${stat.outliers.slice(0, 3).map(o => o.toFixed(1)).join(', ')}${stat.outliers.length > 3 ? '...' : ''}ms)`);
        }
        
        // Show chronological timeline for trend visualization
        const sortedByTime = [...stat.executions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        if (sortedByTime.length <= 15) {
          console.log(`   📊 Timeline: ${sortedByTime.map(e => e.duration.toFixed(1)).join(' → ')}ms`);
        } else {
          // Show representative samples from beginning, middle, end
          const samples = [
            ...sortedByTime.slice(0, 5),
            ...sortedByTime.slice(Math.floor(sortedByTime.length / 2) - 2, Math.floor(sortedByTime.length / 2) + 3),
            ...sortedByTime.slice(-5)
          ];
          const early = samples.slice(0, 5);
          const middle = samples.slice(5, 10);
          const recent = samples.slice(-5);
          console.log(`   📊 Timeline: Early[${early.map(e => e.duration.toFixed(1)).join(',')}] → Recent[${recent.map(e => e.duration.toFixed(1)).join(',')}]ms`);
        }
      }
    }

    // Functions with stable performance
    const stable = sortedStats.filter(s => s.trend === 'stable');
    if (stable.length > 0) {
      console.log('\n🟡 FUNCTIONS WITH STABLE PERFORMANCE:');
      console.log('-'.repeat(100));
      for (const stat of stable.slice(0, 5)) { // Show top 5 only
        console.log(`${stat.functionName}: ${stat.averageDuration.toFixed(2)}ms avg (${stat.totalExecutions} executions)`);
      }
      if (stable.length > 5) {
        console.log(`... and ${stable.length - 5} more`);
      }
    }

    // Functions with improving performance
    const improving = sortedStats.filter(s => s.trend === 'decreasing');
    if (improving.length > 0) {
      console.log('\n🟢 FUNCTIONS WITH IMPROVING PERFORMANCE:');
      console.log('-'.repeat(100));
      for (const stat of improving) {
        console.log(`${stat.functionName}: ${stat.trendPercentage.toFixed(1)}% faster (${stat.averageDuration.toFixed(2)}ms avg)`);
      }
    }

    // Summary statistics
    console.log('\n' + '='.repeat(100));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(100));
    
    const totalExecutions = Array.from(stats.values()).reduce((sum, s) => sum + s.totalExecutions, 0);
    const avgDegradation = degrading.length > 0 
      ? degrading.reduce((sum, s) => sum + s.trendPercentage, 0) / degrading.length 
      : 0;
    
    console.log(`Total function executions analyzed: ${totalExecutions}`);
    console.log(`Unique functions: ${stats.size}`);
    console.log(`Functions getting slower: ${degrading.length} (${(degrading.length / stats.size * 100).toFixed(1)}%)`);
    console.log(`Functions stable: ${stable.length} (${(stable.length / stats.size * 100).toFixed(1)}%)`);
    console.log(`Functions getting faster: ${improving.length} (${(improving.length / stats.size * 100).toFixed(1)}%)`);
    if (degrading.length > 0) {
      console.log(`Average degradation: +${avgDegradation.toFixed(1)}%`);
    }

    // Find outliers
    console.log('\n' + '='.repeat(100));
    console.log('NOTABLE OUTLIERS');
    console.log('='.repeat(100));
    
    const allStats = Array.from(stats.values());
    
    if (allStats.length > 0) {
      const slowestFunction = allStats.sort((a, b) => b.maxDuration - a.maxDuration)[0];
      const mostExecuted = allStats.sort((a, b) => b.totalExecutions - a.totalExecutions)[0];
      const mostVariable = allStats.sort((a, b) => (b.maxDuration / b.minDuration) - (a.maxDuration / a.minDuration))[0];
      
      console.log(`\n🐌 Slowest execution: ${slowestFunction.functionName} at ${slowestFunction.maxDuration.toFixed(2)}ms`);
      console.log(`📈 Most executed: ${mostExecuted.functionName} with ${mostExecuted.totalExecutions} executions`);
      console.log(`🎢 Most variable: ${mostVariable.functionName} (${(mostVariable.maxDuration / mostVariable.minDuration).toFixed(1)}x variance)`);
    } else {
      console.log('\n💡 No function executions found in log file.');
      console.log('   Expected log format: [timestamp] functions: Finished "function-name" in XXX.XXXms');
      console.log('   Make sure you\'re analyzing a Firebase Functions debug log, not Firestore logs.');
    }
  }

  exportToCSV(stats: Map<string, FunctionStats>, outputPath: string): void {
    const rows = ['Function,Executions,Avg Duration (ms),Median (ms),Min (ms),Max (ms),Std Dev (ms),CV (%),Outliers,Trend,Trend %'];
    
    for (const stat of stats.values()) {
      rows.push([
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
        stat.trendPercentage.toFixed(1)
      ].join(','));
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
        degradingFunctions: Array.from(stats.values()).filter(s => s.trend === 'increasing').length,
        stableFunctions: Array.from(stats.values()).filter(s => s.trend === 'stable').length,
        improvingFunctions: Array.from(stats.values()).filter(s => s.trend === 'decreasing').length
      },
      functions: Array.from(stats.values()).map(stat => ({
        ...stat,
        executions: stat.executions.map(e => ({
          duration: e.duration,
          timestamp: e.timestamp.toISOString(),
          lineNumber: e.lineNumber
        }))
      }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`📁 JSON report exported to: ${outputPath}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  // Default to firebase-debug.log if no path provided
  const logFilePath = args.length > 0 && !args[0].startsWith('--') 
    ? args[0] 
    : 'firebase-debug.log';
  
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