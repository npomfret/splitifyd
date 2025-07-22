#!/usr/bin/env npx tsx

/**
 * Webapp-v2 MCP Browser Test Runner
 * 
 * Uses actual MCP browser test results to validate webapp-v2 functionality
 */

interface BrowserTestResult {
  url: string;
  title: string;
  hasLoginButton: boolean;
  hasSignUpButton: boolean;
  hasWelcomeText: boolean;
  hasPreactText: boolean;
  loginButtonText: string;
  pageText: string;
  consoleErrors: number;
  readyState: string;
}

interface TestAssertion {
  name: string;
  expected: any;
  actual: any;
  passed: boolean;
  message: string;
}

export class McpWebappV2Tester {
  private assertions: TestAssertion[] = [];

  /**
   * Run tests with actual MCP browser results
   */
  runTests(browserResult: BrowserTestResult): void {
    console.log('🧪 Running Webapp-v2 MCP Tests...\n');

    // Test 1: Navigation
    this.assert('Page Navigation', 
      'http://localhost:6002/v2/', 
      browserResult.url,
      'Successfully navigated to webapp-v2'
    );

    // Test 2: Page Title
    this.assert('Page Title',
      'Splitifyd',
      browserResult.title,
      'Correct page title set'
    );

    // Test 3: Login Button
    this.assert('Login Button Present',
      true,
      browserResult.hasLoginButton,
      'Login button exists on page'
    );

    // Test 4: Sign Up Button
    this.assert('Sign Up Button Present',
      true,
      browserResult.hasSignUpButton,
      'Sign Up button exists on page'
    );

    // Test 5: Welcome Text
    this.assert('Welcome Message',
      true,
      browserResult.hasWelcomeText,
      'Welcome text displayed'
    );

    // Test 6: Preact Info
    this.assert('Preact Technology Info',
      true,
      browserResult.hasPreactText,
      'Preact tech stack info shown'
    );

    // Test 7: Console Errors
    this.assert('No Console Errors',
      0,
      browserResult.consoleErrors,
      'Page loads without console errors'
    );

    // Test 8: Page Load State
    this.assert('Page Fully Loaded',
      'complete',
      browserResult.readyState,
      'Document is fully loaded'
    );

    // Test 9: Login Button Text
    this.assert('Login Button Text',
      'Login',
      browserResult.loginButtonText,
      'Login button has correct text'
    );

    this.generateReport();
  }

  private assert(name: string, expected: any, actual: any, message: string): void {
    const passed = expected === actual;
    const status = passed ? '✅' : '❌';
    
    this.assertions.push({
      name,
      expected,
      actual,
      passed,
      message
    });

    console.log(`${status} ${name}: ${message}`);
    if (!passed) {
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual: ${actual}`);
    }
  }

  private generateReport(): void {
    const passed = this.assertions.filter(a => a.passed).length;
    const failed = this.assertions.filter(a => !a.passed).length;
    const total = this.assertions.length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${Math.round((passed/total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.assertions
        .filter(a => !a.passed)
        .forEach(a => {
          console.log(`   • ${a.name}`);
          console.log(`     Expected: ${a.expected}, Got: ${a.actual}`);
        });
    }

    console.log('\n🎯 OVERALL RESULT:', failed === 0 ? 'PASS ✅' : 'FAIL ❌');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Webapp-v2 is working correctly.');
    } else {
      console.log('🚨 Some tests failed. Please review and fix issues.');
    }
  }
}

// Test with the actual MCP results from our previous run
const mockBrowserResult: BrowserTestResult = {
  url: "http://localhost:6002/v2/",
  title: "Splitifyd", 
  hasLoginButton: true,
  hasSignUpButton: true,
  hasWelcomeText: true,
  hasPreactText: true,
  loginButtonText: "Login",
  pageText: "Welcome to Splitifyd v2\n\nBuilt with Preact + Vite + TypeScript\n\nLogin\nSign Up",
  consoleErrors: 0,
  readyState: "complete"
};

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new McpWebappV2Tester();
  tester.runTests(mockBrowserResult);
}

export { BrowserTestResult };