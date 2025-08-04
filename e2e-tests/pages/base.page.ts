import { Page, Locator, expect } from '@playwright/test';
import { EMULATOR_URL } from '../helpers/emulator-utils';

export abstract class BasePage {
  constructor(protected page: Page) {}
  /**
   * Fill an input field in a way that properly triggers Preact signal updates.
   * This is necessary because Playwright's fill() method doesn't always trigger
   * the onChange events that Preact signals rely on.
   */
  async fillPreactInput(selector: string | Locator, value: string) {
    const input = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    // Focus the input
    await input.click();
    
    // Clear existing content
    await input.fill('');
    
    // Type each character to ensure proper event triggering
    for (const char of value) {
      await input.type(char);
    }
    
    // Blur the field to ensure validation runs
    await input.blur();
    
    // Wait for any validation state change after blur
    await this.page.waitForLoadState('domcontentloaded');
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
}