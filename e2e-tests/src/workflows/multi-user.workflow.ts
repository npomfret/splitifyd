import { Page, expect } from '@playwright/test';
import { AuthenticationWorkflow } from './authentication.workflow';
import { GroupWorkflow } from './group.workflow';
import { GroupDetailPage, DashboardPage, JoinGroupPage, LoginPage } from '../pages';
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

    // Get share link using more reliable method
    this.shareLink = await this.getShareLink(creatorPage);

    // Have other users join via share link
    for (let i = 1; i < this.users.length; i++) {
      const { page, user } = this.users[i];
      await this.joinGroupViaShareLink(page, this.shareLink, user);
    }

    return this.shareLink;
  }

  /**
   * Reliably gets the share link from the group page.
   * Uses the optimized GroupDetailPage method with fast timeouts.
   */
  async getShareLink(page: Page): Promise<string> {
    const groupDetailPage = new GroupDetailPage(page);
    return await groupDetailPage.getShareLinkReliably();
  }

  /**
   * Joins a group via share link with comprehensive error handling.
   * Handles different authentication states automatically.
   */
  async joinGroupViaShareLink(page: Page, shareLink: string, user?: BaseUser): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    try {
      // Attempt join with state detection
      const result = await joinGroupPage.attemptJoinWithStateDetection(shareLink);
      
      if (result.success) {
        // Wait for group page to load completely
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
        await page.waitForLoadState('networkidle');
        return;
      }

      // Handle different failure scenarios
      if (result.needsLogin) {
        throw new Error(`User needs to log in first. Use joinGroupViaShareLinkWithLogin() instead.`);
      }

      if (result.alreadyMember) {
        // User is already a member - this might be expected in some tests
        console.warn(`User ${user?.displayName || 'unknown'} is already a member of the group`);
        return;
      }

      if (result.error) {
        throw new Error(`Failed to join group: ${result.reason}`);
      }

      throw new Error(`Unexpected join result: ${result.reason}`);

    } catch (error) {
      // Take debug screenshot
      await joinGroupPage.takeDebugScreenshot(`failed-join-${user?.displayName || 'user'}`);
      
      // Get detailed page state for debugging
      const pageState = await joinGroupPage.getPageState();
      
      throw new Error(`Failed to join group via share link: ${error}. Page state: ${JSON.stringify(pageState, null, 2)}`);
    }
  }

  /**
   * Joins a group via share link when user is not logged in.
   * Handles login flow first, then joins the group.
   */
  async joinGroupViaShareLinkWithLogin(page: Page, shareLink: string, user: BaseUser): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    // Navigate to share link first
    await joinGroupPage.navigateToShareLink(shareLink);
    
    // Check if login is needed
    const isLoggedIn = await joinGroupPage.isUserLoggedIn();
    
    if (!isLoggedIn) {
      // Login first
      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      
      const password = 'TestPassword123!'; // Standard test password
      await loginPage.login(user.email, password);
      
      // Wait for login to complete
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.waitForDashboard();
      
      // Navigate back to share link
      await joinGroupPage.navigateToShareLink(shareLink);
    }
    
    // Now attempt to join
    await joinGroupPage.joinGroup();
    
    // Wait for redirect to group page
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
    await page.waitForLoadState('networkidle');
  }

  /**
   * Tests share link with user who is already a member.
   * Verifies user is redirected to the group page.
   */
  async testShareLinkAlreadyMember(page: Page, shareLink: string): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    // Navigate to share link
    await joinGroupPage.navigateToShareLink(shareLink);
    
    // Should redirect to group page since user is already a member
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 5000 });
    
    // Verify we're on the group page (not the join page)
    const isOnGroupPage = page.url().includes('/groups/') && !page.url().includes('/join');
    if (!isOnGroupPage) {
      throw new Error(`Expected redirect to group page for already-member, but stayed on: ${page.url()}`);
    }
  }

  /**
   * Tests an invalid share link.
   * Verifies appropriate error is shown.
   */
  async testInvalidShareLink(page: Page, invalidShareLink: string): Promise<void> {
    const joinGroupPage = new JoinGroupPage(page);
    
    // Navigate to invalid share link
    await joinGroupPage.navigateToShareLink(invalidShareLink);
    
    // Should show error page
    const isErrorPage = await joinGroupPage.isErrorPage();
    if (!isErrorPage) {
      const pageState = await joinGroupPage.getPageState();
      throw new Error(`Expected error page but didn't find it. Page state: ${JSON.stringify(pageState, null, 2)}`);
    }
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
