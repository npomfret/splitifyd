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
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number; // percentage change from first half to second half
  totalExecutions: number;
  firstExecution: Date;
  lastExecution: Date;
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

      // Calculate trend by comparing first half vs second half of executions
      const { trend, trendPercentage } = this.calculateTrend(executions);

      const functionStats: FunctionStats = {
        functionName,
        executions,
        averageDuration: avg,
        medianDuration: median,
        minDuration: min,
        maxDuration: max,
        trend,
        trendPercentage,
        totalExecutions: executions.length,
        firstExecution: executions[0].timestamp,
        lastExecution: executions[executions.length - 1].timestamp
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

  private calculateTrend(executions: FunctionExecution[]): { trend: 'increasing' | 'decreasing' | 'stable', trendPercentage: number } {
    if (executions.length < 4) {
      return { trend: 'stable', trendPercentage: 0 };
    }

    const midPoint = Math.floor(executions.length / 2);
    const firstHalf = executions.slice(0, midPoint);
    const secondHalf = executions.slice(midPoint);

    const firstHalfAvg = firstHalf.reduce((sum, e) => sum + e.duration, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, e) => sum + e.duration, 0) / secondHalf.length;

    const percentageChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (percentageChange > 10) {
      trend = 'increasing';
    } else if (percentageChange < -10) {
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
      console.log('\n🔴 FUNCTIONS WITH DEGRADING PERFORMANCE (Slowing Down):');
      console.log('-'.repeat(100));
      for (const stat of degrading) {
        console.log(`\n📊 ${stat.functionName}`);
        console.log(`   Executions: ${stat.totalExecutions}`);
        console.log(`   Trend: ${stat.trendPercentage > 0 ? '+' : ''}${stat.trendPercentage.toFixed(1)}% slower`);
        console.log(`   Average: ${stat.averageDuration.toFixed(2)}ms | Median: ${stat.medianDuration.toFixed(2)}ms`);
        console.log(`   Range: ${stat.minDuration.toFixed(2)}ms - ${stat.maxDuration.toFixed(2)}ms`);
        
        // Show execution timeline
        if (stat.executions.length <= 20) {
          console.log(`   Timeline: ${stat.executions.map(e => e.duration.toFixed(1)).join(' → ')}ms`);
        } else {
          // Show sample of executions
          const samples = [
            ...stat.executions.slice(0, 5),
            ...stat.executions.slice(-5)
          ];
          console.log(`   Timeline (first 5 & last 5): ${samples.slice(0, 5).map(e => e.duration.toFixed(1)).join(' → ')}ms ... ${samples.slice(-5).map(e => e.duration.toFixed(1)).join(' → ')}ms`);
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
    const slowestFunction = allStats.sort((a, b) => b.maxDuration - a.maxDuration)[0];
    const mostExecuted = allStats.sort((a, b) => b.totalExecutions - a.totalExecutions)[0];
    const mostVariable = allStats.sort((a, b) => (b.maxDuration / b.minDuration) - (a.maxDuration / a.minDuration))[0];
    
    console.log(`\n🐌 Slowest execution: ${slowestFunction.functionName} at ${slowestFunction.maxDuration.toFixed(2)}ms`);
    console.log(`📈 Most executed: ${mostExecuted.functionName} with ${mostExecuted.totalExecutions} executions`);
    console.log(`🎢 Most variable: ${mostVariable.functionName} (${(mostVariable.maxDuration / mostVariable.minDuration).toFixed(1)}x variance)`);
  }

  exportToCSV(stats: Map<string, FunctionStats>, outputPath: string): void {
    const rows = ['Function,Executions,Avg Duration (ms),Median (ms),Min (ms),Max (ms),Trend,Trend %'];
    
    for (const stat of stats.values()) {
      rows.push([
        stat.functionName,
        stat.totalExecutions,
        stat.averageDuration.toFixed(2),
        stat.medianDuration.toFixed(2),
        stat.minDuration.toFixed(2),
        stat.maxDuration.toFixed(2),
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
  
  if (args.length === 0) {
    console.log('Usage: npm run analyze-performance <log-file-path> [--csv output.csv] [--json output.json]');
    console.log('Example: npm run analyze-performance firebase-debug.log --csv report.csv --json report.json');
    process.exit(1);
  }

  const logFilePath = args[0];
  
  if (!fs.existsSync(logFilePath)) {
    console.error(`Error: Log file not found: ${logFilePath}`);
    process.exit(1);
  }

  const analyzer = new FunctionPerformanceAnalyzer();
  
  console.log(`📂 Analyzing log file: ${logFilePath}`);
  await analyzer.parseLogFile(logFilePath);
  
  const stats = analyzer.analyzePerformance();
  analyzer.printReport(stats);

  // Handle optional CSV export
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