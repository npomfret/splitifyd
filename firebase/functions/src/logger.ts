/**
 * Main logger export
 * Re-exports the contextual logger which automatically includes request context
 */
export { logger, contextualLogger } from './utils/contextual-logger';
export { LoggerContext } from './utils/logger-context';
export type { LogContext } from './utils/logger-context';
