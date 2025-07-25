import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';
import { 
  createButton, 
  createFormField, 
  createAuthHeader, 
  createAuthFooter, 
  createAuthCard,
  createWarningBanner 
} from './ui-builders.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  
  // Update page title from configuration
  await updatePageTitle('Register');
  
  // Get the app root container
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;
  
  // Initialize warning banner from config first
  const { firebaseConfigManager } = await import('./firebase-config-manager.js');
  const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
  
  // Create warning banner if message exists
  if (warningBannerConfig?.message) {
    const warningBanner = createWarningBanner({
      message: warningBannerConfig.message,
      isVisible: true
    });
    appRoot.appendChild(warningBanner);
  }
  
  // Create main content container
  const mainContent = document.createElement('div');
  mainContent.className = 'main-content';
  
  const authContainer = document.createElement('main');
  authContainer.className = 'auth-container';
  
  // Create the register form
  const registerForm = document.createElement('form');
  registerForm.id = 'registerForm';
  registerForm.className = 'auth-form';
  registerForm.setAttribute('novalidate', '');
  
  // Create display name field
  const displayNameField = createFormField({
    label: 'Display Name',
    id: 'displayName',
    name: 'displayName',
    type: 'text',
    required: true,
    placeholder: '',
    ariaDescribedBy: 'displayName-error',
    maxLength: 50
  });
  
  // Create email field
  const emailField = createFormField({
    label: 'Email Address',
    id: 'email',
    name: 'email',
    type: 'email',
    required: true,
    placeholder: '',
    ariaDescribedBy: 'email-error'
  });
  
  // Create password field
  const passwordField = createFormField({
    label: 'Password',
    id: 'password',
    name: 'password',
    type: 'password',
    required: true,
    placeholder: '',
    ariaDescribedBy: 'password-error password-help',
    maxLength: 100
  });
  
  // Add password help text
  const passwordHelp = document.createElement('div');
  passwordHelp.id = 'password-help';
  passwordHelp.className = 'form-help';
  passwordHelp.textContent = 'At least 8 characters with uppercase, lowercase, number, and special character';
  
  // Create confirm password field
  const confirmPasswordField = createFormField({
    label: 'Confirm Password',
    id: 'confirmPassword',
    name: 'confirmPassword',
    type: 'password',
    required: true,
    placeholder: '',
    ariaDescribedBy: 'confirmPassword-error',
    maxLength: 100
  });
  
  // Create terms and cookies checkboxes container
  const checkboxContainer = document.createElement('div');
  checkboxContainer.className = 'form-group';
  
  // Terms checkbox
  const termsWrapper = document.createElement('div');
  termsWrapper.className = 'form-checkbox';
  
  const termsCheckbox = document.createElement('input');
  termsCheckbox.type = 'checkbox';
  termsCheckbox.id = 'terms';
  termsCheckbox.name = 'terms';
  termsCheckbox.required = true;
  
  const termsLabel = document.createElement('label');
  termsLabel.htmlFor = 'terms';
  termsLabel.innerHTML = 'I agree to the <a href="/terms-of-service.html" target="_blank">Terms of Service</a> and <a href="/privacy-policy.html" target="_blank">Privacy Policy</a>.';
  
  termsWrapper.appendChild(termsCheckbox);
  termsWrapper.appendChild(termsLabel);
  
  const termsError = document.createElement('div');
  termsError.id = 'terms-error';
  termsError.className = 'form-error';
  termsError.setAttribute('role', 'alert');
  
  // Cookies checkbox
  const cookiesWrapper = document.createElement('div');
  cookiesWrapper.className = 'form-checkbox';
  
  const cookiesCheckbox = document.createElement('input');
  cookiesCheckbox.type = 'checkbox';
  cookiesCheckbox.id = 'cookies';
  cookiesCheckbox.name = 'cookies';
  cookiesCheckbox.required = true;
  
  const cookiesLabel = document.createElement('label');
  cookiesLabel.htmlFor = 'cookies';
  cookiesLabel.innerHTML = 'I agree to the <a href="/cookies-policy.html" target="_blank">Cookie Policy</a>.';
  
  cookiesWrapper.appendChild(cookiesCheckbox);
  cookiesWrapper.appendChild(cookiesLabel);
  
  const cookiesError = document.createElement('div');
  cookiesError.id = 'cookies-error';
  cookiesError.className = 'form-error';
  cookiesError.setAttribute('role', 'alert');
  
  // Add checkboxes to container
  checkboxContainer.appendChild(termsWrapper);
  checkboxContainer.appendChild(termsError);
  checkboxContainer.appendChild(cookiesWrapper);
  checkboxContainer.appendChild(cookiesError);
  
  // Create submit button container and help text
  const submitButtonContainer = document.createElement('div');
  submitButtonContainer.id = 'submit-button-container';
  
  const submitHelp = document.createElement('div');
  submitHelp.id = 'submit-help';
  submitHelp.className = 'sr-only';
  submitHelp.textContent = 'This will create your new account';
  
  // Add all elements to the form
  registerForm.appendChild(displayNameField);
  registerForm.appendChild(emailField);
  registerForm.appendChild(passwordField);
  // Insert password help after the password field's error div
  const passwordError = passwordField.querySelector('#password-error');
  if (passwordError && passwordError.parentNode) {
    passwordError.parentNode.insertBefore(passwordHelp, passwordError);
  }
  registerForm.appendChild(confirmPasswordField);
  registerForm.appendChild(checkboxContainer);
  registerForm.appendChild(submitButtonContainer);
  registerForm.appendChild(submitHelp);
  
  // Create and add submit button
  const submitButton = createButton({
    text: 'Create Account',
    variant: 'primary',
    size: 'large',
    type: 'submit',
    ariaDescribedBy: 'submit-help'
  });
  submitButtonContainer.appendChild(submitButton);
  
  // Set autocomplete and additional attributes
  const displayNameInput = displayNameField.querySelector('input');
  const emailInput = emailField.querySelector('input');
  const passwordInput = passwordField.querySelector('input');
  const confirmPasswordInput = confirmPasswordField.querySelector('input');
  
  if (displayNameInput) {
    displayNameInput.setAttribute('autocomplete', 'name');
    displayNameInput.setAttribute('minlength', '2');
  }
  if (emailInput) emailInput.setAttribute('autocomplete', 'email');
  if (passwordInput) {
    passwordInput.setAttribute('autocomplete', 'new-password');
    passwordInput.setAttribute('minlength', '8');
  }
  if (confirmPasswordInput) {
    confirmPasswordInput.setAttribute('autocomplete', 'new-password');
    confirmPasswordInput.setAttribute('minlength', '8');
  }
  
  // Create auth header
  const authHeader = createAuthHeader();
  
  // Create auth footer
  const authFooter = createAuthFooter({
    links: [
      {
        text: "Already have an account?",
        link: {
          href: 'index.html',
          text: 'Sign in',
          id: 'signInLink',
          variant: 'primary'
        }
      }
    ]
  });
  
  // Create the complete auth card
  const authCard = createAuthCard({
    variant: 'register',
    header: authHeader,
    form: registerForm,
    footer: authFooter
  });
  
  // Assemble the page
  authContainer.appendChild(authCard);
  mainContent.appendChild(authContainer);
  appRoot.appendChild(mainContent);

  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js')
  ]);
});