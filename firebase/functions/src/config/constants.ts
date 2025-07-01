export const CONFIG = {
  RATE_LIMIT: {
    WINDOW_MS: 60000,
    MAX_REQUESTS: 10,
    CLEANUP_INTERVAL_MS: 60000,
  },
  DOCUMENT: {
    MAX_SIZE_BYTES: 1024 * 1024, // 1MB
    LIST_LIMIT: 100,
    PREVIEW_LENGTH: 100,
  },
  REQUEST: {
    BODY_LIMIT: '1mb',
  },
  CORS: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
};