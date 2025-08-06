import { BasePage } from './base.page';
import { CreateGroupModalPage } from './create-group-modal.page';
import { AuthenticationWorkflow } from '../workflows/authentication.workflow';

export class DashboardPage extends BasePage {
  // Selectors
  readonly url = '/v2/dashboard';
  readonly userNameText = '.text-sm.font-medium.text-gray-700';

  async navigate() {
    await this.page.goto(this.url);
    await this.waitForNetworkIdle();
  }
  
  async isLoggedIn(): Promise<boolean> {
    // We KNOW the welcome text exists when logged in
    return await this.page.getByText(/Welcome back/i).isVisible();
  }
  
  async getUserDisplayName(): Promise<string> {
    const nameElement = this.page.locator(this.userNameText).first();
    const textContent = await nameElement.textContent();
    return textContent ?? '';
  }

  // Element accessors
  getWelcomeMessage() {
    return this.page.getByText(/Welcome back/i);
  }

  getGroupsHeading() {
    return this.page.getByRole('heading', { name: /Your Groups|My Groups/i });
  }

  getCreateGroupButton() {
    return this.page.getByRole('button', { name: /Create.*Group/i }).first();
  }

  getUserMenuButton() {
    return this.page.getByRole('button', { name: /Profile|Account|User|Menu|^[A-Z]$/i }).first();
  }

  getSignOutButton() {
    return this.page.getByRole('button', { name: /Sign Out|Logout/i });
  }

  getSignInButton() {
    return this.page.getByRole('button', { name: /Sign In|Login/i });
  }

  async openCreateGroupModal() {
    // Click whichever create button is visible - the UI determines this
    // Both buttons open the same modal, so we can use .first() to get whichever is present
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
    return this.getUrlParam('groupId')!;
  }
}