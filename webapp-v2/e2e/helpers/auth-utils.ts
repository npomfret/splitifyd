import { Page } from '@playwright/test';
import { V2_URL } from './emulator-utils';
import { RegisterPage, LoginPage, DashboardPage } from '../pages';

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
  token?: string;
}

export async function createAndLoginTestUser(page: Page): Promise<TestUser> {
  // Generate test user data
  const timestamp = Date.now();
  const email = `test-${timestamp}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test User ${timestamp}`;

  // Use RegisterPage for registration
  const registerPage = new RegisterPage(page);
  await registerPage.navigate();
  await registerPage.register(displayName, email, password);
  
  // Wait for successful registration and redirect to dashboard
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.waitForDashboard();
  
  return {
    uid: `test-uid-${timestamp}`,
    email,
    displayName
  };
}

export async function loginTestUser(page: Page, credentials: { email: string; password: string }) {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(credentials.email, credentials.password);
  
  const dashboardPage = new DashboardPage(page);
  await dashboardPage.waitForDashboard();
}

export async function ensureLoggedOut(page: Page) {
  await page.goto(`${V2_URL}/logout`);
  await page.waitForURL(/\/(login|home)?/, { timeout: 2000 });
}

export async function waitForAuthState(page: Page) {
  await page.waitForLoadState('networkidle');
}