import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { V2_URL, waitForV2App, setupConsoleErrorListener } from './helpers';

// Simplified accessibility test - just basic axe scan
test.describe('Accessibility Tests', () => {
  test('should not have critical accessibility issues', async ({ page }) => {
    const errors = setupConsoleErrorListener(page);
    
    await page.goto(V2_URL);
    await waitForV2App(page);
    
    // Run basic accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Disable while design is in flux
      .analyze();
    
    // Log violations for debugging but don't fail on minor issues
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations found:', accessibilityScanResults.violations);
    }
    
    // Only fail on critical violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical'
    );
    expect(criticalViolations).toHaveLength(0);
    
    // No console errors
    expect(errors).toHaveLength(0);
  });
});