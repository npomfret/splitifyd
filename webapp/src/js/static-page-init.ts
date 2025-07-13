import { updatePageTitle } from './utils/page-title.js';


// Extract page title from the document title for updatePageTitle
function getPageTitleFromDocument(): string {
  const titleElement = document.querySelector('title');
  if (titleElement) {
    return titleElement.textContent || 'Page';
  }
  return 'Page';
}

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
  const pageTitle = getPageTitleFromDocument();
  
  // Update page title from configuration
  await updatePageTitle(pageTitle);
  
});