import { Page } from '@playwright/test';
import { CreateGroupModalPage, DashboardPage } from '../pages';

/**
 * Creates a test group via the UI and returns the group ID
 */
export async function createTestGroup(
  page: Page, 
  groupName: string, 
  description?: string
): Promise<string> {
  const dashboardPage = new DashboardPage(page);
  const createGroupModal = new CreateGroupModalPage(page);
  
  // Navigate to dashboard if not already there
  if (!page.url().includes('/dashboard')) {
    await dashboardPage.navigate();
  }
  
  // Click create group button (use first to handle multiple buttons)
  await page.getByRole('button', { name: /create.*group/i }).first().click();
  
  // Fill in group details
  await createGroupModal.createGroup(groupName, description);
  
  // Wait for navigation to group detail page
  await page.waitForURL(/\/groups\/[^/]+$/);
  
  // Extract group ID from URL
  const url = page.url();
  const groupId = url.substring(url.lastIndexOf('/') + 1);
  
  return groupId;
}


