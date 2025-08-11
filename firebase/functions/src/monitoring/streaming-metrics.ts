import * as functions from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

interface StreamingMetrics {
  // Usage metrics
  refreshes: number;
  activeUsers: number;
  totalRequests: number;
  errors: number;
  
  // Performance metrics
  totalLatency: number;
  latencies: number[];
  
  // Cost metrics
  firestoreReads: number;
  firestoreWrites: number;
  functionInvocations: number;
  
  // Feature usage
  groupChanges: number;
  expenseChanges: number;
  balanceCalculations: number;
  presenceUpdates: number;
}

interface PerformanceMetrics {
  avgRefreshRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number;
}

interface CostMetrics {
  firestoreReads: number;
  firestoreWrites: number;
  functionInvocations: number;
  estimatedCost: number;
  savingsVsFullStreaming: number;
  costPerActiveUser: number;
}

interface AlertThresholds {
  highRefreshRate: number;
  highErrorRate: number;
  highLatency: number;
  highCost: number;
}

const ALERT_THRESHOLDS: AlertThresholds = {
  highRefreshRate: 60, // refreshes per hour per user
  highErrorRate: 0.05, // 5% error rate
  highLatency: 2000, // 2 second P95 latency
  highCost: 100 // $100 per day
};

export const collectStreamingMetrics = functions.scheduler
  .onSchedule('every 1 hours', async () => {
    const db = getFirestore();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    try {
      // Gather raw metrics
      const metrics = await gatherMetrics(db, oneHourAgo, now);
      
      // Calculate performance metrics
      const performance = calculatePerformanceMetrics(metrics);
      
      // Calculate cost metrics
      const costs = calculateCostMetrics(metrics);
      
      // Check for alerts
      await checkAndSendAlerts(performance, costs, db);
      
      // Store metrics for historical analysis
      await storeMetrics(db, now, performance, costs, metrics);
      
      // Log summary
      console.log('Streaming metrics collected:', {
        timestamp: new Date(now).toISOString(),
        performance: {
          avgLatency: performance.avgLatency,
          errorRate: performance.errorRate,
          throughput: performance.throughput
        },
        costs: {
          firestoreReads: costs.firestoreReads,
          estimatedCost: costs.estimatedCost,
          costPerUser: costs.costPerActiveUser
        }
      });
      
    } catch (error) {
      console.error('Error collecting streaming metrics:', error);
      
      // Send error alert
      await sendAlert(db, 'metrics_collection_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now
      });
    }
  });

async function gatherMetrics(
  db: FirebaseFirestore.Firestore, 
  startTime: number, 
  endTime: number
): Promise<StreamingMetrics> {
  // Query change collections for activity
  const [groupChanges, expenseChanges, balanceChanges] = await Promise.all([
    db.collection('group-changes')
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<', endTime)
      .get(),
    db.collection('expense-changes')
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<', endTime)
      .get(),
    db.collection('balance-changes')
      .where('timestamp', '>=', startTime)
      .where('timestamp', '<', endTime)
      .get()
  ]);
  
  // Query logs for performance data
  const performanceLogs = await db.collection('performance-logs')
    .where('timestamp', '>=', startTime)
    .where('timestamp', '<', endTime)
    .get();
  
  // Query error logs
  const errorLogs = await db.collection('error-logs')
    .where('timestamp', '>=', startTime)
    .where('timestamp', '<', endTime)
    .get();
  
  // Calculate active users
  const activeUsers = new Set();
  [...groupChanges.docs, ...expenseChanges.docs, ...balanceChanges.docs].forEach(doc => {
    const data = doc.data();
    if (data.userId) {
      activeUsers.add(data.userId);
    }
    if (data.affectedUsers) {
      data.affectedUsers.forEach((userId: string) => activeUsers.add(userId));
    }
  });
  
  // Extract latencies from performance logs
  const latencies: number[] = [];
  let totalLatency = 0;
  let totalRequests = 0;
  
  performanceLogs.docs.forEach(doc => {
    const data = doc.data();
    if (data.latency && typeof data.latency === 'number') {
      latencies.push(data.latency);
      totalLatency += data.latency;
    }
    if (data.requestCount) {
      totalRequests += data.requestCount;
    }
  });
  
  return {
    refreshes: totalRequests,
    activeUsers: activeUsers.size,
    totalRequests,
    errors: errorLogs.size,
    totalLatency,
    latencies,
    firestoreReads: groupChanges.size + expenseChanges.size + balanceChanges.size + performanceLogs.size + errorLogs.size,
    firestoreWrites: groupChanges.size + expenseChanges.size + balanceChanges.size,
    functionInvocations: Math.ceil(totalRequests / 100), // Estimated
    groupChanges: groupChanges.size,
    expenseChanges: expenseChanges.size,
    balanceCalculations: balanceChanges.size,
    presenceUpdates: 0 // TODO: Track presence updates
  };
}

function calculatePerformanceMetrics(metrics: StreamingMetrics): PerformanceMetrics {
  const avgRefreshRate = metrics.activeUsers > 0 ? metrics.refreshes / metrics.activeUsers : 0;
  const avgLatency = metrics.latencies.length > 0 ? metrics.totalLatency / metrics.latencies.length : 0;
  const errorRate = metrics.totalRequests > 0 ? metrics.errors / metrics.totalRequests : 0;
  const throughput = metrics.refreshes; // requests per hour
  
  // Calculate percentiles
  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
  const p99Index = Math.ceil(sortedLatencies.length * 0.99) - 1;
  
  const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.max(0, p95Index)] : 0;
  const p99Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.max(0, p99Index)] : 0;
  
  return {
    avgRefreshRate,
    avgLatency,
    p95Latency,
    p99Latency,
    errorRate,
    throughput
  };
}

