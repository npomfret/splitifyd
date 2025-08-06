import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers/emulator-utils';

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
   */
  private async validateInputValue(input: Locator, expectedValue: string): Promise<void> {
    const actualValue = await input.inputValue();
    if (actualValue !== expectedValue) {
      const fieldIdentifier = await this.getFieldIdentifier(input);
      throw new Error(`Input validation failed for field "${fieldIdentifier}": expected "${expectedValue}" but got "${actualValue}"`);
    }
  }
  
  /**
   * Fill an input field in a way that properly triggers Preact signal updates.
   * This is necessary because Playwright's fill() method doesn't always trigger
   * the onChange events that Preact signals rely on.
   * Uses focus-based waiting with pressSequentially for reliable input.
   */
  async fillPreactInput(selector: string | Locator, value: string) {
    const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    // Single click and wait for focus
    await input.click();
    await this.waitForFocus(input);
    
    // Clear and validate
    await input.fill('');
    await this.validateInputValue(input, '');
    
    // Ensure still focused before typing
    await this.waitForFocus(input);
    await input.pressSequentially(value);
    
    // Blur to trigger Preact validation and wait for state changes
    await input.blur();
    await this.page.waitForLoadState('domcontentloaded');
    
    // Final validation
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