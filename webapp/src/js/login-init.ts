import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';
import { createButton } from './ui-builders.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Login');
  
  
  // Create submit button
  const submitButtonContainer = document.getElementById('submit-button-container');
  if (submitButtonContainer) {
    const submitButton = createButton({
      text: 'Sign In',
      variant: 'primary',
      size: 'large',
      type: 'submit',
      ariaDescribedBy: 'submit-help'
    });
    submitButtonContainer.appendChild(submitButton);
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