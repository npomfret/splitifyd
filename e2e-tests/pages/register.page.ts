import { BasePage } from './base.page';
import { EMULATOR_URL } from '../helpers';

export class RegisterPage extends BasePage {
  // Selectors
  readonly url = '/v2/register';
  readonly fullNameInput = 'input[placeholder="Enter your full name"]';
  readonly emailInput = 'input[placeholder="Enter your email"]';
  readonly passwordInput = 'input[placeholder="Create a strong password"]';
  readonly confirmPasswordInput = 'input[placeholder="Confirm your password"]';
  readonly termsCheckbox = 'input[type="checkbox"]';
  readonly createAccountButton = 'Create Account';

  async navigate() {
    await this.page.goto(`${EMULATOR_URL}${this.url}`);
    await this.waitForNetworkIdle();
  }
  
  async fillRegistrationForm(name: string, email: string, password: string) {
    await this.fillPreactInput(this.fullNameInput, name);
    await this.fillPreactInput(this.emailInput, email);
    await this.fillPreactInput(this.passwordInput, password);
    await this.fillPreactInput(this.confirmPasswordInput, password);
    await this.page.locator(this.termsCheckbox).check();
  }
  
  async submitForm() {
    await this.clickButtonWithText(this.createAccountButton);
  }
  
  async register(name: string, email: string, password: string) {
    await this.fillRegistrationForm(name, email, password);
    await this.submitForm();
  }
}