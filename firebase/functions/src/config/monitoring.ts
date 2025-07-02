/**
 * Monitoring configuration
 */

import { MonitoringConfig } from './types';
import { parseBoolean, parseInteger, getCurrentEnvironment } from './utils';

export function createMonitoringConfig(): MonitoringConfig {
  const environment = getCurrentEnvironment();
  const isProduction = environment === 'production';

  return {
    enableHealthChecks: parseBoolean(process.env.ENABLE_HEALTH_CHECKS, true),
    enableMetrics: parseBoolean(process.env.ENABLE_METRICS, isProduction),
    performanceThresholds: {
      slowRequestMs: parseInteger(process.env.SLOW_REQUEST_THRESHOLD_MS, isProduction ? 1000 : 5000),
      healthCheckTimeoutMs: parseInteger(process.env.HEALTH_CHECK_TIMEOUT_MS, 5000),
    },
  };
}