import { BasePage } from './base.page';
import { EMULATOR_URL } from '../helpers';

export class LoginPage extends BasePage {
  // Selectors
  readonly url = '/v2/login';
  readonly emailInput = 'input[type="email"]';
  readonly passwordInput = 'input[type="password"]';
  readonly rememberMeCheckbox = 'input[type="checkbox"]';
  readonly signInButton = 'Sign In';
  readonly signUpLink = 'Sign up';
  readonly forgotPasswordLink = 'Forgot your password?';

  async navigate() {
    await this.page.goto(`${EMULATOR_URL}${this.url}`);
    await this.waitForNetworkIdle();
  }
  
  async fillLoginForm(email: string, password: string, rememberMe = false) {
    await this.fillPreactInput(this.emailInput, email);
    await this.fillPreactInput(this.passwordInput, password);
    if (rememberMe) {
      await this.page.locator(this.rememberMeCheckbox).check();
    }
  }
  
  async submitForm() {
    await this.clickButtonWithText(this.signInButton);
  }
  
  async login(email: string, password: string, rememberMe = false) {
    await this.fillLoginForm(email, password, rememberMe);
    await this.submitForm();
  }

  async clickSignUp() {
    await this.page.getByRole('link', { name: this.signUpLink }).first().click();
  }
  
  async clickForgotPassword() {
    await this.page.getByRole('link', { name: this.forgotPasswordLink }).click();
  }
}