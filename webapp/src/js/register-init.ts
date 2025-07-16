import { PageHeaderComponent } from './components/page-header.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { ButtonComponent } from './components/button.js';
import { ScriptLoaderComponent } from './components/script-loader.js';
import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before loading auth scripts
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Register');
  
  
  const pageHeader = new PageHeaderComponent({
    title: 'Register' // Will be overridden by updatePageTitle
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

  const submitButton = new ButtonComponent({
    text: 'Create Account',
    type: 'submit',
    variant: 'primary',
    size: 'large',
    ariaDescribedBy: 'submit-help'
  });
  const buttonContainer = document.getElementById('submit-button-container');
  if (buttonContainer) {
    submitButton.mount(buttonContainer);
  }

  const scriptLoader = ScriptLoaderComponent.createAuthPageLoader();
  await scriptLoader.loadScripts();
});