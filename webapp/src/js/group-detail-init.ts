import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';
import { AppInit } from './app-init.js';
import { WarningBannerComponent } from './components/warning-banner.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Group Details');
  
  // Update DNS prefetch links from configuration
  await updateDnsPrefetch();
  
  // Load all required modules in parallel
  await Promise.all([
    import('./firebase-init.js'),
    import('./firebase-config-manager.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js'),
    import('./group-detail.js'),
    import('./group-detail-handlers.js')
  ]);
  
  // Initialize warning banner
  const { firebaseConfigManager } = await import('./firebase-config-manager.js');
  try {
    const warningBanner = await firebaseConfigManager.getWarningBanner();
    if (warningBanner?.message) {
      const banner = WarningBannerComponent.createGlobalBanner({
        message: warningBanner.message,
        type: 'warning',
        dismissible: true
      });
      banner.show();
    }
  } catch (error) {
    // Warning banner is optional, continue silently
  }
  
  // Initialize group detail page
  const { initializeGroupDetailPage } = await import('./group-detail.js');
  await initializeGroupDetailPage();
});