import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { AuthenticationWorkflow } from './authentication.workflow';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";
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
    
    // Create group using DashboardPage
    const dashboard = new DashboardPage(this.page);
    await dashboard.createGroupAndNavigate(groupName, groupDescription);
    
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
    const dashboard = new DashboardPage(this.page);
    return dashboard.createGroupAndNavigate(groupName, groupDescription);
  }

  /**
   * Static convenience method for backward compatibility.
   */
  static async createTestGroup(
    page: Page,
    groupName?: string,
    groupDescription?: string
  ): Promise<TestGroup> {
    const workflow = new GroupWorkflow(page);
    return workflow.createGroupWithUser(groupName, groupDescription);
  }
}