#!/usr/bin/env npx tsx

/**
 * MCP Debug Runner for E2E Tests
 * 
 * This script allows running MCP browser tests to debug failed e2e tests.
 * It can be invoked manually or by Claude Code when a test fails.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const USAGE = `
Usage: npx tsx e2e/run-mcp-debug.ts [options]

Options:
  --test <name>     Name of the test to debug
  --url <url>       URL where the test failed
  --file <path>     Path to the test file
  --error <msg>     Error message from the failed test

Examples:
  npx tsx e2e/run-mcp-debug.ts --test "should show form fields on login page" --url "http://localhost:6002/v2/login"
  npx tsx e2e/run-mcp-debug.ts --file "auth-flow.e2e.test.ts" --error "Expected button to be visible"
`;

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace('--', '');
    const value = argv[i + 1];
    if (value) {
      args[key] = value;
    }
  }
  
  return args;
}

function generateMCPDebugTest(args: Record<string, string>): string {
  const testName = args.test || 'Unknown Test';
  const url = args.url || 'http://localhost:6002/v2';
  const errorMsg = args.error || 'Test failed';
  const testFile = args.file || 'unknown.test.ts';

  return `#!/usr/bin/env npx tsx

/**
 * MCP Debug Test
 * Test: ${testName}
 * File: ${testFile}
 * Error: ${errorMsg}
 */

import { BrowserTestBase } from '../../mcp-browser-tests/lib/browser-test-base';

class DebugFailedTest extends BrowserTestBase {
  constructor() {
    super('Debug: ${testName}');
  }

  async runTests(): Promise<number> {
    this.log('Debugging failed e2e test...');
    
    // Instructions for Claude Code MCP
    console.log(\`
====================================================================
🔍 MCP BROWSER DEBUG SESSION
====================================================================

Failed Test: ${testName}
Test File: ${testFile}
Failure URL: ${url}
Error: ${errorMsg}

MCP Browser Instructions:

1. Navigate to the failure URL
   Use: mcp__puppeteer__puppeteer_navigate
   URL: ${url}

2. Wait for page to load
   Use: mcp__puppeteer__puppeteer_evaluate
   Script: "document.readyState === 'complete'"

3. Take initial screenshot
   Use: mcp__puppeteer__puppeteer_screenshot
   Name: "debug-initial"
   Width: 1280
   Height: 800

4. Check for console errors
   Use: mcp__puppeteer__puppeteer_evaluate
   Script: "(() => {
     const logs = [];
     const originalLog = console.log;
     const originalError = console.error;
     console.log = (...args) => { logs.push({type: 'log', message: args.join(' ')}); originalLog(...args); };
     console.error = (...args) => { logs.push({type: 'error', message: args.join(' ')}); originalError(...args); };
     return logs.filter(log => log.type === 'error');
   })()"

5. Check page title and basic structure
   Use: mcp__puppeteer__puppeteer_evaluate
   Script: "{ title: document.title, hasV2Marker: !!document.body.textContent.includes('v2 app'), url: window.location.href }"

6. Analyze specific failure point
   Based on the error "${errorMsg}", check:
   - Element visibility
   - Form field presence
   - Button states
   - Navigation issues

7. Take final screenshot with annotations
   Use: mcp__puppeteer__puppeteer_screenshot
   Name: "debug-final-annotated"

====================================================================
NEXT STEPS:
1. Review console errors
2. Compare screenshots
3. Check element selectors
4. Verify page state
====================================================================
\`);

    this.recordResult(
      'Debug Session',
      true,
      'Debug instructions generated for Claude Code MCP',
      'debug-session'
    );

    return this.generateReport();
  }
}

// Run the debug test
const tester = new DebugFailedTest();
tester.runTests().then(exitCode => {
  console.log('\\n✅ Debug test instructions generated. Use Claude Code MCP tools to execute.');
  process.exit(exitCode);
});
`;
}

function main() {
  const args = parseArgs();
  
  if (Object.keys(args).length === 0) {
    console.log(USAGE);
    process.exit(1);
  }

  console.log('🔧 Generating MCP debug test...\n');
  
  const debugTest = generateMCPDebugTest(args);
  const outputPath = join(process.cwd(), '..', 'mcp-browser-tests', 'debug-temp.ts');
  
  writeFileSync(outputPath, debugTest);
  console.log(`✅ Debug test generated at: ${outputPath}`);
  
  console.log('\n📋 Running debug test instructions...\n');
  
  try {
    execSync(`npx tsx ${outputPath}`, { 
      stdio: 'inherit',
      cwd: process.cwd() 
    });
  } catch (error) {
    console.error('Failed to run debug test:', error);
  }
}

if (require.main === module) {
  main();
}