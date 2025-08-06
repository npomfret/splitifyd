import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers/emulator-utils';

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  /**
   * Validates that an input field contains the expected value.
   * Triggers blur event to ensure validation runs and waits for any state changes.
   */
  private async validateInputValue(input: Locator, expectedValue: string): Promise<void> {
    // Blur the field to ensure validation runs
    await input.blur();
    
    // Wait for any validation state change after blur
    await this.page.waitForLoadState('domcontentloaded');
    
    // Verify the field contains the expected value
    const actualValue = await input.inputValue();
    if (actualValue !== expectedValue) {
      // Get field attributes for better error reporting
      const fieldName = await input.getAttribute('name').catch(() => null);
      const fieldId = await input.getAttribute('id').catch(() => null);
      const placeholder = await input.getAttribute('placeholder').catch(() => null);
      
      const fieldIdentifier = fieldName || fieldId || placeholder || 'unknown field';
      throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
    }
  }
  
  /**
   * Fill an input field in a way that properly triggers Preact signal updates.
   * This is necessary because Playwright's fill() method doesn't always trigger
   * the onChange events that Preact signals rely on.
   * Uses the more reliable pressSequentially method with validation.
   */
  async fillPreactInput(selector: string | Locator, value: string) {
    const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    await input.click();
    await input.fill('');
    await this.validateInputValue(input, '');
    
    await input.click();
    await input.pressSequentially(value);
    await this.validateInputValue(input, value);
  }
  
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }
  
  async waitForNavigation(urlPattern: RegExp, timeout = 500) {
    await this.page.waitForURL(urlPattern, { timeout });
  }
  
  async clickButtonWithText(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Expects the page to match a URL pattern
   */
  async expectUrl(pattern: RegExp, timeout = 5000): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout });
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