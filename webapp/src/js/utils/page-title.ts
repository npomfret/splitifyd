import { firebaseConfigManager } from '../firebase-config-manager.js';

/**
 * Updates the document title using the app display name from configuration
 * @param pageTitle - The specific page title (e.g., "Dashboard", "Login")
 * @returns Promise that resolves when the title is updated
 */
export async function updatePageTitle(pageTitle: string): Promise<void> {
  try {
    const appDisplayName = await firebaseConfigManager.getAppDisplayName();
    document.title = `${pageTitle} - ${appDisplayName}`;
  } catch (error) {
    console.error('Failed to load app display name from config', error);
    // Fallback to a simple title without app name
    document.title = pageTitle;
  }
}

/**
 * Updates page header title using the app display name from configuration
 * @param element - The page header element to update
 * @param pageTitle - The specific page title (optional, will use app name if not provided)
 * @returns Promise that resolves when the header is updated
 */
export async function updatePageHeader(element: HTMLElement, pageTitle?: string): Promise<void> {
  try {
    const appDisplayName = await firebaseConfigManager.getAppDisplayName();
    const title = pageTitle ? `${appDisplayName} - ${pageTitle}` : appDisplayName;
    element.textContent = title;
  } catch (error) {
    console.error('Failed to load app display name from config', error);
    // Fallback to page title only or default text
    element.textContent = pageTitle || 'Application';
  }
}

/**
 * Updates DNS prefetch links to use the configured API base URL
 * @returns Promise that resolves when DNS prefetch links are updated
 */
export async function updateDnsPrefetch(): Promise<void> {
  try {
    const config = await firebaseConfigManager.getConfig();
    const apiUrl = new URL(config.api.baseUrl);
    const apiHost = `//${apiUrl.host}`;
    
    // Find all DNS prefetch links
    const dnsPrefetchLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="dns-prefetch"]');
    
    dnsPrefetchLinks.forEach(link => {
      // Only update links that point to placeholder API domains
      if (link.href.includes('api.example.com')) {
        link.href = apiHost;
      }
    });
  } catch (error) {
    // If config fails to load, leave the existing DNS prefetch links unchanged
    console.warn('Failed to update DNS prefetch links from config', error);
  }
}