/**
 * Custom error classes for E2E tests.
 * Provides strongly typed errors with structured context for better debugging.
 */

import { NavigationResult, ButtonClickResult, OperationResult } from '../types';

/**
 * Base error class for all E2E test errors
 */
export class E2ETestError extends Error {
    public readonly timestamp: string;
    public readonly context: Record<string, any>;
    
    constructor(
        message: string,
        public readonly operation: string,
        context?: Record<string, any>
    ) {
        // Format context for error message, excluding verbose fields
        const formattedContext = E2ETestError.formatContextForMessage(context);
        super(`${message}: ${JSON.stringify(formattedContext, null, 2)}`);
        this.name = 'E2ETestError';
        this.timestamp = new Date().toISOString();
        this.context = context || {};
        
        // Maintain proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    
    /**
     * Format context for error message, handling verbose fields specially
     */
    private static formatContextForMessage(context?: Record<string, any>): Record<string, any> {
        if (!context) return {};
        
        const formatted = { ...context };
        
        // Fields that should be truncated or summarized in the error message
        const verboseFields = ['originalError', 'error', 'formError', 'stack'];
        
        for (const field of verboseFields) {
            if (formatted[field]) {
                const value = String(formatted[field]);
                // Only show first line of verbose error messages
                const firstLine = value.split('\n')[0];
                formatted[field] = firstLine.length > 100 
                    ? firstLine.substring(0, 100) + '...' 
                    : firstLine;
            }
        }
        
        return formatted;
    }

}

/**
 * Error for navigation failures
 */
export class NavigationError extends E2ETestError {
    public readonly startUrl?: string;
    public readonly currentUrl: string;
    public readonly userInfo?: { displayName?: string; email?: string };
    
    constructor(
        message: string,
        operation: string,
        result: NavigationResult
    ) {
        super(message, operation, result);
        this.name = 'NavigationError';
        this.startUrl = result.startUrl;
        this.currentUrl = result.currentUrl;
        this.userInfo = result.userInfo;
    }
    
    static fromResult(operation: string, result: NavigationResult): NavigationError {
        const message = result.reason || `${operation} failed`;
        return new NavigationError(message, operation, result);
    }
}

/**
 * Error for button click failures
 */
export class ButtonClickError extends NavigationError {
    public readonly buttonName?: string;
    public readonly elementVisible?: boolean;
    public readonly elementEnabled?: boolean;
    
    constructor(
        message: string,
        operation: string,
        result: ButtonClickResult
    ) {
        super(message, operation, result);
        this.name = 'ButtonClickError';
        this.buttonName = result.buttonName;
        this.elementVisible = result.elementVisible;
        this.elementEnabled = result.elementEnabled;
    }
    
    static fromResult(operation: string, result: ButtonClickResult): ButtonClickError {
        const message = result.reason || `Failed to click ${result.buttonName || 'button'}`;
        return new ButtonClickError(message, operation, result);
    }
}

/**
 * Error for group joining failures
 */
export class JoinGroupError extends NavigationError {
    public readonly needsLogin: boolean;
    public readonly alreadyMember: boolean;
    public readonly shareLink?: string;
    
    constructor(
        message: string,
        operation: string,
        result: NavigationResult & { needsLogin?: boolean; alreadyMember?: boolean; shareLink?: string }
    ) {
        super(message, operation, result);
        this.name = 'JoinGroupError';
        this.needsLogin = result.needsLogin || false;
        this.alreadyMember = result.alreadyMember || false;
        this.shareLink = result.shareLink;
    }
    
    static fromResult(
        operation: string, 
        result: NavigationResult & { needsLogin?: boolean; alreadyMember?: boolean },
        shareLink?: string
    ): JoinGroupError {
        let message = result.reason || `${operation} failed`;
        
        // Add specific context to message
        if (result.needsLogin) {
            message = `Authentication required: ${message}`;
        } else if (result.alreadyMember) {
            message = `Already a member: ${message}`;
        }
        
        return new JoinGroupError(message, operation, { ...result, shareLink });
    }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends NavigationError {
    public readonly authState?: 'logged_out' | 'logged_in' | 'unknown';
    
    constructor(
        message: string,
        operation: string,
        result: NavigationResult & { authState?: string }
    ) {
        super(message, operation, result);
        this.name = 'AuthenticationError';
        this.authState = (result.authState as any) || 'unknown';
    }
    
    static fromResult(operation: string, result: NavigationResult): AuthenticationError {
        const message = result.reason || `Authentication failed during ${operation}`;
        return new AuthenticationError(message, operation, result);
    }
}

/**
 * Error for generic operation failures
 */
export class OperationError extends E2ETestError {
    public readonly screenshot?: string;
    
    constructor(
        message: string,
        operation: string,
        result: OperationResult
    ) {
        super(message, operation, result.context);
        this.name = 'OperationError';
        this.screenshot = result.screenshot;
    }
    
    static fromResult(operation: string, result: OperationResult): OperationError {
        const message = result.reason || `${operation} failed`;
        return new OperationError(message, operation, result);
    }
}

/**
 * Error for timeout scenarios
 */
export class TimeoutError extends E2ETestError {
    public readonly timeout: number;
    public readonly waitingFor: string;
    
    constructor(
        operation: string,
        waitingFor: string,
        timeout: number,
        context?: Record<string, any>
    ) {
        const message = `Timeout after ${timeout}ms waiting for ${waitingFor}`;
        super(message, operation, context);
        this.name = 'TimeoutError';
        this.timeout = timeout;
        this.waitingFor = waitingFor;
    }
}

/**
 * Error for validation failures
 */
export class ValidationError extends E2ETestError {
    public readonly expected: any;
    public readonly actual: any;
    
    constructor(
        operation: string,
        expected: any,
        actual: any,
        context?: Record<string, any>
    ) {
        const message = `Validation failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
        super(message, operation, context);
        this.name = 'ValidationError';
        this.expected = expected;
        this.actual = actual;
    }
}