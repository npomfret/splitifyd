import { BasePage } from './base.page';
import { SELECTORS, ARIA_ROLES, HEADINGS } from '../constants/selectors';

export class RegisterPage extends BasePage {
  // Selectors
  readonly url = '/v2/register';
  readonly fullNameInput = 'input[placeholder="Enter your full name"]';
  readonly emailInput = 'input[placeholder="Enter your email"]';
  readonly passwordInput = 'input[placeholder="Create a strong password"]';
  readonly confirmPasswordInput = 'input[placeholder="Confirm your password"]';
  readonly createAccountButton = 'Create Account';

  async navigate() {
    await this.navigateToRegister();
    
    // Fail fast if we're not on the register page
    // This ensures tests start from a known state
    try {
      await this.expectUrl(/\/register/);
    } catch (error) {
      throw new Error('Expected to navigate to register page but was redirected. Test requires clean authentication state.');
    }
  }
  
  async fillRegistrationForm(name: string, email: string, password: string) {
    await this.fillPreactInput(this.fullNameInput, name);
    await this.fillPreactInput(this.emailInput, email);
    await this.fillPreactInput(this.passwordInput, password);
    await this.fillPreactInput(this.confirmPasswordInput, password);
    await this.page.locator(SELECTORS.CHECKBOX).check();
  }
  
  async submitForm() {
    await this.clickButtonWithText(this.createAccountButton);
  }
  
  async register(name: string, email: string, password: string) {
    await this.fillRegistrationForm(name, email, password);
    await this.submitForm();
  }

  // Element accessors for direct interaction in tests
  getFullNameInput() {
    return this.page.locator(this.fullNameInput);
  }

  getEmailInput() {
    return this.page.locator(this.emailInput);
  }

  getPasswordInput() {
    return this.page.locator(this.passwordInput);
  }

  getConfirmPasswordInput() {
    return this.page.locator(this.confirmPasswordInput);
  }

  getPasswordInputs() {
    return this.page.locator(SELECTORS.PASSWORD_INPUT);
  }

  getTermsCheckbox() {
    return this.page.locator(SELECTORS.CHECKBOX);
  }

  getSubmitButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: this.createAccountButton });
  }

  // Alternative selector methods for fallback
  getNameInputByType() {
    return this.page.locator(SELECTORS.TEXT_INPUT).first();
  }

  getEmailInputByType() {
    return this.page.locator(SELECTORS.EMAIL_INPUT);
  }

  // Form element labels and headings
  getCreateAccountHeading() {
    return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.CREATE_ACCOUNT });
  }

  getFullNameLabel() {
    return this.page.getByText('Full Name *');
  }

  getEmailLabel() {
    return this.page.getByText('Email address *');
  }

  getPasswordLabel() {
    return this.page.getByText('Password *', { exact: true });
  }

  getConfirmPasswordLabel() {
    return this.page.getByText('Confirm Password *');
  }

  getSignInLink() {
    return this.page.getByRole(ARIA_ROLES.LINK, { name: 'Sign in' });
  }
}