import { Page } from '@playwright/test';
import { RegisterPage } from '../pages';
import { LoginPage } from '../pages';
import { DashboardPage } from '../pages';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";
import { generateShortId, generateTestEmail, generateTestUserName } from '../utils/test-helpers';

/**
 * Authentication workflow class that handles user creation and login flows.
 * Encapsulates the multi-step process of creating and authenticating test users.
 */
export class AuthenticationWorkflow {
  constructor(private page: Page) {}

  /**
   * Creates a new test user and logs them in.
   * This replaces the createAndLoginTestUser helper function.
   */
  async createAndLoginTestUser(): Promise<BaseUser> {
    // Generate test user data with short unique ID
    const uniqueId = generateShortId();
    const displayName = generateTestUserName();
    const email = generateTestEmail('user');
    const password = 'TestPassword123!';

    // Use RegisterPage for registration
    const registerPage = new RegisterPage(this.page);
    await registerPage.navigate();
    await registerPage.register(displayName, email, password);
    
    // Wait for successful registration and redirect to dashboard
    const dashboardPage = new DashboardPage(this.page);
    await dashboardPage.waitForDashboard();
    
    return {
      uid: uniqueId,
      email,
      displayName
    };
  }

  /**
   * Logs in an existing test user (for use with user pool)
   * Expects to start from a clean state - will fail fast if not
   */
  async loginExistingUser(user: BaseUser): Promise<void> {
    const loginPage = new LoginPage(this.page);
    await loginPage.navigate();
    
    // Extract password from user creation pattern - all pool users use same password
    const password = 'TestPassword123!';
    await loginPage.login(user.email, password);
    
    // Wait for successful login and redirect to dashboard
    const dashboardPage = new DashboardPage(this.page);
    await dashboardPage.waitForDashboard();
  }

  /**
   * Static convenience method for backward compatibility.
   * Use instance method for better testability and page object encapsulation.
   */
  static async createTestUser(page: Page): Promise<BaseUser> {
    const workflow = new AuthenticationWorkflow(page);
    return workflow.createAndLoginTestUser();
  }
}