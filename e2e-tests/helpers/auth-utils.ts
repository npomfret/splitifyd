import { Page } from '@playwright/test';
import { RegisterPage, DashboardPage } from '../pages';

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
  token?: string;
}

export async function createAndLoginTestUser(page: Page): Promise<TestUser> {
  // Generate test user data with high uniqueness including process-level randomness
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const processRandom = Math.floor(Math.random() * 10000);
  const uuid = `${timestamp}-${random}-${processRandom}`;
  const email = `test-${uuid}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test User ${uuid}`;

  // Use RegisterPage for registration
  const registerPage = new RegisterPage(page);
  await registerPage.navigate();
  await registerPage.register(displayName, email, password);
  
  // Wait for successful registration and redirect to dashboard
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.waitForDashboard();
  
  return {
    uid: `test-uid-${uuid}`,
    email,
    displayName
  };
}