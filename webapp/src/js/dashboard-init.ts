import { DashboardComponent } from './components/DashboardComponent.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { AppInit } from './app-init.js';
import { updatePageTitle } from './utils/page-title.js';

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

  // Load required modules before mounting component
  await Promise.all([
    import('./firebase-init.js'),
    import('./api.js'),
    import('./auth.js'),
    import('./logout-handler.js'),
    import('./expenses.js'),
    import('./groups.js')
  ]);

  // Mount the dashboard component
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const dashboardComponent = new DashboardComponent();
    dashboardComponent.mount(appRoot);
  }
  
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
});