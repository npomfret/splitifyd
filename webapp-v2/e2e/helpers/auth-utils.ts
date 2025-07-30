import { Page } from '@playwright/test';
import { V2_URL } from './emulator-utils';

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
  const password = 'testpassword123';
  const displayName = `Test User ${timestamp}`;

  // Register the user first
  await page.goto(`${V2_URL}/register`);
  
  // Clear and fill full name
  const nameInput = page.getByPlaceholder('Enter your full name');
  await nameInput.clear();
  await nameInput.fill(displayName);
  
  // Clear and fill email
  const emailInput = page.getByPlaceholder('Enter your email');
  await emailInput.clear();
  await emailInput.fill(email);
  
  // Clear and fill password
  const passwordInput = page.getByPlaceholder('Create a strong password');
  await passwordInput.clear();
  await passwordInput.fill(password);
  
  // Clear and fill password confirmation
  const confirmPasswordInput = page.getByPlaceholder('Confirm your password');
  await confirmPasswordInput.clear();
  await confirmPasswordInput.fill(password);
  
  // Check the terms of service checkbox
  await page.getByRole('checkbox').check();
  
  await page.getByRole('button', { name: 'Create Account' }).click();
  
  // Wait for successful registration and redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 3000 });
  
  return {
    uid: `test-uid-${timestamp}`,
    email,
    displayName
  };
}

export async function loginTestUser(page: Page, credentials: { email: string; password: string }) {
  await page.goto(`${V2_URL}/login`);
  
  // Clear and fill email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.clear();
  await emailInput.fill(credentials.email);
  
  // Clear and fill password
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.clear();
  await passwordInput.fill(credentials.password);
  
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 3000 });
}

export async function ensureLoggedOut(page: Page) {
  await page.goto(`${V2_URL}/logout`);
  await page.waitForURL(/\/(login|home)?/, { timeout: 2000 });
}

export async function waitForAuthState(page: Page) {
  await page.waitForLoadState('networkidle');
}