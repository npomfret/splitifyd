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
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Login');
  
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
  
  // Create the login form
  const loginForm = document.createElement('form');
  loginForm.id = 'loginForm';
  loginForm.className = 'auth-form';
  loginForm.setAttribute('novalidate', '');
  
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
    ariaDescribedBy: 'password-error'
  });
  
  // Create submit button container and help text
  const submitButtonContainer = document.createElement('div');
  submitButtonContainer.id = 'submit-button-container';
  
  const submitHelp = document.createElement('div');
  submitHelp.id = 'submit-help';
  submitHelp.className = 'sr-only';
  submitHelp.textContent = 'This will sign you into your account';
  
  // Add all elements to the form
  loginForm.appendChild(emailField);
  loginForm.appendChild(passwordField);
  loginForm.appendChild(submitButtonContainer);
  loginForm.appendChild(submitHelp);
  
  // Create and add submit button
  const submitButton = createButton({
    text: 'Sign In',
    variant: 'primary',
    size: 'large',
    type: 'submit',
    ariaDescribedBy: 'submit-help'
  });
  submitButtonContainer.appendChild(submitButton);
  
  // Set autocomplete attributes
  const emailInput = emailField.querySelector('input');
  const passwordInput = passwordField.querySelector('input');
  if (emailInput) emailInput.setAttribute('autocomplete', 'email');
  if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
  
  // Create auth header
  const authHeader = createAuthHeader();
  
  // Create auth footer
  const authFooter = createAuthFooter({
    links: [
      {
        link: {
          href: 'reset-password.html',
          text: 'Forgot password?',
          id: 'forgotPassword'
        }
      },
      {
        text: "Don't have an account?",
        link: {
          href: 'register.html',
          text: 'Sign up',
          id: 'signUpLink',
          variant: 'primary'
        }
      }
    ]
  });
  
  // Create the complete auth card
  const authCard = createAuthCard({
    variant: 'login',
    header: authHeader,
    form: loginForm,
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