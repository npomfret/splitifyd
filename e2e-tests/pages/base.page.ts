import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  async clearAndFill(selector: string, value: string) {
    const input = this.page.locator(selector);
    await input.click();
    await input.clear();
    await input.fill(value);
  }

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
    
    // Small wait to ensure signal updates
    await this.page.waitForTimeout(100);
  }
  
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }
  
  async waitForNavigation(urlPattern: RegExp, timeout = 2000) {
    await this.page.waitForURL(urlPattern, { timeout });
  }
  
  async clickButtonWithText(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }
  
  async isVisible(selector: string, timeout = 2000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }
}