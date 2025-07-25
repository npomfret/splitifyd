import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  
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
  const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
  if (warningBannerConfig?.message) {
    const warningBanner = document.getElementById('warningBanner');
    if (warningBanner) {
      warningBanner.textContent = warningBannerConfig.message;
      warningBanner.classList.remove('hidden');
    }
  }
  
  // Initialize group detail page
  const { initializeGroupDetailPage } = await import('./group-detail.js');
  await initializeGroupDetailPage();
  
  // Initialize event handlers
  const { initializeGroupDetailHandlers } = await import('./group-detail-handlers.js');
  initializeGroupDetailHandlers();
});