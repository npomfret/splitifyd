import { BasePage } from './base.page';

export class RegisterPage extends BasePage {
  // Selectors
  readonly url = '/v2/register';
  readonly fullNameInput = 'input[placeholder="Enter your full name"]';
  readonly emailInput = 'input[placeholder="Enter your email"]';
  readonly passwordInput = 'input[placeholder="Create a strong password"]';
  readonly confirmPasswordInput = 'input[placeholder="Confirm your password"]';
  readonly termsCheckbox = 'input[type="checkbox"]';
  readonly createAccountButton = 'Create Account';
  readonly errorMessage = '.text-red-600';
  
  async navigate() {
    await this.page.goto(this.url);
    await this.waitForNetworkIdle();
  }
  
  async fillRegistrationForm(name: string, email: string, password: string) {
    await this.clearAndFill(this.fullNameInput, name);
    await this.clearAndFill(this.emailInput, email);
    await this.clearAndFill(this.passwordInput, password);
    await this.clearAndFill(this.confirmPasswordInput, password);
    await this.page.locator(this.termsCheckbox).check();
  }
  
  async submitForm() {
    await this.clickButtonWithText(this.createAccountButton);
  }
  
  async register(name: string, email: string, password: string) {
    await this.fillRegistrationForm(name, email, password);
    await this.submitForm();
  }
  
  async getErrorMessage(): Promise<string | null> {
    const error = this.page.locator(this.errorMessage);
    if (await error.isVisible()) {
      return await error.textContent();
    }
    return null;
  }
}