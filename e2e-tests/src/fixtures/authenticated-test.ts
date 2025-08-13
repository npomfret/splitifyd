import { test as base } from './base-test';
import { Page } from '@playwright/test';
import { AuthenticationWorkflow } from '../workflows';
import { getUserPool } from './user-pool.fixture';
import type {User as BaseUser} from "@shared/shared-types";

export interface AuthenticatedFixtures {
  authenticatedPage: {
    page: Page;
    user: BaseUser;
  };
}
base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page, context, browser }, use, testInfo) => {
    const userPool = getUserPool();

    // Clear any existing auth state to ensure clean test environment
    await context.clearCookies();
    await page.goto('about:blank');

    // Claim a user from the pool (creates on-demand if needed)
    const user = await userPool.claimUser(browser);  // Pass browser instead of page

    // Authenticate the existing user via login
    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);

    try {
      await use({ page, user });
    } finally {
      // Release user back to pool for reuse
      userPool.releaseUser(user);
    }
  }
});

export { expect } from '@playwright/test';