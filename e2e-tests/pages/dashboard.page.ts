import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  // Selectors
  readonly url = '/v2/dashboard';
  readonly userNameText = '.text-sm.font-medium.text-gray-700';
  readonly welcomeHeading = 'h2:has-text("Welcome back")';
  readonly signOutButton = 'Sign out';
  readonly createGroupButton = 'Create Group';
  readonly createFirstGroupButton = 'Create Your First Group';
  readonly groupCard = '[data-testid="group-card"]';
  readonly emptyStateMessage = 'No groups yet';
  readonly yourGroupsHeading = 'Your Groups';
  
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
  
  async signOut() {
    await this.clickButtonWithText(this.signOutButton);
  }
  
  async openCreateGroupModal() {
    const createButton = await this.page.getByRole('button', { name: this.createGroupButton }).isVisible()
      ? this.page.getByRole('button', { name: this.createGroupButton })
      : this.page.getByRole('button', { name: this.createFirstGroupButton });
    
    await createButton.click();
  }
  
  async getGroupCards() {
    return this.page.locator(this.groupCard).all();
  }
  
  async hasEmptyState(): Promise<boolean> {
    return await this.page.getByText(this.emptyStateMessage).isVisible();
  }
  
  async navigateToGroup(groupName: string) {
    await this.page.getByText(groupName).click();
  }
  
  async waitForDashboard() {
    await this.waitForNavigation(/\/dashboard/);
  }

  /**
   * Ensures user is logged in with strict validation
   * Throws if login indicators are not present
   */
  async ensureLoggedIn(): Promise<void> {
    // Wait for and validate login indicators
    const welcomeText = this.page.getByText(/Welcome back/i);
    await welcomeText.waitFor({ state: 'visible', timeout: 500 });
    
    // Additional validation - check for user name display
    const userNameElement = this.page.locator(this.userNameText).first();
    await userNameElement.waitFor({ state: 'visible', timeout: 500 });
    
    // Ensure we're on the dashboard page
    await this.page.waitForURL(/\/dashboard/, { timeout: 1000 });
  }

  /**
   * Opens create group modal with strict validation
   * Throws if modal doesn't open properly
   */
  async openCreateGroupModalStrict(): Promise<void> {
    // Find and click the create group button
    const createButton = await this.page.getByRole('button', { name: this.createGroupButton }).isVisible()
      ? this.page.getByRole('button', { name: this.createGroupButton })
      : this.page.getByRole('button', { name: this.createFirstGroupButton });
    
    await createButton.waitFor({ state: 'visible', timeout: 500 });
    await createButton.click();
    
    // Validate modal opened - wait for modal overlay
    await this.page.waitForSelector('.fixed.inset-0', { state: 'visible', timeout: 500 });
    
    const nameField = this.page.getByLabel('Group Name*');
    
    await nameField.waitFor({ state: 'visible', timeout: 500 });
  }
}