function calculateCostMetrics(metrics: StreamingMetrics): CostMetrics {
  // Firestore pricing (approximate)
  const READ_COST = 0.00006; // $0.06 per 100k reads
  const WRITE_COST = 0.00018; // $0.18 per 100k writes
  const FUNCTION_COST = 0.0000004; // $0.40 per million invocations
  
  const readCost = (metrics.firestoreReads * READ_COST) / 1000;
  const writeCost = (metrics.firestoreWrites * WRITE_COST) / 1000;
  const functionCost = (metrics.functionInvocations * FUNCTION_COST) / 1000;
  
  const estimatedCost = readCost + writeCost + functionCost;
  
  // Calculate savings vs full streaming (estimated)
  const fullStreamingReads = metrics.activeUsers * 3600; // 1 read per second per user
  const fullStreamingCost = (fullStreamingReads * READ_COST) / 1000;
  const savingsVsFullStreaming = Math.max(0, fullStreamingCost - estimatedCost);
  
  const costPerActiveUser = metrics.activeUsers > 0 ? estimatedCost / metrics.activeUsers : 0;
  
  return {
    firestoreReads: metrics.firestoreReads,
    firestoreWrites: metrics.firestoreWrites,
    functionInvocations: metrics.functionInvocations,
    estimatedCost,
    savingsVsFullStreaming,
    costPerActiveUser
  };
}

async function checkAndSendAlerts(
  performance: PerformanceMetrics, 
  costs: CostMetrics,
  db: FirebaseFirestore.Firestore
): Promise<void> {
  const alerts: Array<{type: string, data: any}> = [];
  
  // Check performance thresholds
  if (performance.avgRefreshRate > ALERT_THRESHOLDS.highRefreshRate) {
    alerts.push({
      type: 'high_refresh_rate',
      data: {
        current: performance.avgRefreshRate,
        threshold: ALERT_THRESHOLDS.highRefreshRate,
        message: 'Refresh rate is higher than expected'
      }
    });
  }
  
  if (performance.errorRate > ALERT_THRESHOLDS.highErrorRate) {
    alerts.push({
      type: 'high_error_rate',
      data: {
        current: performance.errorRate,
        threshold: ALERT_THRESHOLDS.highErrorRate,
        message: 'Error rate is above acceptable threshold'
      }
    });
  }
  
  if (performance.p95Latency > ALERT_THRESHOLDS.highLatency) {
    alerts.push({
      type: 'high_latency',
      data: {
        current: performance.p95Latency,
        threshold: ALERT_THRESHOLDS.highLatency,
        message: 'P95 latency is higher than target'
      }
    });
  }
  
  // Check cost thresholds
  const dailyCost = costs.estimatedCost * 24; // Convert hourly to daily
  if (dailyCost > ALERT_THRESHOLDS.highCost) {
    alerts.push({
      type: 'high_cost',
      data: {
        current: dailyCost,
        threshold: ALERT_THRESHOLDS.highCost,
        message: 'Daily cost projection exceeds threshold'
      }
    });
  }
  
  // Send alerts
  for (const alert of alerts) {
    await sendAlert(db, alert.type, alert.data);
  }
}

async function sendAlert(
  db: FirebaseFirestore.Firestore,
  type: string, 
  data: any
): Promise<void> {
  try {
    // Store alert in database
    await db.collection('alerts').add({
      type,
      data,
      timestamp: Timestamp.now(),
      resolved: false
    });
    
    console.warn(`ALERT: ${type}`, data);
    
    // TODO: Send to external monitoring service (Slack, email, etc.)
    
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

async function storeMetrics(
  db: FirebaseFirestore.Firestore,
  timestamp: number,
  performance: PerformanceMetrics,
  costs: CostMetrics,
  raw: StreamingMetrics
): Promise<void> {
  await db.collection('streaming-metrics').add({
    timestamp: Timestamp.fromMillis(timestamp),
    performance,
    costs,
    raw: {
      activeUsers: raw.activeUsers,
      totalRequests: raw.totalRequests,
      errors: raw.errors,
      groupChanges: raw.groupChanges,
      expenseChanges: raw.expenseChanges,
      balanceCalculations: raw.balanceCalculations
    }
  });
}

// Helper function to get current metrics (for debugging/manual checks)
export const getCurrentMetrics = functions.https.onCall(async (request) => {
  // Verify admin user
  if (!request.auth || !(request.auth as any).token?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  const db = getFirestore();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  try {
    const rawMetrics = await gatherMetrics(db, oneHourAgo, now);
    const performance = calculatePerformanceMetrics(rawMetrics);
    const costs = calculateCostMetrics(rawMetrics);
    
    return {
      timestamp: now,
      performance,
      costs,
      raw: rawMetrics
    };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to get metrics');
  }
});

// Function to get historical metrics
export const getHistoricalMetrics = functions.https.onCall(async (request) => {
  if (!request.auth || !(request.auth as any).token?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  const { days = 7 } = (request.data as any) || {};
  const db = getFirestore();
  const now = Date.now();
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  
  try {
    const metricsSnapshot = await db.collection('streaming-metrics')
      .where('timestamp', '>=', Timestamp.fromMillis(cutoff))
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    const metrics = metricsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toMillis()
    }));
    
    return { metrics };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to get historical metrics');
  }
});