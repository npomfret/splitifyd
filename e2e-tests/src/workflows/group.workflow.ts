import { Page, expect } from '@playwright/test';
import { DashboardPage, CreateGroupModalPage } from '../pages';
import { AuthenticationWorkflow } from './authentication.workflow';
import type {User as BaseUser} from "@shared/shared-types";
import { generateTestGroupName } from '../utils/test-helpers';

export interface TestGroup {
  name: string;
  description?: string;
  user: BaseUser;
}

/**
 * Group workflow class that handles group creation and management flows.
 * Encapsulates group-related multi-step processes.
 */
export class GroupWorkflow {
  constructor(private page: Page) {}

  /**
   * Creates a test group with an authenticated user.
   * This replaces the createTestGroupWithUser helper function.
   */
  async createGroupWithUser(
    groupName: string = generateTestGroupName(),
    groupDescription?: string
  ): Promise<TestGroup> {
    // Create and login user first
    const authWorkflow = new AuthenticationWorkflow(this.page);
    const user = await authWorkflow.createAndLoginTestUser();
    
    // Create group using workflow
    await this.createGroupAndNavigate(groupName, groupDescription);
    
    return {
      name: groupName,
      description: groupDescription,
      user
    };
  }

  /**
   * Creates a group for an already authenticated user.
   * Use this when you need to create multiple groups for the same user.
   */
  async createGroup(
    groupName: string = generateTestGroupName(),
    groupDescription?: string
  ): Promise<string> {
    return this.createGroupAndNavigate(groupName, groupDescription);
  }

  /**
   * Creates a group and navigates to it, returning the group ID.
   * This encapsulates the multi-step workflow of group creation.
   */
  async createGroupAndNavigate(name: string, description?: string): Promise<string> {
    const dashboard = new DashboardPage(this.page);
    
    // Check if authentication is still valid before proceeding
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login')) {
      throw new Error(
        `Authentication lost: User was redirected to login page. ` +
        `This indicates session expiration or authentication state loss. ` +
        `Current URL: ${currentUrl}`
      );
    }
    
    // Ensure we're on dashboard and fully loaded
    if (!currentUrl.includes('/dashboard')) {
      await dashboard.navigate();
    }
    await dashboard.waitForDashboard();
    
    // Open modal and create group
    const createGroupModal = new CreateGroupModalPage(this.page);
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup(name, description);
    
    // Wait for navigation and verify URL
    await dashboard.expectUrl(/\/groups\/[a-zA-Z0-9]+$/);

    // Extract and return group ID
    const groupId = dashboard.getUrlParam('groupId')!;
    
    // Verify we're on the correct group page by checking URL contains the pattern
    await expect(this.page).toHaveURL(new RegExp(`/groups/${groupId}$`));

    await expect(this.page.getByText(name)).toBeVisible();

    return groupId;
  }
}