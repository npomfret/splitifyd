import { test as base } from './base-test';
import { Page } from '@playwright/test';
import { AuthenticationWorkflow } from '../workflows';
import { TestUser } from '../helpers/auth-utils';
import { getUserPool } from './user-pool.fixture';

export interface AuthenticatedFixtures {
  authenticatedPage: {
    page: Page;
    user: TestUser;
  };
}

export const authenticatedTest = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    const userPool = await getUserPool();
    
    // Clear any existing auth state to ensure clean test environment
    await context.clearCookies();
    await page.goto('about:blank');
    
    // Claim user from pool - fail fast if pool is broken
    const user = await userPool.claimUser(testInfo.testId);
    
    // Authenticate the existing user via login
    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);
    
    try {
      await use({ page, user });
    } finally {
      // Release user back to pool
      await userPool.releaseUser(user.uid, testInfo.testId);
    }
  }
});

export { expect } from '@playwright/test';