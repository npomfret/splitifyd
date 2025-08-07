import { test as base } from './base-test';
import { Page } from '@playwright/test';
import { AuthenticationWorkflow } from '../workflows/index';
import { getUserPool } from './user-pool.fixture';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";

export interface AuthenticatedFixtures {
  authenticatedPage: {
    page: Page;
    user: BaseUser;
  };
}

export const authenticatedTest = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page, context }, use, testInfo) => {
    const userPool = await getUserPool();
    
    // Clear any existing auth state to ensure clean test environment
    await context.clearCookies();
    await page.goto('about:blank');
    
    // Get user deterministically by worker index - no race condition possible
    const user = userPool.getUserByIndex(testInfo.workerIndex);
    
    // Authenticate the existing user via login
    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);
    
    // Use the authenticated page - no cleanup needed with deterministic assignment
    await use({ page, user });
  }
});

export { expect } from '@playwright/test';