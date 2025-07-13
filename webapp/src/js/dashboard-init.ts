import { PageHeaderComponent } from './components/page-header.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { LoadingSpinnerComponent } from './components/loading-spinner.js';
import { ScriptLoaderComponent } from './components/script-loader.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  const pageHeader = new PageHeaderComponent({
    title: 'Dashboard'
  });
  pageHeader.mount(document.body);

  const warningBanner = new WarningBannerComponent({
    message: 'System maintenance in progress',
    type: 'warning'
  });
  const existingBanner = document.getElementById('warningBanner');
  if (existingBanner) {
    existingBanner.remove();
  }
  warningBanner.mount(document.body);
  warningBanner.hide();

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

  const scriptLoader = ScriptLoaderComponent.createDashboardLoader();
  await scriptLoader.loadScripts();
  
  // Import and initialize dashboard after all scripts are loaded
  const { initializeDashboard } = await import('./dashboard.js');
  await initializeDashboard();
  
  if (loadingSpinner) {
    loadingSpinner.hide();
  }
});