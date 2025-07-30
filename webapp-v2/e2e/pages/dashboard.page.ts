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
    return await nameElement.textContent() || '';
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
}