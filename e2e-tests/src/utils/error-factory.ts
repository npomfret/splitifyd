/**
 * Factory utilities for creating strongly typed errors from result objects.
 * Provides convenience methods for error creation and backward compatibility.
 */

import {
    NavigationError,
    ButtonClickError,
    JoinGroupError,
    AuthenticationError,
    OperationError,
    TimeoutError,
    ValidationError,
    E2ETestError
} from '../errors/test-errors';
import { NavigationResult, ButtonClickResult, OperationResult } from '../types';

/**
 * Create a navigation error from a result object
 */
export function createNavigationError(
    operation: string,
    result: NavigationResult,
    screenshotPath?: string
): NavigationError {
    const error = NavigationError.fromResult(operation, result);
    if (screenshotPath) {
        error.context.screenshot = screenshotPath;
    }
    return error;
}

/**
 * Create a button click error from a result object
 */
export function createButtonClickError(
    operation: string,
    result: ButtonClickResult,
    screenshotPath?: string
): ButtonClickError {
    const error = ButtonClickError.fromResult(operation, result);
    if (screenshotPath) {
        error.context.screenshot = screenshotPath;
    }
    return error;
}

/**
 * Create a join group error from a result object
 */
export function createJoinGroupError(
    operation: string,
    result: NavigationResult & { needsLogin?: boolean; alreadyMember?: boolean },
    shareLink?: string,
    screenshotPath?: string
): JoinGroupError {
    const error = JoinGroupError.fromResult(operation, result, shareLink);
    if (screenshotPath) {
        error.context.screenshot = screenshotPath;
    }
    return error;
}

/**
 * Create an authentication error from a result object
 */
export function createAuthenticationError(
    operation: string,
    result: NavigationResult,
    screenshotPath?: string
): AuthenticationError {
    const error = AuthenticationError.fromResult(operation, result);
    if (screenshotPath) {
        error.context.screenshot = screenshotPath;
    }
    return error;
}

/**
 * Create an operation error from a result object
 */
export function createOperationError(
    operation: string,
    result: OperationResult
): OperationError {
    return OperationError.fromResult(operation, result);
}

/**
 * Create a timeout error
 */
export function createTimeoutError(
    operation: string,
    waitingFor: string,
    timeout: number,
    context?: Record<string, any>
): TimeoutError {
    return new TimeoutError(operation, waitingFor, timeout, context);
}

/**
 * Create a validation error
 */
export function createValidationError(
    operation: string,
    expected: any,
    actual: any,
    context?: Record<string, any>
): ValidationError {
    return new ValidationError(operation, expected, actual, context);
}

/**
 * Helper to throw error if result indicates failure.
 * Provides backward compatibility with existing patterns.
 */
export function throwIfFailed(
    operation: string,
    result: NavigationResult | ButtonClickResult | OperationResult,
    options?: {
        screenshotPath?: string;
        shareLink?: string;
        errorType?: 'navigation' | 'button' | 'join' | 'auth' | 'operation';
    }
): void {
    if (result.success) {
        return;
    }
    
    const { screenshotPath, shareLink, errorType = 'navigation' } = options || {};
    
    // Determine error type based on result properties or explicit type
    if (errorType === 'join' || 'needsLogin' in result || 'alreadyMember' in result) {
        throw createJoinGroupError(
            operation,
            result as NavigationResult & { needsLogin?: boolean; alreadyMember?: boolean },
            shareLink,
            screenshotPath
        );
    }
    
    if (errorType === 'button' || 'buttonName' in result) {
        throw createButtonClickError(operation, result as ButtonClickResult, screenshotPath);
    }
    
    if (errorType === 'auth') {
        throw createAuthenticationError(operation, result as NavigationResult, screenshotPath);
    }
    
    if (errorType === 'operation' || 'context' in result) {
        throw createOperationError(operation, result as OperationResult);
    }
    
    // Default to navigation error
    throw createNavigationError(operation, result as NavigationResult, screenshotPath);
}

/**
 * Assert that a result was successful, throwing appropriate error if not.
 * This is a more fluent API for the same functionality.
 */
export function assertSuccess<T extends { success: boolean }>(
    result: T,
    operation: string,
    options?: {
        screenshotPath?: string;
        shareLink?: string;
        errorType?: 'navigation' | 'button' | 'join' | 'auth' | 'operation';
    }
): asserts result is T & { success: true } {
    throwIfFailed(operation, result as any, options);
}

/**
 * Convert any error to an E2ETestError if it isn't already one.
 * Useful for catch blocks to ensure consistent error types.
 */
export function ensureE2EError(error: unknown, operation: string): E2ETestError {
    if (error instanceof E2ETestError) {
        return error;
    }
    
    if (error instanceof Error) {
        return new E2ETestError(error.message, operation, {
            originalError: error.name,
            stack: error.stack
        });
    }
    
    return new E2ETestError(
        `Unknown error: ${String(error)}`,
        operation,
        { originalError: error }
    );
}