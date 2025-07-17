import { PageHeaderComponent } from './components/page-header.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { LoadingSpinnerComponent } from './components/loading-spinner.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  const pageHeader = new PageHeaderComponent({
    title: 'Dashboard'
  });
  pageHeader.mount(document.body);

  // Wait for stylesheets to load before showing spinner
  const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  const stylesheetPromises = stylesheetLinks
    .filter((link) => !link.sheet)
    .map((link) => new Promise((resolve) => {
      link.addEventListener('load', resolve);
      link.addEventListener('error', resolve); // Resolve even on error to not block
    }));
  
  await Promise.all(stylesheetPromises);

  const loadingSpinner = new LoadingSpinnerComponent({
    message: 'Loading your groups...',
    variant: 'default',
    size: 'medium'
  });
  const spinnerContainer = document.getElementById('loading-spinner-container');
  if (spinnerContainer) {
    loadingSpinner.mount(spinnerContainer);
    loadingSpinner.show();
  }

  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js'),
    import('./expenses.js'),
    import('./groups.js'),
    import('./dashboard.js')
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

  // Import and initialize dashboard after all scripts are loaded
  const { initializeDashboard } = await import('./dashboard.js');
  await initializeDashboard();
  
  if (loadingSpinner) {
    loadingSpinner.hide();
  }
});