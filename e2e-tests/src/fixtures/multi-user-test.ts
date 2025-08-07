import { authenticatedPageTest } from './authenticated-page-test';
import { Page } from '@playwright/test';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../helpers/index';
import { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage,
  DashboardPage,
  GroupDetailPage,
  CreateGroupModalPage
} from '../pages/index';
import type {User as BaseUser} from "@shared/types/webapp-shared-types.ts";

export interface MultiUserFixtures {
  secondUser: {
    page: Page;
    user: BaseUser;
    // Page objects for the second user
    loginPage: LoginPage;
    registerPage: RegisterPage;
    homepagePage: HomepagePage;
    pricingPage: PricingPage;
    dashboardPage: DashboardPage;
    groupDetailPage: GroupDetailPage;
    createGroupModalPage: CreateGroupModalPage;
  };
}

export const multiUserTest = authenticatedPageTest.extend<MultiUserFixtures>({
  secondUser: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Get user pool and assign second user deterministically
    const userPool = await getUserPool();
    const user = userPool.getSecondUserByIndex(testInfo.workerIndex);
    
    // Authenticate the second user
    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);
    
    // Create page objects for the second user
    const loginPage = new LoginPage(page);
    const registerPage = new RegisterPage(page);
    const homepagePage = new HomepagePage(page);
    const pricingPage = new PricingPage(page);
    const dashboardPage = new DashboardPage(page);
    const groupDetailPage = new GroupDetailPage(page);
    const createGroupModalPage = new CreateGroupModalPage(page);
    
    try {
      await use({
        page,
        user,
        loginPage,
        registerPage,
        homepagePage,
        pricingPage,
        dashboardPage,
        groupDetailPage,
        createGroupModalPage
      });
    } finally {
      // Clean up: just close context - no release needed with deterministic assignment
      await context.close();
    }
  }
});

export { expect } from '@playwright/test';