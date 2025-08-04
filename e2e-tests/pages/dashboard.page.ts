import { BasePage } from './base.page';
import { CreateGroupModalPage } from './create-group-modal.page';

export class DashboardPage extends BasePage {
  // Selectors
  readonly url = '/v2/dashboard';
  readonly userNameText = '.text-sm.font-medium.text-gray-700';
  readonly createGroupButton = 'Create Group';
  readonly createFirstGroupButton = 'Create Your First Group';

  async navigate() {
    await this.page.goto(this.url);
    await this.waitForNetworkIdle();
  }
  
  async isLoggedIn(): Promise<boolean> {
    return await this.page.getByText(/Welcome back/i).isVisible();
  }
  
  async getUserDisplayName(): Promise<string> {
    const nameElement = this.page.locator(this.userNameText).first();
    const textContent = await nameElement.textContent();
    return textContent ?? '';
  }

  async openCreateGroupModal() {
    const createButton = await this.page.getByRole('button', { name: this.createGroupButton }).isVisible()
      ? this.page.getByRole('button', { name: this.createGroupButton })
      : this.page.getByRole('button', { name: this.createFirstGroupButton });
    
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
    return this.getUrlParam('groupId') || '';
  }
}