import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';
import { createButton, createFormField } from './ui-builders.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Login');
  
  // Get the form element
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
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
  }
  
  // Initialize warning banner from config
  const { firebaseConfigManager } = await import('./firebase-config-manager.js');
  const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
  if (warningBannerConfig?.message) {
    const warningBanner = document.getElementById('warningBanner');
    if (warningBanner) {
      warningBanner.textContent = warningBannerConfig.message;
      warningBanner.classList.remove('hidden');
    }
  }

  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js')
  ]);
});