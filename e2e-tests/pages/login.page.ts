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

  async navigate() {
    await this.navigateToLogin();
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

  // Element accessors for direct interaction in tests
  getEmailInput() {
    return this.page.locator(this.emailInput);
  }

  getPasswordInput() {
    return this.page.locator(this.passwordInput);
  }

  getRememberMeCheckbox() {
    return this.page.locator(this.rememberMeCheckbox);
  }

  getSubmitButton() {
    return this.page.getByRole('button', { name: this.signInButton });
  }

  getSignUpLink() {
    return this.page.getByRole('link', { name: this.signUpLink });
  }

  getForgotPasswordLink() {
    return this.page.getByRole('link', { name: this.forgotPasswordLink });
  }

  // Form element labels and headings
  getSignInHeading() {
    return this.page.getByRole('heading', { name: 'Sign In' });
  }

  getEmailLabel() {
    return this.page.getByText('Email address *');
  }

  getPasswordLabel() {
    return this.page.getByText('Password *');
  }
}