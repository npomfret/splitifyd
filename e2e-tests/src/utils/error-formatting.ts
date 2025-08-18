/**
 * Utility functions for consistent error formatting in E2E tests
 */

import { NavigationResult } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import assert from "assert";

/**
 * Takes a screenshot and returns the path
 */
export async function takeDebugScreenshot(
    page: any,
    prefix: string = 'debug'
): Promise<string> {
    const timestamp = Date.now();
    const projectRoot = path.resolve(__dirname, '../../..');// todo: __dirname does not work!
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