import { pageTest, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Security Monitoring E2E', () => {
  pageTest('should not expose sensitive information in console', async ({ page, loginPage, registerPage }) => {
    const consoleLogs: string[] = [];
    
    // Capture all console messages
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    // Navigate through auth pages using page objects
    
    await loginPage.navigate();
    await registerPage.navigate();
    
    // Check logs don't contain sensitive patterns
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /api[_-]?key/i,
      /secret/i,
      /credential/i
    ];
    
    const sensitiveLogs = consoleLogs.filter(log => 
      sensitivePatterns.some(pattern => pattern.test(log))
    );
    
    // Should not log sensitive information
    expect(sensitiveLogs).toHaveLength(0);
  });
});