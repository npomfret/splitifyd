/**
 * Utility functions for consistent error formatting in E2E tests
 */

import { NavigationResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Creates a standard error context object
 */
export function createErrorContext(
    reason: string,
    currentUrl: string,
    userInfo?: { displayName?: string; email?: string },
    additionalContext?: Record<string, any>
): NavigationResult {
    return {
        success: false,
        reason,
        currentUrl,
        userInfo,
        ...additionalContext
    };
}