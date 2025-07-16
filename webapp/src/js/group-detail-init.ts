import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';
import { AppInit } from './app-init.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Set up API base URL before auth.js loads
  AppInit.setupApiBaseUrl();
  
  // Update page title from configuration
  await updatePageTitle('Group Details');
  
  // Update DNS prefetch links from configuration
  await updateDnsPrefetch();
  
});