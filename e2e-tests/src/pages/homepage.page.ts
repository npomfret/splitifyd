import { expect } from '@playwright/test';
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

  // Get specific heading by text
  getHeading(text: string) {
    return this.page.getByRole('heading', { name: text });
  }

  async featuresSection() {
    return this.page.locator('[data-testid="features-section"]')
      .or(this.page.getByRole('region', { name: /features/i }));
  }

  // Actions
  async clickGetStarted() {
    const button = await this.getStartedButton();
    await expect(button).toBeEnabled();
    await button.click();
  }

  async goToPricing() {
    const link = await this.pricingLink();
    await expect(link).toBeEnabled();
    await link.click();
  }

  async goToLogin() {
    const link = await this.signInLink();
    await expect(link).toBeEnabled();
    await link.click();
  }

  async goToSignUp() {
    const link = await this.signUpLink();
    await expect(link).toBeEnabled();
    await link.click();
  }

  // Additional element accessors for test refactoring

  /**
   * Get Splitifyd logo/home link
   */
  getLogoLink() {
    return this.page.getByRole('link', { name: /splitifyd|home/i }).first();
  }

  /**
   * Get Splitifyd image by alt text
   */
  getSplitifydAltImage() {
    return this.page.getByAltText('Splitifyd');
  }

  /**
   * Get the main homepage heading
   */
  getHomepageHeading() {
    return this.page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    });
  }

  /**
   * Get Terms link (typically in footer)
   */
  getTermsLink() {
    return this.page.getByRole('link', { name: 'Terms' });
  }

  /**
   * Get Privacy link (typically in footer)
   */
  getPrivacyLink() {
    return this.page.getByRole('link', { name: 'Privacy' });
  }

  /**
   * Get Login link (alternative accessor)
   */
  getLoginLink() {
    return this.page.getByRole('link', { name: 'Login' });
  }

  /**
   * Get Sign Up link with exact match
   */
  getSignUpLinkExact() {
    return this.page.getByRole('link', { name: 'Sign Up', exact: true });
  }
}