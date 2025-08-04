import { BasePage } from './base.page';

export class HomepagePage extends BasePage {
  // Navigation
  async navigate() {
    await this.navigateToHomepage();
  }

  // Header elements
  async getStartedButton() {
    return this.page.getByRole('button', { name: /get started|start/i });
  }

  async pricingLink() {
    return this.page.getByRole('link', { name: /pricing/i });
  }

  async signInLink() {
    return this.page.getByRole('link', { name: /sign in|login/i });
  }

  async signUpLink() {
    return this.page.getByRole('link', { name: /sign up|register/i });
  }

  // Content sections
  async mainHeading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  async featuresSection() {
    return this.page.locator('[data-testid="features-section"]')
      .or(this.page.getByRole('region', { name: /features/i }));
  }

  // Actions
  async clickGetStarted() {
    const button = await this.getStartedButton();
    await button.click();
  }

  async goToPricing() {
    const link = await this.pricingLink();
    await link.click();
  }

  async goToLogin() {
    const link = await this.signInLink();
    await link.click();
  }

  async goToSignUp() {
    const link = await this.signUpLink();
    await link.click();
  }
}