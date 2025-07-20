import { AppInit } from './app-init.js';
import { updatePageTitle } from './utils/page-title.js';
import { createLoadingSpinner } from './ui-builders.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Dashboard');

  // Wait for stylesheets to load
  const stylesheetLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  const stylesheetPromises = stylesheetLinks
    .filter((link) => !link.sheet)
    .map((link) => new Promise((resolve) => {
      link.addEventListener('load', resolve);
      link.addEventListener('error', resolve); // Resolve even on error to not block
    }));
  
  await Promise.all(stylesheetPromises);

  // Show loading message
  const spinnerContainer = document.getElementById('loading-spinner-container');
  if (spinnerContainer) {
    const loadingSpinner = createLoadingSpinner({
      text: 'Loading your groups...'
    });
    spinnerContainer.appendChild(loadingSpinner);
    spinnerContainer.style.display = 'block';
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
  const warningBannerConfig = await firebaseConfigManager.getWarningBanner();
  if (warningBannerConfig?.message) {
    const warningBanner = document.getElementById('warningBanner');
    if (warningBanner) {
      warningBanner.textContent = warningBannerConfig.message;
      warningBanner.classList.remove('hidden');
    }
  }

  // Import and initialize dashboard after all scripts are loaded
  const { initializeDashboard } = await import('./dashboard.js');
  await initializeDashboard();
  
  if (spinnerContainer) {
    spinnerContainer.style.display = 'none';
  }
});