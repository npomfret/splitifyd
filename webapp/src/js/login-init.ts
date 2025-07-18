import { LoginComponent } from './components/LoginComponent.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Login');
  
  // Mount the login component
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const loginComponent = new LoginComponent();
    loginComponent.mount(appRoot);
  }

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

  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js')
  ]);
});