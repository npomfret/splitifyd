import { test } from '@playwright/test';
import { V2_URL } from './emulator-utils';

/**
 * MCP Integration for Playwright E2E Tests
 * 
 * This module bridges Playwright e2e tests with MCP browser tests,
 * allowing failed tests to be debugged using Claude Code's MCP tools.
 */

export interface MCPTestInstructions {
  testName: string;
  testFile: string;
  failureMessage: string;
  url: string;
  mcpSteps: MCPStep[];
}

export interface MCPStep {
  description: string;
  tool: string;
  parameters: Record<string, any>;
}

/**
 * Generate MCP test file content that can be run via Claude Code
 */
export function generateMCPTestFile(instructions: MCPTestInstructions): string {
  return `#!/usr/bin/env npx tsx

/**
 * MCP Debug Test for: ${instructions.testName}
 * Generated from failed Playwright test in: ${instructions.testFile}
 * Failure: ${instructions.failureMessage}
 */

import { BrowserTestBase, V2_BASE_URL } from '../mcp-browser-tests/lib/browser-test-base';

class DebugTest extends BrowserTestBase {
  constructor() {
    super('Debug: ${instructions.testName}');
  }

  async runTests(): Promise<number> {
    this.log('Starting debug test for failed e2e test...');
    
    try {
      // Navigate to the failure URL
      console.log(\`
MCP Browser Instructions:
1. Navigate to ${instructions.url}
   Use: mcp__puppeteer__puppeteer_navigate
\`);

${instructions.mcpSteps.map((step, i) => `
      // Step ${i + 1}: ${step.description}
      console.log(\`
${i + 2}. ${step.description}
   Use: ${step.tool}
   Parameters: ${JSON.stringify(step.parameters, null, 2)}
\`);`).join('\n')}

      // Check for console errors
      console.log(\`
${instructions.mcpSteps.length + 2}. Check for console errors
   Use: mcp__puppeteer__puppeteer_evaluate
   Script: "(() => { const errors = []; window.addEventListener('error', e => errors.push(e.message)); return errors; })()"
\`);

      // Take final screenshot
      console.log(\`
${instructions.mcpSteps.length + 3}. Take screenshot of final state
   Use: mcp__puppeteer__puppeteer_screenshot
   Name: "debug-${instructions.testName.replace(/\s+/g, '-').toLowerCase()}"
\`);

    } catch (error) {
      this.recordResult(
        'Debug Execution',
        false,
        'Failed to complete debug steps',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }

    return this.generateReport();
  }
}

// Run the debug test
const tester = new DebugTest();
tester.runTests().then(exitCode => {
  console.log('\\n🔍 Debug test complete. Review the results above.');
  process.exit(exitCode);
});
`;
}

/**
 * Hook to generate MCP debug instructions on test failure
 */
export function setupMCPDebugOnFailure() {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      console.log('\n' + '='.repeat(80));
      console.log('❌ TEST FAILED - MCP DEBUG INSTRUCTIONS');
      console.log('='.repeat(80));
      console.log(`Test: ${testInfo.title}`);
      console.log(`File: ${testInfo.file}`);
      console.log(`URL: ${page.url()}`);
      console.log('\nTo debug this test with Claude Code MCP:');
      console.log('1. Ask Claude: "Debug the failed test using MCP browser tools"');
      console.log('2. Claude will navigate to the page and check for issues');
      console.log('3. Screenshots and console logs will be captured');
      console.log('='.repeat(80) + '\n');
    }
  });
}

/**
 * Convert Playwright test actions to MCP instructions
 */
export function playwrightToMCPSteps(actions: Array<{
  type: 'click' | 'fill' | 'navigate' | 'waitFor' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  description: string;
}>): MCPStep[] {
  return actions.map(action => {
    switch (action.type) {
      case 'navigate':
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_navigate',
          parameters: { url: action.url || V2_URL }
        };
      
      case 'click':
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_click',
          parameters: { selector: action.selector }
        };
      
      case 'fill':
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_fill',
          parameters: { 
            selector: action.selector,
            value: action.value 
          }
        };
      
      case 'screenshot':
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_screenshot',
          parameters: { 
            name: action.value || 'screenshot',
            width: 1280,
            height: 800
          }
        };
      
      case 'waitFor':
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_evaluate',
          parameters: {
            script: `document.querySelector('${action.selector}') !== null`
          }
        };
      
      default:
        return {
          description: action.description,
          tool: 'mcp__puppeteer__puppeteer_evaluate',
          parameters: { script: '// Custom action' }
        };
    }
  });
}

/**
 * Helper to log MCP debug instructions when a test fails
 */
export function logMCPDebugInstructions(testName: string, url: string, error: any) {
  console.log('\n' + '='.repeat(80));
  console.log('❌ TEST FAILED - MCP DEBUG AVAILABLE');
  console.log('='.repeat(80));
  console.log(`Test: ${testName}`);
  console.log(`URL: ${url}`);
  console.log(`Error: ${error?.message || error}`);
  console.log('\n🔍 To debug with MCP, ask Claude:');
  console.log(`"Debug the '${testName}' test failure using MCP browser tools at ${url}"`);
  console.log('='.repeat(80) + '\n');
}