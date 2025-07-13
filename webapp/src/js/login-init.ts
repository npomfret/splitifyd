import { PageHeaderComponent } from './components/page-header.js';
import { WarningBannerComponent } from './components/warning-banner.js';
import { ButtonComponent } from './components/button.js';
import { ScriptLoaderComponent } from './components/script-loader.js';
import { updatePageTitle } from './utils/page-title.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Update page title from configuration
  await updatePageTitle('Login');
  
  
  const pageHeader = new PageHeaderComponent({
    title: 'Login' // Will be overridden by config if needed
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
    text: 'Sign In',
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