import { test as base } from './base-test';
import { Page } from '@playwright/test';
import { AuthenticationWorkflow } from '../workflows';
import { TestUser } from '../helpers/auth-utils';

export interface AuthenticatedFixtures {
  authenticatedPage: {
    page: Page;
    user: TestUser;
  };
}

export const authenticatedTest = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const authWorkflow = new AuthenticationWorkflow(page);
    const user = await authWorkflow.createAndLoginTestUser();
    await use({ page, user });
  }
});

export { expect } from '@playwright/test';