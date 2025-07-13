import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';


document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Update page title from configuration
  await updatePageTitle('Group Details');
  
  // Update DNS prefetch links from configuration
  await updateDnsPrefetch();
  
});