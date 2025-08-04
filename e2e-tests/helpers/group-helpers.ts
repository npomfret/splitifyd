import { Page, expect } from '@playwright/test';
import { CreateGroupModalPage, DashboardPage } from '../pages';

/**
 * Creates a group and navigates to it, returning the group ID
 * Replaces the duplicated pattern found in 11+ test files
 */
export async function createGroupAndNavigate(
  page: Page,
  name: string,
  description?: string
): Promise<string> {
  const dashboard = new DashboardPage(page);
  const createGroupModal = new CreateGroupModalPage(page);
  
  // Ensure we're on dashboard
  if (!page.url().includes('/dashboard')) {
    await dashboard.navigate();
  }
  
  await dashboard.openCreateGroupModal();
  await createGroupModal.createGroup(name, description);
  
  // Wait for navigation and verify URL
  await expectGroupUrl(page);
  
  return getGroupIdFromUrl(page);
}

/**
 * Navigates to a specific group by ID
 */
export async function navigateToGroup(page: Page, groupId: string): Promise<void> {
  const currentUrl = page.url();
  const targetUrl = `/groups/${groupId}`;
  
  if (!currentUrl.includes(targetUrl)) {
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Expects the page to be on a group detail URL
 * Replaces the pattern: await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
 */
export async function expectGroupUrl(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+$/);
}

/**
 * Extracts group ID from the current URL
 * Assumes URL format: /groups/{groupId}
 */
export function getGroupIdFromUrl(page: Page): string {
  const url = page.url();
  const match = url.match(/\/groups\/([a-zA-Z0-9]+)$/);
  
  if (!match) {
    throw new Error(`Could not extract group ID from URL: ${url}`);
  }
  
  return match[1];
}

/**
 * Waits for group page to be fully loaded
 */
export async function waitForGroupPageLoad(page: Page): Promise<void> {
  // Wait for URL to be correct
  await expectGroupUrl(page);
  
  // Wait for network to settle
  await page.waitForLoadState('networkidle');
  
  // Wait for key elements that indicate page is loaded
  await Promise.all([
    page.waitForSelector('h1, h2', { state: 'visible' }), // Group name heading
    page.waitForSelector('button:has-text("Add Expense")', { state: 'visible' }) // Add expense button
  ]);
}

/**
 * Gets the share link for a group
 */
export async function getGroupShareLink(page: Page): Promise<string> {
  // Click share button
  await page.getByRole('button', { name: /share/i }).click();
  
  // Get share link from dialog
  const shareLinkInput = page.getByRole('dialog').getByRole('textbox');
  await shareLinkInput.waitFor({ state: 'visible' });
  const shareLink = await shareLinkInput.inputValue();
  
  // Close dialog
  await page.keyboard.press('Escape');
  
  return shareLink;
}

/**
 * Joins a group using a share link
 */
export async function joinGroupViaShareLink(page: Page, shareLink: string): Promise<void> {
  await page.goto(shareLink);
  
  // Wait for join page
  await expect(page.getByRole('heading', { name: 'Join Group' })).toBeVisible();
  
  // Click join button
  await page.getByRole('button', { name: 'Join Group' }).click();
  
  // Wait for redirect to group page
  await expectGroupUrl(page);
}

/**
 * Verifies a user is visible as a group member
 */
export async function expectUserInGroup(page: Page, userName: string): Promise<void> {
  // Look for user in the members section (avoid duplicate text matches)
  const memberSection = page.getByRole('main');
  await expect(memberSection.getByText(userName).first()).toBeVisible();
}

/**
 * Gets all visible group members
 */
export async function getGroupMembers(page: Page): Promise<string[]> {
  // This would need to be adjusted based on actual UI structure
  const memberElements = await page.locator('[data-testid^="member-"], .member-item').all();
  const members: string[] = [];
  
  for (const element of memberElements) {
    const text = await element.textContent();
    if (text) {
      members.push(text.trim());
    }
  }
  
  return members;
}