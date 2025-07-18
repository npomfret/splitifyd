import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Expense Detail');
  
  // Update DNS prefetch links from configuration
  await updateDnsPrefetch();
  
  // Load all required modules in parallel
  await Promise.all([
    import('./firebase-init.js'),
    import('./firebase-config-manager.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js'),
    import('./expenses.js'),
    import('./expense-detail.js')
  ]);
  
  // Initialize warning banner
  const { firebaseConfigManager } = await import('./firebase-config-manager.js');
  try {
    const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
    if (warningBannerConfig?.message) {
      const warningBanner = document.getElementById('warningBanner');
      if (warningBanner) {
        warningBanner.textContent = warningBannerConfig.message;
        warningBanner.classList.remove('hidden');
      }
    }
  } catch (error) {
    // Warning banner is optional, continue silently
  }
  
  // Initialize expense detail page
  const { initializeExpenseDetailPage } = await import('./expense-detail.js');
  await initializeExpenseDetailPage();
});