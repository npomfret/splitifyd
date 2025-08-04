import { BasePage } from './base.page';

export class PricingPage extends BasePage {
  // Navigation
  async navigate() {
    await this.navigateToPricing();
  }

  // Page elements
  async pageHeading() {
    return this.page.getByRole('heading', { name: /pricing/i });
  }

  async freeplanCard() {
    return this.page.locator('[data-testid="free-plan"]')
      .or(this.page.getByText(/free/i).locator('..').locator('..'));
  }

  async premiumPlanCard() {
    return this.page.locator('[data-testid="premium-plan"]')
      .or(this.page.getByText(/premium|pro/i).locator('..').locator('..'));
  }

  async getStartedButton() {
    return this.page.getByRole('button', { name: /get started/i });
  }

  async upgradeButton() {
    return this.page.getByRole('button', { name: /upgrade|choose.*plan/i });
  }

  // Actions
  async clickGetStarted() {
    const button = await this.getStartedButton();
    await button.click();
  }

  async clickUpgrade() {
    const button = await this.upgradeButton();
    await button.click();
  }
}