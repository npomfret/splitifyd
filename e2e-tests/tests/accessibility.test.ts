import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { EMULATOR_URL, waitForApp, setupConsoleErrorReporting } from '../helpers';
import { HomepagePage } from '../pages';

setupConsoleErrorReporting();

// Simplified accessibility test - just basic axe scan
test.describe('Accessibility Tests', () => {
  test('should not have critical accessibility issues', async ({ page }) => {
    
    const homepagePage = new HomepagePage(page);
    await homepagePage.navigate();
    await waitForApp(page);
    
    // Run basic accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast']) // Disable while design is in flux
      .analyze();
    
    // Store violations for assertion but don't log them
    
    // Only fail on critical violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical'
    );
    expect(criticalViolations).toHaveLength(0);
    
    // No console errors
  });
});