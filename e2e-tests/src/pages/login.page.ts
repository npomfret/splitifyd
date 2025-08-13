import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS } from '../constants/selectors';

export class LoginPage extends BasePage {
  // Selectors
  readonly url = '/login';
  readonly signInButton = 'Sign In';
  readonly signUpLink = 'Sign up';
  readonly forgotPasswordLink = 'Forgot your password?';

  async navigate() {
    await this.navigateToLogin();
    
    // Fail fast if we're not on the login page
    // This ensures tests start from a known state
    try {
      await this.expectUrl(/\/login/);
    } catch (error) {
      throw new Error('Expected to navigate to login page but was redirected. Test requires clean authentication state.');
    }
  }
  
  async fillLoginForm(email: string, password: string, rememberMe = false) {
    await this.fillPreactInput(SELECTORS.EMAIL_INPUT, email);
    await this.fillPreactInput(SELECTORS.PASSWORD_INPUT, password);
    if (rememberMe) {
      await this.page.locator(SELECTORS.CHECKBOX).check();
    }
  }
  
  async submitForm() {
    // Check button is enabled before clicking (provides better error messages)
    const submitButton = this.getSubmitButton();
    await this.expectButtonEnabled(submitButton, this.signInButton);
    await submitButton.click();
  }
  
  async login(email: string, password: string, rememberMe = false) {
    await this.fillLoginForm(email, password, rememberMe);
    await this.submitForm();
    
    // Simple approach: just wait for the form submission to complete
    // The AuthenticationWorkflow will handle waiting for dashboard
    await this.waitForNetworkIdle();
  }

  async clickSignUp() {
    const link = this.page.getByRole(ARIA_ROLES.LINK, { name: this.signUpLink }).first();
    await expect(link).toBeEnabled();
    await link.click();
  }
  
  async clickForgotPassword() {
    const link = this.page.getByRole(ARIA_ROLES.LINK, { name: this.forgotPasswordLink });
    await expect(link).toBeEnabled();
    await link.click();
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