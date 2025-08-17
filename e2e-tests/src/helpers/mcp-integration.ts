import { test } from '@playwright/test';

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
