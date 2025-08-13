import { Page, expect } from '@playwright/test';
import { DashboardPage, CreateGroupModalPage } from '../pages';
import type {User as BaseUser} from "@shared/shared-types";
import { generateTestGroupName } from '../utils/test-helpers';

/**
 * Group workflow class that handles group creation and management flows.
 * Encapsulates group-related multi-step processes.
 */
export class GroupWorkflow {
  constructor(private page: Page) {}

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
   * Creates a group and navigates to it with comprehensive assertions at every step
   */
  async createGroupAndNavigate(name: string, description?: string): Promise<string> {
    const context = `createGroupAndNavigate(${name})`;
    
    // Assert 1: Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error(`${context}: Group name is required and cannot be empty`);
    }
    console.log(`${context}: ✓ Input validation passed - name: "${name}", description: "${description || 'none'}"`);
    
    // Assert 2: Check authentication state
    const currentUrl = this.page.url();
    console.log(`${context}: Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      throw new Error(`${context}: Authentication lost - redirected to login page: ${currentUrl}`);
    }
    console.log(`${context}: ✓ Authentication state verified`);
    
    // Assert 3: Navigate to dashboard if needed
    const dashboard = new DashboardPage(this.page);
    
    if (!currentUrl.includes('/dashboard')) {
      console.log(`${context}: Navigating to dashboard...`);
      await dashboard.navigate();
      console.log(`${context}: ✓ Navigated to dashboard`);
    } else {
      console.log(`${context}: ✓ Already on dashboard`);
    }
    
    // Assert 4: Dashboard is fully loaded
    console.log(`${context}: Waiting for dashboard to load...`);
    await dashboard.waitForDashboard();
    console.log(`${context}: ✓ Dashboard loaded`);
    
    // Assert 5: Open create group modal
    console.log(`${context}: Opening create group modal...`);
    const createGroupModal = new CreateGroupModalPage(this.page);
    await dashboard.openCreateGroupModal();
    console.log(`${context}: ✓ Create group modal opened`);
    
    // Assert 6: Create group via modal
    console.log(`${context}: Creating group via modal...`);
    await createGroupModal.createGroup(name, description);
    console.log(`${context}: ✓ Group creation form submitted`);
    
    // Assert 7: Wait for navigation to group page
    console.log(`${context}: Waiting for navigation to group page...`);
    try {
      await dashboard.expectUrl(/\/groups\/[a-zA-Z0-9]+$/);
      console.log(`${context}: ✓ Navigated to group page`);
    } catch (error) {
      const urlAfterCreation = this.page.url();
      throw new Error(`${context}: Failed to navigate to group page after creation. Current URL: ${urlAfterCreation}. Error: ${(error as Error).message}`);
    }

    // Assert 8: Extract group ID from URL
    console.log(`${context}: Extracting group ID from URL...`);
    const groupId = dashboard.getUrlParam('groupId');
    if (!groupId) {
      const finalUrl = this.page.url();
      throw new Error(`${context}: Failed to extract group ID from URL: ${finalUrl}`);
    }
    console.log(`${context}: ✓ Group ID extracted: ${groupId}`);
    
    // Assert 9: Verify correct group page URL
    console.log(`${context}: Verifying group page URL matches expected pattern...`);
    const expectedUrlPattern = new RegExp(`/groups/${groupId}$`);
    await expect(this.page, `${context}: URL does not match expected group page pattern`).toHaveURL(expectedUrlPattern);
    console.log(`${context}: ✓ Group page URL verified`);

    // Assert 10: Verify group name is visible on page
    console.log(`${context}: Verifying group name is visible on page...`);
    await expect(this.page.getByText(name), `${context}: Group name "${name}" not visible on page`).toBeVisible({ timeout: 5000 });
    console.log(`${context}: ✓ Group name verified as visible`);
    
    console.log(`${context}: 🎉 COMPLETE - Group created successfully with ID: ${groupId}`);
    return groupId;
  }

}