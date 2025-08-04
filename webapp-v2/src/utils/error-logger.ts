/**
 * Centralized error logging utility for consistent error handling across the webapp
 */

import { ApiError } from '../app/apiClient';

/**
 * Determines if an error is "expected" and should be logged as a warning instead of error
 */
function isExpectedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Common expected errors that shouldn't be loud in console
    const expectedCodes = ['NOT_FOUND', 'UNAUTHORIZED', 'PERMISSION_DENIED'];
    return expectedCodes.includes(error.code);
  }
  return false;
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

  // Single line log with message followed by JSON
  console.error(`${message}:`, JSON.stringify(logData));
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
  console.warn(`${message}:`, JSON.stringify(logData));
}

/**
 * Helper to get a user-friendly error message from an error object
 * @param error - The error object
 * @returns A user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // ApiError already has user-friendly messages
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}