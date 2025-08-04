import { Page, expect } from '@playwright/test';
import { CreateGroupModalPage, GroupDetailPage, DashboardPage } from '../pages';
import { createAndLoginTestUser, TestUser } from './auth-utils';

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

/**
 * Builder pattern for complex multi-user test scenarios
 */
export class MultiUserTestBuilder {
  private users: Array<{ page: Page; user: TestUser }> = [];
  private groupId?: string;
  private expenses: Array<{ description: string; amount: number; paidBy: string }> = [];
  
  constructor(private browser: any) {}
  
  async addUser(): Promise<{ page: Page; user: TestUser }> {
    const context = await this.browser.newContext();
    const page = await context.newPage();
    const user = await createAndLoginTestUser(page);
    const userInfo = { page, user };
    this.users.push(userInfo);
    return userInfo;
  }
  
  async createGroupWithFirstUser(name: string, description?: string): Promise<string> {
    if (this.users.length === 0) {
      throw new Error('Must add at least one user before creating group');
    }
    
    const { page } = this.users[0];
    this.groupId = await createTestGroup(page, name, description);
    return this.groupId;
  }
  
  async addUsersToGroup(): Promise<string> {
    if (!this.groupId) {
      throw new Error('Must create group first');
    }
    
    const { page: creatorPage } = this.users[0];
    
    // Get share link
    await creatorPage.getByRole('button', { name: /share/i }).click();
    const shareLinkInput = creatorPage.getByRole('dialog').getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await creatorPage.keyboard.press('Escape');
    
    // Have other users join via share link
    for (let i = 1; i < this.users.length; i++) {
      const { page } = this.users[i];
      await page.goto(shareLink);
      
      // Wait for the join page to load
      await expect(page.getByRole('heading', { name: 'Join Group' })).toBeVisible();
      
      // Click the Join Group button
      await page.getByRole('button', { name: 'Join Group' }).click();
      
      // Wait for redirect to group page
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
    }
    
    return shareLink;
  }
  
  async addExpense(description: string, amount: number, userIndex: number = 0): Promise<void> {
    if (!this.groupId) {
      throw new Error('Must create group first');
    }
    
    const { page, user } = this.users[userIndex];
    const groupDetailPage = new GroupDetailPage(page);
    
    await groupDetailPage.addExpense({
      description,
      amount,
      paidBy: user.displayName,
      splitType: 'equal'
    });
    
    this.expenses.push({ description, amount, paidBy: user.displayName });
  }
  
  getUsers() {
    return this.users;
  }
  
  getGroupId() {
    return this.groupId;
  }
  
  getExpenses() {
    return this.expenses;
  }
  
  async cleanup() {
    for (const { page } of this.users) {
      await page.context().close();
    }
  }
}

