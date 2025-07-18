
/**
 * Updates the document title
 * @param pageTitle - The specific page title (e.g., "Dashboard", "Login")
 */
export function updatePageTitle(pageTitle: string): void {
  document.title = pageTitle;
}

/**
 * Updates DNS prefetch links (currently a no-op since API is on same origin)
 * @returns Promise that resolves immediately
 */
export async function updateDnsPrefetch(): Promise<void> {
  // DNS prefetching is not needed for same-origin requests
  // Keeping this function for backward compatibility
  return Promise.resolve();
}