#!/usr/bin/env npx ts-node

/**
 * Browser Testing Script for webapp-v2
 * 
 * This script provides manual testing guidance and automated checks for the webapp-v2
 * application running at http://localhost:6002/v2/
 * 
 * Focus: webapp-v2 only (Preact app served via Firebase hosting at /v2/)
 */

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'MANUAL';
  message: string;
  url?: string;
  viewport?: string;
}

interface TestConfig {
  baseUrl: string;
  viewports: { name: string; width: number; height: number }[];
  routes: { path: string; name: string; expectFound: boolean }[];
}

const config: TestConfig = {
  baseUrl: 'http://localhost:6002/v2',
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 }
  ],
  routes: [
    { path: '/', name: 'HomePage', expectFound: true },
    { path: '/invalid-route', name: 'NotFoundPage', expectFound: false }
  ]
};

class WebappV2Tester {
  private results: TestResult[] = [];

  constructor(private config: TestConfig) {}

  log(message: string): void {
    console.log(`[Browser Test] ${message}`);
  }

  addResult(result: TestResult): void {
    this.results.push(result);
    const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🔍';
    this.log(`${status} ${result.testName}: ${result.message}`);
  }

  /**
   * Manual Testing Checklist
   * Outputs instructions for manual testing since automated browser tools are not available
   */
  async runManualTestingChecklist(): Promise<void> {
    this.log('=== WEBAPP-V2 MANUAL TESTING CHECKLIST ===\n');

    this.log('Prerequisites:');
    this.log('1. Ensure Firebase emulator is running (npm run dev:integrated)');
    this.log('2. Ensure webapp-v2 is built (npm run webapp-v2:build)');
    this.log('3. Open browser developer tools (F12)\n');

    for (const route of this.config.routes) {
      const url = `${this.config.baseUrl}${route.path}`;
      
      this.log(`--- Testing Route: ${route.name} ---`);
      this.log(`URL: ${url}`);
      
      if (route.expectFound) {
        this.log('Expected: Page should load successfully');
        this.addResult({
          testName: `${route.name} - Manual Navigation`,
          status: 'MANUAL',
          message: `Navigate to ${url} and verify page loads`,
          url
        });
      } else {
        this.log('Expected: Should show NotFoundPage component');
        this.addResult({
          testName: `${route.name} - Manual Navigation`,
          status: 'MANUAL',
          message: `Navigate to ${url} and verify NotFoundPage shows`,
          url
        });
      }

      this.log('Manual checks to perform:');
      this.log('  □ Console shows no errors (red messages)');
      this.log('  □ Console shows no warnings (yellow messages)');
      this.log('  □ Page renders without blank/white screen');
      this.log('  □ All text is visible and readable');
      this.log('  □ Preact router functions correctly\n');

      // Responsive testing instructions
      this.log('Responsive Testing:');
      for (const viewport of this.config.viewports) {
        this.log(`  □ ${viewport.name} (${viewport.width}x${viewport.height}px):`);
        this.log(`    - Set viewport size in DevTools`);
        this.log(`    - Verify layout looks correct`);
        this.log(`    - Check no horizontal scroll appears`);
        this.log(`    - Take screenshot for documentation`);
        
        this.addResult({
          testName: `${route.name} - ${viewport.name} viewport`,
          status: 'MANUAL',
          message: `Test at ${viewport.width}x${viewport.height}px`,
          url,
          viewport: viewport.name
        });
      }
      this.log('');
    }

    this.log('--- Network Testing ---');
    this.log('Check the Network tab in DevTools:');
    this.log('  □ All requests return appropriate status codes');
    this.log('  □ No failed requests (red entries)');
    this.log('  □ API calls to /api/* routes work correctly');
    this.log('  □ Static assets load successfully\n');

    this.log('--- Preact-Specific Checks ---');
    this.log('  □ Preact DevTools shows component tree (if extension installed)');
    this.log('  □ React compatibility imports work correctly');
    this.log('  □ Component state updates properly');
    this.log('  □ Router transitions work smoothly\n');
  }

  /**
   * Basic connectivity check
   * Simple fetch to verify the server is responding
   */
  async checkServerConnectivity(): Promise<void> {
    this.log('--- Server Connectivity Check ---');
    
    for (const route of this.config.routes) {
      const url = `${this.config.baseUrl}${route.path}`;
      
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          this.addResult({
            testName: `Server Response - ${route.name}`,
            status: 'PASS',
            message: `HTTP ${response.status} - Server responding`,
            url
          });
        } else {
          this.addResult({
            testName: `Server Response - ${route.name}`,
            status: 'FAIL',
            message: `HTTP ${response.status} - Unexpected status`,
            url
          });
        }
      } catch (error) {
        this.addResult({
          testName: `Server Response - ${route.name}`,
          status: 'FAIL',
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          url
        });
      }
    }
  }

  /**
   * Generate testing summary report
   */
  generateReport(): void {
    this.log('\n=== TEST SUMMARY ===');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const manual = this.results.filter(r => r.status === 'MANUAL').length;
    
    this.log(`✅ Passed: ${passed}`);
    this.log(`❌ Failed: ${failed}`);
    this.log(`🔍 Manual: ${manual}`);
    this.log(`📊 Total: ${this.results.length}`);

    if (failed > 0) {
      this.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => this.log(`  - ${r.testName}: ${r.message}`));
    }

    this.log('\n=== NEXT STEPS ===');
    this.log('1. Complete all manual testing checklist items');
    this.log('2. Fix any failed automated checks');
    this.log('3. Take screenshots of successful states');
    this.log('4. Document any issues found');
    this.log('5. Consider adding Playwright for full automation\n');
  }

  /**
   * Run all available tests
   */
  async runAllTests(): Promise<void> {
    this.log('Starting webapp-v2 browser testing...\n');
    
    // Run connectivity checks first
    await this.checkServerConnectivity();
    
    // Then provide manual testing guidance
    await this.runManualTestingChecklist();
    
    // Generate final report
    this.generateReport();
  }
}

// Main execution
async function main(): Promise<void> {
  const tester = new WebappV2Tester(config);
  await tester.runAllTests();
}

// Only run if this script is called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WebappV2Tester, TestResult, TestConfig };