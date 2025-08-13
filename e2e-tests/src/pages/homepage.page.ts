import { BasePage } from './base.page';

export class HomepagePage extends BasePage {
  // Navigation
  async navigate() {
    await this.navigateToHomepage();
  }

  // Content sections
  async mainHeading() {
    return this.page.getByRole('heading', { level: 1 });
  }
}