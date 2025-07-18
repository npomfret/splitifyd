import { PricingComponent } from './components/PricingComponent.js';
import { updatePageTitle } from './utils/page-title.js';
import { AppInit } from './app-init.js';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Pricing');
  
  // Mount the pricing component
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    const pricingComponent = new PricingComponent();
    pricingComponent.mount(appRoot);
  }
});