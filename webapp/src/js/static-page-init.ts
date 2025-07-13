import { updatePageTitle } from './utils/page-title.js';


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
  
});