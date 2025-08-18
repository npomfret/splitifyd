/**
 * Utility functions for consistent error formatting in E2E tests
 */

import { NavigationResult, OperationResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import assert from "assert";

/**
 * Formats a navigation or operation result into a readable error message
 */
export function formatErrorMessage(
    operation: string,
    result: NavigationResult | OperationResult,
    screenshotPath?: string
): string {
    const message = `${operation} failed\n${JSON.stringify(result, null, 2)}`;
    return screenshotPath ? `${message}\nScreenshot: ${screenshotPath}` : message;
}

/**
 * Takes a screenshot and returns the path
 */
export async function takeDebugScreenshot(
    page: any,
    prefix: string = 'debug'
): Promise<string> {
    const timestamp = Date.now();
    const projectRoot = path.resolve(__dirname, '../../..');
    const tmpDir = path.join(projectRoot, 'tmp');
    
    // Ensure tmp directory exists
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const screenshotPath = path.join(tmpDir, `${prefix}-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    return screenshotPath;
}

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