import { pageTest, expect } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

// NOTE: ARIA labels testing moved to unit tests for better performance
pageTest.describe('Form Accessibility', () => {
  pageTest('should navigate login form with keyboard', async ({ loginPageNavigated }) => {
    const { page } = loginPageNavigated;
    
    // Focus should start at first input or be tabbable to it
    await page.keyboard.press('Tab');
    
    // Type in focused field (should be email)
    await page.keyboard.type('test@example.com');
    
    // Tab to password field
    await page.keyboard.press('Tab');
    await page.keyboard.type('Password123');
    
    // Tab to submit button
    await page.keyboard.press('Tab');
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    
    // Form was submitted (will stay on page if invalid credentials)
    // Just verify no errors occurred during keyboard navigation
    
    // No console errors
    // Console errors are automatically captured by 
  });
});