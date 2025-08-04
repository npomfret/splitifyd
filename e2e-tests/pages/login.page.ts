import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS } from '../constants/selectors';

export class LoginPage extends BasePage {
  // Selectors
  readonly url = '/v2/login';
  readonly signInButton = 'Sign In';
  readonly signUpLink = 'Sign up';
  readonly forgotPasswordLink = 'Forgot your password?';

  async navigate() {
    await this.navigateToLogin();
  }
  
  async fillLoginForm(email: string, password: string, rememberMe = false) {
    await this.fillPreactInput(SELECTORS.EMAIL_INPUT, email);
    await this.fillPreactInput(SELECTORS.PASSWORD_INPUT, password);
    if (rememberMe) {
      await this.page.locator(SELECTORS.CHECKBOX).check();
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
    await this.page.getByRole(ARIA_ROLES.LINK, { name: this.signUpLink }).first().click();
  }
  
  async clickForgotPassword() {
    await this.page.getByRole(ARIA_ROLES.LINK, { name: this.forgotPasswordLink }).click();
  }

  // Element accessors for direct interaction in tests
  getEmailInput() {
    return this.page.locator(SELECTORS.EMAIL_INPUT);
  }

  getPasswordInput() {
    return this.page.locator(SELECTORS.PASSWORD_INPUT);
  }

  getRememberMeCheckbox() {
    return this.page.locator(SELECTORS.CHECKBOX);
  }

  getSubmitButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.signInButton });
  }

  getSignUpLink() {
    return this.page.getByRole(ARIA_ROLES.LINK, { name: this.signUpLink });
  }

  getForgotPasswordLink() {
    return this.page.getByRole(ARIA_ROLES.LINK, { name: this.forgotPasswordLink });
  }

  // Form element labels and headings
  getSignInHeading() {
    return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.SIGN_IN });
  }

  getEmailLabel() {
    return this.page.getByText('Email address *');
  }

  getPasswordLabel() {
    return this.page.getByText('Password *');
  }
}