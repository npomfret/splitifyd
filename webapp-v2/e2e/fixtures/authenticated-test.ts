import { test as base, Page } from '@playwright/test';
import { createAndLoginTestUser, ensureLoggedOut, TestUser } from '../helpers/auth-utils';

export interface AuthenticatedFixtures {
  authenticatedPage: {
    page: Page;
    user: TestUser;
  };
}

export const authenticatedTest = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const user = await createAndLoginTestUser(page);
    await use({ page, user });
  }
});

export { expect } from '@playwright/test';