import { firebaseConfigManager } from './firebase-config-manager.js';
import { updatePageTitle } from './utils/page-title.js';

/**
 * Updates app-name-here placeholders in the page
 */
async function updateAppReferences() {
  try {
    const appDisplayName = await firebaseConfigManager.getAppDisplayName();
    
    // Update auth card title
    const titleElement = document.querySelector('.auth-card__title');
    if (titleElement && titleElement.textContent.includes('app-name-here')) {
      titleElement.textContent = appDisplayName;
    }
  } catch (error) {
    console.warn('Failed to update app references', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Update page title from configuration
  await updatePageTitle('Join Group');
  
  // Update app name references
  await updateAppReferences();
});