import { ENV_CONFIG } from './environment';

export const CONFIG = {
  RATE_LIMIT: {
    WINDOW_MS: ENV_CONFIG.security.rateLimiting.windowMs,
    MAX_REQUESTS: ENV_CONFIG.security.rateLimiting.maxRequests,
    CLEANUP_INTERVAL_MS: ENV_CONFIG.security.rateLimiting.cleanupIntervalMs,
  },
  DOCUMENT: {
    MAX_SIZE_BYTES: ENV_CONFIG.security.validation.maxRequestSizeBytes,
    LIST_LIMIT: 100,
    PREVIEW_LENGTH: 100,
  },
  REQUEST: {
    BODY_LIMIT: `${Math.round(ENV_CONFIG.security.validation.maxRequestSizeBytes / (1024 * 1024))}mb`,
  },
  CORS: {
    origin: ENV_CONFIG.cors.allowedOrigins,
    credentials: ENV_CONFIG.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  },
  VALIDATION: {
    MAX_OBJECT_DEPTH: ENV_CONFIG.security.validation.maxObjectDepth,
    MAX_STRING_LENGTH: ENV_CONFIG.security.validation.maxStringLength,
    MAX_PROPERTY_COUNT: ENV_CONFIG.security.validation.maxPropertyCount,
    MAX_PROPERTY_NAME_LENGTH: ENV_CONFIG.security.validation.maxPropertyNameLength,
  },
  LOGGING: {
    LEVEL: ENV_CONFIG.logging.level,
    STRUCTURED: ENV_CONFIG.logging.structuredLogging,
    INCLUDE_STACK_TRACE: ENV_CONFIG.logging.includeStackTrace,
  },
  MONITORING: {
    ENABLE_HEALTH_CHECKS: ENV_CONFIG.monitoring.enableHealthChecks,
    ENABLE_METRICS: ENV_CONFIG.monitoring.enableMetrics,
    SLOW_REQUEST_THRESHOLD_MS: ENV_CONFIG.monitoring.performanceThresholds.slowRequestMs,
    HEALTH_CHECK_TIMEOUT_MS: ENV_CONFIG.monitoring.performanceThresholds.healthCheckTimeoutMs,
  },
  FIREBASE: {
    PROJECT_ID: ENV_CONFIG.firebase.projectId,
    clientConfig: ENV_CONFIG.firebase.clientConfig,
    EMULATOR_PORTS: ENV_CONFIG.firebase.emulatorPorts,
  },
};