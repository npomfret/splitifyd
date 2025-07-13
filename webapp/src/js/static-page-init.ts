import { firebaseConfigManager } from './firebase-config-manager.js';
import { updatePageTitle } from './utils/page-title.js';

async function updateAppReferences(): Promise<void> {
  try {
    const appDisplayName = await firebaseConfigManager.getAppDisplayName();
    
    // Update logo in header
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.textContent = appDisplayName;
    }
    
    // Update all instances of "app-name-here" in the content
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th');
    textElements.forEach(element => {
      if (element.textContent && element.textContent.includes('app-name-here')) {
        element.innerHTML = element.innerHTML.replace(/app-name-here/g, appDisplayName);
      }
    });
    
  } catch (error) {
    console.warn('Failed to load app configuration for static page', error);
  }
}

// Extract page title from the document title for updatePageTitle
function getPageTitleFromDocument(): string {
  const titleElement = document.querySelector('title');
  if (titleElement) {
    const fullTitle = titleElement.textContent;
    // Extract the part before " - Splitifyd" if present
    const parts = fullTitle!.split(' - ');
    return parts[0];
  }
  return 'Page';
}

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  const pageTitle = getPageTitleFromDocument();
  
  // Update page title from configuration
  await updatePageTitle(pageTitle);
  
  // Update app references with runtime config
  await updateAppReferences();
});