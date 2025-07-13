import { firebaseConfigManager } from './firebase-config-manager.js';
import { updatePageTitle, updateDnsPrefetch } from './utils/page-title.js';

/**
 * Updates app-name-here placeholders in the page
 */
async function updateAppReferences(): Promise<void> {
  try {
    const appDisplayName = await firebaseConfigManager.getAppDisplayName();
    
    // Update header title link
    const titleLink = document.querySelector('.dashboard-title-link');
    if (titleLink && titleLink.textContent && titleLink.textContent.includes('app-name-here')) {
      titleLink.textContent = appDisplayName;
    }
  } catch (error) {
    console.warn('Failed to update app references', error);
  }
}

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  // Update page title from configuration
  await updatePageTitle('Group Details');
  
  // Update DNS prefetch links from configuration
  await updateDnsPrefetch();
  
  // Update app name references
  await updateAppReferences();
});