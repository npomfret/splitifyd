import { expect } from '@playwright/test';
import { BasePage } from './base.page';
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

  getUserMenuButton() {
    // Use data-testid for stable selection
    return this.page.locator('[data-testid="user-menu-button"]');
  }

  async waitForUserMenu(): Promise<void> {
    // Wait for authentication state to be fully loaded first
    await this.waitForNetworkIdle();
    
    // Ensure we're logged in by checking for either welcome message (new users) or groups heading
    // Since welcome message only shows for users with no groups, check for groups heading as primary indicator
    await expect(this.getGroupsHeading()).toBeVisible();
    
    // Now wait for the user menu button to be available with fast timeout
    await expect(this.getUserMenuButton()).toBeVisible();
  }
  getSignOutButton() {
    // Use data-testid for stable selection
    return this.page.locator('[data-testid="sign-out-button"]');
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
    await this.clickButton(createButton, { buttonName: 'Create Group' });
  }

  async waitForDashboard() {
    // Wait for navigation to dashboard if not already there - handle both /dashboard and /dashboard/
    await this.page.waitForURL(/\/dashboard\/?$/);
    
    // Wait for the dashboard to be fully loaded
    await this.waitForNetworkIdle();
    
    // Wait for the main dashboard content to appear
    await this.page.locator('h3:has-text("Your Groups")').waitFor();
    
    // Wait for loading spinner to disappear (handles race condition where spinner might never appear)
    const loadingSpinner = this.page.locator('span:has-text("Loading your groups")');
    try {
      await loadingSpinner.waitFor({ state: 'hidden', timeout: 1000 });
    } catch {
      // Spinner never appeared or disappeared quickly - expected behavior
    }
    
    // Brief stabilization delay to ensure content has rendered
    await this.page.waitForTimeout(200);
    
    // Dashboard is now ready - we don't check for specific content since users may have existing groups
  }

}