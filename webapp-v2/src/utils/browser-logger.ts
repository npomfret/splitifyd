/**
 * Comprehensive browser logging utility for audit trails, errors, and user interactions
 */

import { ApiError } from '../app/apiClient';

// Session ID for tracking user sessions
const SESSION_ID = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Colors for different log types in console
const LOG_STYLES = {
    userAction: 'color: #4CAF50; font-weight: bold',
    apiRequest: 'color: #2196F3; font-weight: bold',
    apiResponse: 'color: #00BCD4; font-weight: bold',
    navigation: 'color: #9C27B0; font-weight: bold',
    error: 'color: #F44336; font-weight: bold',
    warning: 'color: #FF9800; font-weight: bold',
    buttonClick: 'color: #8BC34A; font-weight: bold',
};

// Log levels for filtering
export enum LogLevel {
    AUDIT = 'AUDIT',
    API = 'API',
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    USER_ACTION = 'USER_ACTION',
}

// Get current user context
function getUserContext(): Record<string, any> {
    const context: Record<string, any> = {
        sessionId: SESSION_ID,
        timestamp: new Date().toISOString(),
        url: window.location.href,
    };

    // Try to get user ID from localStorage
    try {
        const authToken = localStorage.getItem('auth-token');
        if (authToken) {
            // Basic parsing - actual user ID would come from decoded token
            context.hasAuth = true;
        }
    } catch (e) {
        // Ignore localStorage errors
    }

    return context;
}

/**
 * Destructures an error object to extract all enumerable properties
 */
function destructureError(error: Error): Record<string, any> {
    const result: Record<string, any> = {};

    // Get standard error properties
    result.name = error.name;
    result.message = error.message;

    // Get all enumerable properties (including custom ones)
    for (const key in error) {
        if (error.hasOwnProperty(key) && key !== 'name' && key !== 'message' && key !== 'stack') {
            result[key] = (error as any)[key];
        }
    }

    // Special handling for ApiError
    if (error instanceof ApiError) {
        if (error.code !== undefined) {
            result.code = error.code;
        }
        if (error.details !== undefined) {
            result.details = error.details;
        }
        if (error.requestContext !== undefined) {
            result.requestContext = error.requestContext;
        }
    }

    // Add stack trace last
    if (error.stack) {
        result.stack = error.stack;
    }

    return result;
}

/**
 * Log a user action (button click, form submission, etc.)
 */
export function logUserAction(action: string, details?: Record<string, any>): void {
    const logData = {
        ...getUserContext(),
        level: LogLevel.USER_ACTION,
        action,
        ...details,
    };

    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.log(
            `%c🎯 USER ACTION: ${action}`,
            LOG_STYLES.userAction,
            JSON.stringify(logData), // put it on one line
        );
    }
}

/**
 * Log a button click event
 */
export function logButtonClick(
    buttonText: string,
    details?: {
        id?: string;
        variant?: string;
        page?: string;
        component?: string;
        [key: string]: any;
    },
): void {
    const logData = {
        ...getUserContext(),
        level: LogLevel.USER_ACTION,
        eventType: 'button_click',
        buttonText,
        ...details,
    };

    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.log(`%c🔘 BUTTON CLICK: ${buttonText}`, LOG_STYLES.buttonClick, JSON.stringify(logData));
    }
}

/**
 * Log an API request
 */
export function logApiRequest(
    method: string,
    endpoint: string,
    details?: {
        params?: Record<string, any>;
        body?: any;
        headers?: Record<string, any>;
        [key: string]: any;
    },
): void {
    const logData = {
        ...getUserContext(),
        level: LogLevel.API,
        type: 'request',
        method,
        endpoint,
        ...details,
    };

    // Remove sensitive headers
    if (logData.headers) {
        const safeHeaders = { ...logData.headers };
        delete safeHeaders.Authorization;
        delete safeHeaders.authorization;
        logData.headers = safeHeaders;
    }

    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.log(`%c📤 API REQUEST: ${method} ${endpoint}`, LOG_STYLES.apiRequest, JSON.stringify(logData));
    }
}

/**
 * Log an API response
 */
export function logApiResponse(
    method: string,
    endpoint: string,
    status: number,
    details?: {
        duration?: number;
        dataSize?: number;
        error?: any;
        retryAttempt?: number;
        [key: string]: any;
    },
): void {
    const logData = {
        ...getUserContext(),
        level: LogLevel.API,
        type: 'response',
        method,
        endpoint,
        status,
        ...details,
    };

    const isError = status >= 400;
    const icon = isError ? '❌' : '✅';
    const style = isError ? LOG_STYLES.error : LOG_STYLES.apiResponse;

    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.log(
            `%c${icon} API RESPONSE: ${method} ${endpoint} - ${status}`,
            style,
            JSON.stringify(logData), // keep it on a single line
        );
    }
}

/**
 * Log a navigation event
 */
export function logNavigation(from: string, to: string, details?: Record<string, any>): void {
    const logData = {
        ...getUserContext(),
        level: LogLevel.AUDIT,
        eventType: 'navigation',
        from,
        to,
        ...details,
    };

    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.log(`%c🧭 NAVIGATION: ${from} → ${to}`, LOG_STYLES.navigation, JSON.stringify(logData));
    }
}

/**
 * Logs an error with full context information
 * @param message - A descriptive message about what was happening
 * @param error - The error object or additional data to log
 * @param data - Optional additional data to include in the log
 */
export function logError(message: string, error?: unknown, data?: Record<string, any>): void {
    const logData: Record<string, any> = {
        timestamp: new Date().toISOString(),
    };

    // Add any additional data first
    if (data) {
        Object.assign(logData, data);
    }

    // Process the error
    if (error instanceof Error) {
        // Destructure all error properties
        const errorData = destructureError(error);
        Object.assign(logData, errorData);
    } else if (error !== undefined) {
        // For non-Error objects, include as-is
        logData.error = error;
    }

    // Only log to console if not in test environment
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        // Single line log with message followed by JSON
        console.error(`${message}:`, JSON.stringify(logData));
    }
}

/**
 * Logs a warning with context information
 * @param message - Warning message describing what happened
 * @param data - Optional data to include in the log
 */
export function logWarning(message: string, data?: Record<string, any>): void {
    const logData: Record<string, any> = {
        timestamp: new Date().toISOString(),
    };

    if (data) {
        Object.assign(logData, data);
    }

    // Single line log with message followed by JSON
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.warn(`${message}:`, JSON.stringify(logData));
    }
}

/**
 * Logs an informational message with context information
 * @param message - Info message describing what happened
 * @param data - Optional data to include in the log
 */
export function logInfo(message: string, data?: Record<string, any>): void {
    const logData: Record<string, any> = {
        timestamp: new Date().toISOString(),
    };

    if (data) {
        Object.assign(logData, data);
    }

    // Single line log with message followed by JSON
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
        console.info(`${message}:`, JSON.stringify(logData));
    }
}
