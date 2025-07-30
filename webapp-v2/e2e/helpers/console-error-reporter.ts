import { test } from '@playwright/test';

interface ConsoleError {
  message: string;
  type: string;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: Date;
}

interface PageError {
  name: string;
  message: string;
  stack?: string;
  timestamp: Date;
}

/**
 * Sets up automatic console error reporting for all tests.
 * When a test fails, console errors and page errors are:
 * 1. Printed to the console for immediate visibility
 * 2. Attached to the test report for later review
 */
export function setupConsoleErrorReporting() {
  let consoleErrors: ConsoleError[] = [];
  let pageErrors: PageError[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear arrays for each test
    consoleErrors = [];
    pageErrors = [];
    
    // Capture console errors with details
    page.on('console', (msg) => {
      // Log ALL console messages for debugging
      const msgType = msg.type();
      const msgText = msg.text();
      const location = msg.location();
      
      console.log(`[Browser Console ${msgType.toUpperCase()}]: ${msgText}`);
      if (location?.url) {
        console.log(`  at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
      }
      
      if (msgType === 'error') {
        consoleErrors.push({
          message: msgText,
          type: msgType,
          location: location ? {
            url: location.url,
            lineNumber: location.lineNumber,
            columnNumber: location.columnNumber
          } : undefined,
          timestamp: new Date()
        });
      }
    });
    
    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      });
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Only report errors if the test failed
    if (testInfo.status === 'failed') {
      const hasConsoleErrors = consoleErrors.length > 0;
      const hasPageErrors = pageErrors.length > 0;
      
      if (hasConsoleErrors || hasPageErrors) {
        // Print to console for immediate visibility
        console.log('\n' + '='.repeat(80));
        console.log('❌ BROWSER ERRORS DETECTED');
        console.log('='.repeat(80));
        console.log(`Test: ${testInfo.title}`);
        console.log(`File: ${testInfo.file}`);
        
        if (hasConsoleErrors) {
          console.log(`\n📋 Console Errors (${consoleErrors.length}):`);
          consoleErrors.forEach((err, index) => {
            console.log(`\n  ${index + 1}. ${err.type.toUpperCase()}: ${err.message}`);
            if (err.location?.url) {
              console.log(`     at ${err.location.url}:${err.location.lineNumber || '?'}:${err.location.columnNumber || '?'}`);
            }
            console.log(`     time: ${err.timestamp.toISOString()}`);
          });
        }
        
        if (hasPageErrors) {
          console.log(`\n⚠️  Page Errors (${pageErrors.length}):`);
          pageErrors.forEach((err, index) => {
            console.log(`\n  ${index + 1}. ${err.name}: ${err.message}`);
            if (err.stack) {
              console.log(`     Stack trace:\n${err.stack.split('\n').map(line => '       ' + line).join('\n')}`);
            }
            console.log(`     time: ${err.timestamp.toISOString()}`);
          });
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Attach console errors to test report
        if (hasConsoleErrors) {
          const consoleErrorReport = consoleErrors.map((err, index) => 
            `${index + 1}. ${err.type.toUpperCase()}: ${err.message}\n` +
            `   Location: ${err.location?.url || 'unknown'}:${err.location?.lineNumber || '?'}:${err.location?.columnNumber || '?'}\n` +
            `   Time: ${err.timestamp.toISOString()}`
          ).join('\n\n');
          
          await testInfo.attach('console-errors.txt', {
            body: consoleErrorReport,
            contentType: 'text/plain'
          });
        }
        
        // Attach page errors to test report
        if (hasPageErrors) {
          const pageErrorReport = pageErrors.map((err, index) => 
            `${index + 1}. ${err.name}: ${err.message}\n` +
            `${err.stack ? `Stack trace:\n${err.stack}\n` : ''}` +
            `Time: ${err.timestamp.toISOString()}`
          ).join('\n\n');
          
          await testInfo.attach('page-errors.txt', {
            body: pageErrorReport,
            contentType: 'text/plain'
          });
        }
      }
    }
  });
}

/**
 * Returns a function that captures console errors for a specific page.
 * This is for backwards compatibility with existing tests that use setupConsoleErrorListener.
 * @deprecated Use setupConsoleErrorReporting() instead for automatic error reporting
 */
export function setupConsoleErrorListener(page: any): string[] {
  const errors: string[] = [];
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}