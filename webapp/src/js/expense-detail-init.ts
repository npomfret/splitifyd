import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  
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
  const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
  if (warningBannerConfig?.message) {
    const warningBanner = document.getElementById('warningBanner');
    if (warningBanner) {
      warningBanner.textContent = warningBannerConfig.message;
      warningBanner.classList.remove('hidden');
    }
  }
  
  // Initialize expense detail page
  const { initializeExpenseDetailPage } = await import('./expense-detail.js');
  await initializeExpenseDetailPage();
});