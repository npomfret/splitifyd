import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context fields that can be stored in the logging context
 */
export interface LogContext {
    // Request context
    correlationId?: string;
    requestId?: string;
    requestPath?: string;
    requestMethod?: string;

    // User context
    userId?: string;
    userDisplayName?: string;
    userRole?: string;

    // Business context
    groupId?: string;
    expenseId?: string;
    settlementId?: string;

    // Operation context
    operation?: string;
    service?: string;

    // Custom fields
    [key: string]: any;
}

/**
 * AsyncLocalStorage instance for maintaining request-scoped context
 * This allows context to be available throughout the async call chain
 * without explicitly passing it through every function
 */
const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

/**
 * Logger context manager using AsyncLocalStorage for request-scoped context
 */
export class LoggerContext {
    /**
     * Run a function with a new logging context
     * This should be called at the entry point of a request
     */
    static run<T>(context: LogContext, fn: () => T): T {
        return asyncLocalStorage.run(context, fn);
    }

    /**
     * Get the current logging context
     * Returns empty object if no context is set
     */
    static get(): LogContext {
        return asyncLocalStorage.getStore() || {};
    }

    /**
     * Update the current logging context with new fields
     * Merges with existing context
     */
    static update(updates: Partial<LogContext>): void {
        // We can't modify AsyncLocalStorage directly, but we can mutate the object it holds
        const store = asyncLocalStorage.getStore();
        if (store) {
            Object.assign(store, updates);
        }
    }

    /**
     * Add user context to the current logging context
     * Typically called after authentication
     */
    static setUser(userId: string, displayName?: string, role?: string): void {
        this.update({
            userId,
            userDisplayName: displayName,
            userRole: role,
        });
    }

    /**
     * Add business entity context
     */
    static setBusinessContext(context: { groupId?: string; expenseId?: string; settlementId?: string; }): void {
        this.update(context);
    }

    /**
     * Create a child context with additional fields
     * Useful for services that want to add their own context
     */
    static child(additionalContext: Partial<LogContext>): LogContext {
        const current = this.get();
        return { ...current, ...additionalContext };
    }

    /**
     * Clear specific fields from the context
     */
    static clear(...fields: (keyof LogContext)[]): void {
        const store = asyncLocalStorage.getStore();
        if (store) {
            fields.forEach((field) => {
                delete store[field];
            });
        }
    }
}
