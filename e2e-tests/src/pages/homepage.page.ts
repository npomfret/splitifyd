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

  // Additional element accessors for test refactoring

}