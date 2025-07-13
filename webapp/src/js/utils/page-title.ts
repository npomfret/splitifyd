
/**
 * Updates the document title
 * @param pageTitle - The specific page title (e.g., "Dashboard", "Login")
 */
export function updatePageTitle(pageTitle: string): void {
  document.title = `${pageTitle} - Split App 2`;
}

/**
 * Updates page header title
 * @param element - The page header element to update
 * @param pageTitle - The specific page title (optional, will use app name if not provided)
 */
export function updatePageHeader(element: HTMLElement, pageTitle?: string): void {
  const title = pageTitle ? `Split App 2 - ${pageTitle}` : 'Split App 2';
  element.textContent = title;
}

import { firebaseConfigManager } from '../firebase-config-manager.js';

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