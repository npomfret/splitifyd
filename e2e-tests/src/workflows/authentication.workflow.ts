import { Page } from '@playwright/test';
import { RegisterPage } from '../pages/register.page';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TestUser } from '../helpers/auth-utils';

// Re-export TestUser for other workflow files
export type { TestUser };

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
  async createAndLoginTestUser(): Promise<TestUser> {
    // Generate test user data with high uniqueness including process-level randomness
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const processId = process.pid || Math.floor(Math.random() * 10000);
    const uniqueId = `${timestamp}-${randomSuffix}-${processId}`;
    
    const displayName = `Test User ${uniqueId}`;
    const email = `testuser-${uniqueId}@example.com`;
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
  async loginExistingUser(user: TestUser): Promise<void> {
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
  static async createTestUser(page: Page): Promise<TestUser> {
    const workflow = new AuthenticationWorkflow(page);
    return workflow.createAndLoginTestUser();
  }
}