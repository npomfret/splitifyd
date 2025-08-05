import { authenticatedPageTest } from './authenticated-page-test';
import { Page } from '@playwright/test';
import { TestUser } from '../helpers/auth-utils';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../helpers';
import { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage,
  DashboardPage,
  GroupDetailPage,
  CreateGroupModalPage
} from '../pages';

export interface MultiUserFixtures {
  secondUser: {
    page: Page;
    user: TestUser;
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
    
    // Get user pool and claim a second user
    const userPool = await getUserPool();
    const user = await userPool.claimUser(`${testInfo.testId}-user2`);
    
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
      // Clean up: release user and close context
      await userPool.releaseUser(user.uid, `${testInfo.testId}-user2`);
      await context.close();
    }
  }
});

export { expect } from '@playwright/test';