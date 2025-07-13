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
    // Fallback to hardcoded value if config fails to load
    console.warn('Failed to load app display name from config, using fallback', error);
    document.title = `${pageTitle} - Splitifyd`;
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
    // Fallback to hardcoded value if config fails to load
    console.warn('Failed to load app display name from config, using fallback', error);
    const title = pageTitle ? `Splitifyd - ${pageTitle}` : 'Splitifyd';
    element.textContent = title;
  }
}