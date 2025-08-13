import { BasePage } from './base.page';

export class PricingPage extends BasePage {
  // Navigation
  async navigate() {
    await this.navigateToPricing();
  }

  // Get heading with specific level
  getHeadingWithLevel(text: string, level: number) {
    return this.page.getByRole('heading', { name: text, level });
  }

}