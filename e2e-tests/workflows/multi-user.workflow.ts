import { Page, expect } from '@playwright/test';
import { AuthenticationWorkflow, TestUser } from './authentication.workflow';
import { GroupDetailPage } from '../pages';
import { createTestGroup } from '../helpers/test-helpers';

export interface MultiUserGroup {
  id: string;
  name: string;
  description?: string;
  users: Array<{ page: Page; user: TestUser }>;
  expenses: Array<{ description: string; amount: number; paidBy: string }>;
  shareLink: string;
}

/**
 * Multi-user workflow class that handles complex multi-user test scenarios.
 * Encapsulates the creation of multiple users, groups, and collaborative operations.
 */
export class MultiUserWorkflow {
  private users: Array<{ page: Page; user: TestUser }> = [];
  private groupId?: string;
  private expenses: Array<{ description: string; amount: number; paidBy: string }> = [];
  private shareLink?: string;

  constructor(private browser: any) {}

  /**
   * Adds a new test user to the workflow.
   * Creates a new browser context and authenticates the user.
   */
  async addUser(): Promise<{ page: Page; user: TestUser }> {
    const context = await this.browser.newContext();
    const page = await context.newPage();
    const user = await AuthenticationWorkflow.createTestUser(page);
    const userInfo = { page, user };
    this.users.push(userInfo);
    return userInfo;
  }

  /**
   * Creates a group using the first user in the workflow.
   * Must call addUser() first to have at least one user.
   */
  async createGroupWithFirstUser(name: string, description?: string): Promise<string> {
    if (this.users.length === 0) {
      throw new Error('Must add at least one user before creating group');
    }

    const { page } = this.users[0];
    this.groupId = await createTestGroup(page, name, description);
    return this.groupId;
  }

  /**
   * Adds all users (except the first) to the group via share link.
   * Must call createGroupWithFirstUser() first.
   */
  async addUsersToGroup(): Promise<string> {
    if (!this.groupId) {
      throw new Error('Must create group first');
    }

    const { page: creatorPage } = this.users[0];

    // Get share link
    await creatorPage.getByRole('button', { name: /share/i }).click();
    const shareLinkInput = creatorPage.getByRole('dialog').getByRole('textbox');
    this.shareLink = await shareLinkInput.inputValue();
    await creatorPage.keyboard.press('Escape');

    // Have other users join via share link
    for (let i = 1; i < this.users.length; i++) {
      const { page } = this.users[i];
      await page.goto(this.shareLink);

      // Wait for the join page to load
      await expect(page.getByRole('heading', { name: 'Join Group' })).toBeVisible();

      // Click the Join Group button
      await page.getByRole('button', { name: 'Join Group' }).click();

      // Wait for redirect to group page
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
    }

    return this.shareLink;
  }

  /**
   * Adds an expense using a specific user (by index).
   * Must call createGroupWithFirstUser() first.
   */
  async addExpense(description: string, amount: number, userIndex: number = 0): Promise<void> {
    if (!this.groupId) {
      throw new Error('Must create group first');
    }

    if (userIndex >= this.users.length) {
      throw new Error(`User index ${userIndex} is out of range. Available users: ${this.users.length}`);
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

  /**
   * Gets all users in the workflow.
   */
  getUsers(): Array<{ page: Page; user: TestUser }> {
    return this.users;
  }

  /**
   * Gets the group ID if a group has been created.
   */
  getGroupId(): string | undefined {
    return this.groupId;
  }

  /**
   * Gets all expenses added through this workflow.
   */
  getExpenses(): Array<{ description: string; amount: number; paidBy: string }> {
    return this.expenses;
  }

  /**
   * Gets the share link if users have been added to the group.
   */
  getShareLink(): string | undefined {
    return this.shareLink;
  }

  /**
   * Cleans up all browser contexts created by this workflow.
   * Should be called in a finally block to ensure cleanup.
   */
  async cleanup(): Promise<void> {
    for (const { page } of this.users) {
      await page.context().close();
    }
  }

  /**
   * Static factory method for creating a complete multi-user group scenario.
   * This is a convenience method for the most common use case.
   */
  static async createMultiUserGroup(
    browser: any,
    userCount: number = 3,
    groupName: string = 'Multi-User Test Group',
    groupDescription?: string
  ): Promise<MultiUserGroup> {
    const workflow = new MultiUserWorkflow(browser);

    // Add users
    const users: Array<{ page: Page; user: TestUser }> = [];
    for (let i = 0; i < userCount; i++) {
      const userInfo = await workflow.addUser();
      users.push(userInfo);
    }

    // Create group with first user
    const groupId = await workflow.createGroupWithFirstUser(groupName, groupDescription);

    // Add other users to group
    const shareLink = await workflow.addUsersToGroup();

    return {
      id: groupId,
      name: groupName,
      description: groupDescription,
      users,
      expenses: [],
      shareLink
    };
  }
}