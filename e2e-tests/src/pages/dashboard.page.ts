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
    // We KNOW the welcome text exists when logged in
    return await this.page.getByText(MESSAGES.WELCOME_BACK).isVisible();
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
    
    // Ensure we're logged in (this is a reliable check)
    await expect(this.getWelcomeMessage()).toBeVisible();
    
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
    await this.waitForNavigation(/\/dashboard/);
  }

  /**
   * Creates a group and navigates to it, returning the group ID
   */
  async createGroupAndNavigate(name: string, description?: string): Promise<string> {
    // Ensure we're on dashboard
    if (!this.page.url().includes('/dashboard')) {
      await this.navigate();
    }
    
    // Open modal and create group
    const createGroupModal = new CreateGroupModalPage(this.page);
    await this.openCreateGroupModal();
    await createGroupModal.createGroup(name, description);
    
    // Wait for navigation and verify URL
    await this.expectUrl(/\/groups\/[a-zA-Z0-9]+$/);

    // Extract and return group ID
    const groupId = this.getUrlParam('groupId')!;
    
    // Verify we're on the correct group page by checking the exact URL
    await expect(this.page).toHaveURL(`/groups/${groupId}`);

    await expect(this.page.getByText(name)).toBeVisible();

    return groupId;
  }
}