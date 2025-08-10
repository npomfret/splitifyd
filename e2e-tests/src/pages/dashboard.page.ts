import { expect } from '@playwright/test';
import { BasePage } from './base.page';
import { CreateGroupModalPage } from './create-group-modal.page';
import { MESSAGES, BUTTON_TEXTS, HEADINGS, ARIA_ROLES } from '../constants/selectors';

export class DashboardPage extends BasePage {
  // Selectors
  readonly url = '/dashboard';
  readonly userNameText = '.text-sm.font-medium.text-gray-700';

  async navigate() {
    await this.page.goto(this.url);
    await this.waitForNetworkIdle();
  }
  
  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for "Your Groups" heading - always present when logged in
      const groupsHeading = await this.getGroupsHeading().isVisible({ timeout: 2000 }).catch(() => false);
      if (groupsHeading) return true;
      
      // Fallback: welcome message for users with no groups
      const welcomeMessage = await this.getWelcomeMessage().isVisible({ timeout: 1000 }).catch(() => false);
      return welcomeMessage;
    } catch {
      return false;
    }
  }
  
  async getUserDisplayName(): Promise<string> {
    const nameElement = this.page.locator(this.userNameText).first();
    const textContent = await nameElement.textContent();
    return textContent ?? '';
  }

  // Element accessors
  getWelcomeMessage() {
    return this.page.getByText(MESSAGES.WELCOME_BACK);
  }

  getGroupsHeading() {
    return this.page.getByRole(ARIA_ROLES.HEADING, { name: HEADINGS.YOUR_GROUPS });
  }

  getCreateGroupButton() {
    return this.page.getByRole('button', { name: /Create.*Group/i }).first();
  }

  getUserMenuButton(displayName?: string) {
    // If displayName is provided, use it directly for precise matching
    if (displayName) {
      return this.page.getByRole('button', { name: displayName });
    }
    // Fallback to finding any button with Pool prefix (for backward compatibility)
    return this.page.getByRole('button').filter({ hasText: /^Pool \w{8}$/ }).first();
  }

  async waitForUserMenu(displayName?: string): Promise<void> {
    // Wait for authentication state to be fully loaded first
    await this.waitForNetworkIdle();
    
    // Ensure we're logged in by checking for either welcome message (new users) or groups heading
    // Since welcome message only shows for users with no groups, check for groups heading as primary indicator
    await expect(this.getGroupsHeading()).toBeVisible();
    
    // Now wait for the user menu button to be available with fast timeout
    await expect(this.getUserMenuButton(displayName)).toBeVisible();
  }
  getSignOutButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SIGN_OUT });
  }

  getSignInButton() {
    return this.page.getByRole(ARIA_ROLES.BUTTON, { name: BUTTON_TEXTS.SIGN_IN });
  }

  async openCreateGroupModal() {
    // Simply click the first visible create group button
    const createButton = this.page
      .getByRole('button')
      .filter({ hasText: /Create.*Group/i })
      .first();
    await createButton.click();
  }

  async waitForDashboard() {
    // Wait for navigation to dashboard if not already there - handle both /dashboard and /dashboard/
    await this.page.waitForURL(/\/dashboard\/?$/, { timeout: 5000 });
    
    // Wait for the dashboard to be fully loaded
    await this.waitForNetworkIdle();
    
    // Wait for the main dashboard content to appear
    await this.page.locator('h3:has-text("Your Groups")').waitFor();
    
    // Wait for groups loading to complete by ensuring loading spinner disappears
    // The loading spinner has text "Loading your groups..."
    const loadingSpinner = this.page.locator('span:has-text("Loading your groups")');
    if (await loadingSpinner.isVisible().catch(() => false)) {
      await loadingSpinner.waitFor({ state: 'hidden' });
    }
    
    // Ensure dashboard content is stabilized - wait for either groups grid or empty state
    // Use more specific selectors to avoid conflicts with footer grid
    const groupsGrid = this.page.locator('.grid.grid-cols-1.md\\:grid-cols-2.xl\\:grid-cols-3.gap-4');
    const emptyStateHeading = this.page.locator('h4:has-text("No groups yet")');
    
    // Wait for one of these to be visible (groups exist or empty state)
    await Promise.race([
      groupsGrid.waitFor({ state: 'visible' }),
      emptyStateHeading.waitFor({ state: 'visible' })
    ]);
  }

}