import { multiUserTest, MultiUserFixtures } from './multi-user-test';
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

export interface ThreeUserFixtures extends MultiUserFixtures {
  thirdUser: {
    page: Page;
    user: BaseUser;
    loginPage: LoginPage;
    registerPage: RegisterPage;
    homepagePage: HomepagePage;
    pricingPage: PricingPage;
    dashboardPage: DashboardPage;
    groupDetailPage: GroupDetailPage;
    createGroupModalPage: CreateGroupModalPage;
  };
}

export const threeUserTest = multiUserTest.extend<ThreeUserFixtures>({
  thirdUser: async ({ browser }, use, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const userPool = await getUserPool();
    const user = await userPool.claimUser(`${testInfo.testId}-user3`);
    
    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);
    
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
      await userPool.releaseUser(user.uid, `${testInfo.testId}-user3`);
      await context.close();
    }
  }
});

export { expect } from '@playwright/test';