import { PageHeaderComponent } from './components/page-header.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { ButtonComponent } from './components/button.js';
import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Login');
  
  
  const pageHeader = new PageHeaderComponent({
    title: 'Login' // Will be overridden by config if needed
  });
  pageHeader.mount(document.body);

  // Initialize warning banner from config
  const { firebaseConfigManager } = await import('./firebase-config-manager.js');
  try {
    const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
    if (warningBannerConfig?.message) {
      const banner = WarningBannerComponent.createGlobalBanner({
        message: warningBannerConfig.message,
        type: 'warning',
        dismissible: true
      });
      banner.show();
    }
  } catch (error) {
    // Warning banner is optional, continue silently
  }

  const submitButton = new ButtonComponent({
    text: 'Sign In',
    type: 'submit',
    variant: 'primary',
    size: 'large',
    ariaDescribedBy: 'submit-help'
  });
  const buttonContainer = document.getElementById('submit-button-container');
  if (buttonContainer) {
    submitButton.mount(buttonContainer);
  }

  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js')
  ]);
});