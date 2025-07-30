import { Page } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  async clearAndFill(selector: string, value: string) {
    const input = this.page.locator(selector);
    await input.click();
    await input.clear();
    await input.fill(value);
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