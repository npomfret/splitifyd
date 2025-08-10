import { Page, expect } from '@playwright/test';
import { AuthenticationWorkflow } from './authentication.workflow';
import { GroupWorkflow } from './group.workflow';
import { GroupDetailPage, DashboardPage } from '../pages';
import { TIMEOUT_CONTEXTS } from '../config/timeouts';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";

/**
 * Multi-user workflow class that handles complex multi-user test scenarios.
 * Encapsulates the creation of multiple users, groups, and collaborative operations.
 */
export class MultiUserWorkflow {
  private users: Array<{ page: Page; user: BaseUser }> = [];
  private groupId?: string;
  private expenses: Array<{ description: string; amount: number; paidBy: string }> = [];
  private shareLink?: string;

  constructor(private browser: any) {}

  /**
   * Adds a new test user to the workflow.
   * Creates a new browser context and authenticates the user.
   */
  async addUser(): Promise<{ page: Page; user: BaseUser }> {
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
    const groupWorkflow = new GroupWorkflow(page);
    this.groupId = await groupWorkflow.createGroupAndNavigate(name, description);
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
      await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
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
  getUsers(): Array<{ page: Page; user: BaseUser }> {
    return this.users;
  }

  /**
   * Gets all expenses added through this workflow.
   */
  getExpenses(): Array<{ description: string; amount: number; paidBy: string }> {
    return this.expenses;
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
}
