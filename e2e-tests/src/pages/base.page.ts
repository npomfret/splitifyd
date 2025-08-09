import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers';
import { waitForURLWithContext } from '../helpers/wait-helpers';

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  /**
   * Waits for and validates that an element has focus.
   * Useful for ensuring proper focus state before input operations.
   */
  private async waitForFocus(input: Locator, timeout = 2000): Promise<void> {
    await expect(input).toBeFocused({ timeout });
  }

  /**
   * Helper method to get field identifier for error reporting.
   */
  private async getFieldIdentifier(input: Locator): Promise<string> {
    const fieldName = await input.getAttribute('name').catch(() => null);
    const fieldId = await input.getAttribute('id').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    
    return fieldName || fieldId || placeholder || 'unknown field';
  }

  /**
   * Validates that an input field contains the expected value.
   * Pure validation method - does not modify DOM state.
   * Allows trimmed values to match (UI may trim whitespace).
   */
  private async validateInputValue(input: Locator, expectedValue: string): Promise<void> {
    const actualValue = await input.inputValue();
    // Allow trimmed values to match (UI may trim whitespace from inputs)
    if (actualValue !== expectedValue && actualValue !== expectedValue.trim()) {
      const fieldIdentifier = await this.getFieldIdentifier(input);
      throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
    }
  }
  
  /**
   * Fill an input field in a way that properly triggers Preact signal updates.
   * This is necessary because Playwright's fill() method doesn't always trigger
   * the onChange events that Preact signals rely on.
   * Uses focus-based waiting with pressSequentially for reliable input.
   * Includes retry logic to handle text truncation which has been observed to happen under high load (typically during parallel test execution).
   */
  async fillPreactInput(selector: string | Locator, value: string, maxRetries = 3) {
    const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Single click and wait for focus
        await input.click();
        await this.waitForFocus(input);
        
        // Clear and validate
        await input.fill('');
        await this.validateInputValue(input, '');
        
        // Ensure still focused before typing
        await this.waitForFocus(input);
        await this.page.waitForTimeout(100);
        await input.pressSequentially(value);
        // await input.fill(value);

        // Blur to trigger Preact validation
        await input.blur();
        
        // Check if input was successful
        const actualValue = await input.inputValue();
        if (actualValue === value) {
          await this.page.waitForLoadState('domcontentloaded');
          return; // Success!
        }
        
        // Log and retry if not final attempt
        if (attempt < maxRetries) {
          const fieldId = await this.getFieldIdentifier(input);
          console.warn(`Input retry ${attempt}: expected "${value}", got "${actualValue}" for ${fieldId}`);
          await this.page.waitForTimeout(200); // Brief pause before retry
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`Attempt ${attempt} threw error, retrying:`, error instanceof Error ? error.message : String(error));
        await this.page.waitForTimeout(200);
      }
    }
    
    // Final validation after all retries (throws error if still incorrect)
    await this.validateInputValue(input, value);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }
  
  async waitForNavigation(urlPattern: RegExp, timeout = 2000) {
    await waitForURLWithContext(this.page, urlPattern, { timeout });
  }
  
  async clickButtonWithText(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Expects the page to match a URL pattern
   */
  async expectUrl(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }
  
  /**
   * Extracts a parameter from the current URL
   */
  getUrlParam(paramName: string): string | null {
    const url = new URL(this.page.url());
    const pathParts = url.pathname.split('/');
    const paramIndex = pathParts.indexOf(paramName);
    
    if (paramIndex !== -1 && paramIndex < pathParts.length - 1) {
      return pathParts[paramIndex + 1];
    }
    
    // For group IDs, extract from /groups/{id} pattern
    if (paramName === 'groupId') {
      const match = url.pathname.match(/\/groups\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }
    
    return null;
  }

  /**
   * Navigation helper methods to replace direct page.goto() calls
   */
  async navigateToHomepage(): Promise<void> {
    await this.page.goto(EMULATOR_URL);
    await this.waitForNetworkIdle();
  }

  async navigateToLogin(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/login`);
    await this.waitForNetworkIdle();
  }

  async navigateToRegister(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/register`);
    await this.waitForNetworkIdle();
  }

  async navigateToPricing(): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}/pricing`);
    await this.waitForNetworkIdle();
  }

  async navigateToShareLink(shareLink: string): Promise<void> {
    await this.page.goto(shareLink);
    await this.waitForNetworkIdle();
  }

  async navigateToStaticPath(path: string): Promise<void> {
    await this.page.goto(`${EMULATOR_URL}${path}`);
    await this.waitForNetworkIdle();
  }
}
