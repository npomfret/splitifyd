import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  // Selectors
  readonly url = '/v2/login';
  readonly emailInput = 'input[type="email"]';
  readonly passwordInput = 'input[type="password"]';
  readonly rememberMeCheckbox = 'input[type="checkbox"]';
  readonly signInButton = 'Sign In';
  readonly signUpLink = 'Sign up';
  readonly forgotPasswordLink = 'Forgot your password?';
  readonly errorMessage = '.text-red-600';
  
  async navigate() {
    await this.page.goto(this.url);
    await this.waitForNetworkIdle();
  }
  
  async fillLoginForm(email: string, password: string, rememberMe = false) {
    await this.clearAndFill(this.emailInput, email);
    await this.clearAndFill(this.passwordInput, password);
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
  
  async getErrorMessage(): Promise<string | null> {
    const error = this.page.locator(this.errorMessage);
    if (await error.isVisible()) {
      return await error.textContent();
    }
    return null;
  }
  
  async clickSignUp() {
    await this.page.getByRole('link', { name: this.signUpLink }).first().click();
  }
  
  async clickForgotPassword() {
    await this.page.getByRole('link', { name: this.forgotPasswordLink }).click();
  }
}