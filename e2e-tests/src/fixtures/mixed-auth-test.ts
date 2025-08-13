import { test as base, Page, BrowserContext } from '@playwright/test';
import { multiUserTest } from './multi-user-declarative';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../helpers/index';
import { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage,
  DashboardPage,
  GroupDetailPage,
  CreateGroupModalPage,
  JoinGroupPage
} from '../pages/index';
import type {User as BaseUser} from "@shared/shared-types";

export interface UnauthenticatedUserFixture {
  page: Page;
  context: BrowserContext;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  homepagePage: HomepagePage;
  pricingPage: PricingPage;
  joinGroupPage: JoinGroupPage;
}

export interface MixedAuthFixtures {
  authenticatedUsers: Array<{
    page: Page;
    user: BaseUser;
    context: BrowserContext;
    dashboardPage: DashboardPage;
    groupDetailPage: GroupDetailPage;
    createGroupModalPage: CreateGroupModalPage;
  }>;
  unauthenticatedUsers: Array<UnauthenticatedUserFixture>;
  authenticatedUserCount: number;
  unauthenticatedUserCount: number;
}

async function createAuthenticatedUser(browser: any): Promise<{
  page: Page;
  user: BaseUser;
  context: BrowserContext;
  dashboardPage: DashboardPage;
  groupDetailPage: GroupDetailPage;
  createGroupModalPage: CreateGroupModalPage;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const userPool = getUserPool();
  const user = await userPool.claimUser(browser);  // Pass browser instead of page
  
  const authWorkflow = new AuthenticationWorkflow(page);
  await authWorkflow.loginExistingUser(user);
  
  return {
    page,
    user,
    context,
    dashboardPage: new DashboardPage(page),
    groupDetailPage: new GroupDetailPage(page),
    createGroupModalPage: new CreateGroupModalPage(page)
  };
}

async function createUnauthenticatedUser(browser: any): Promise<UnauthenticatedUserFixture> {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  return {
    page,
    context,
    loginPage: new LoginPage(page),
    registerPage: new RegisterPage(page),
    homepagePage: new HomepagePage(page),
    pricingPage: new PricingPage(page),
    joinGroupPage: new JoinGroupPage(page)
  };
}

export const mixedAuthTest = base.extend<MixedAuthFixtures>({
  authenticatedUserCount: 1,
  unauthenticatedUserCount: 1,
  
  authenticatedUsers: async ({ browser, authenticatedUserCount }, use) => {
    const users: Array<any> = [];
    const userPool = getUserPool();
    
    try {
      // Create authenticated users in parallel
      const authPromises = Array.from(
        { length: authenticatedUserCount }, 
        () => createAuthenticatedUser(browser)
      );
      const createdUsers = await Promise.all(authPromises);
      users.push(...createdUsers);
      
      await use(users);
      
    } finally {
      // Clean up
      await Promise.all(users.map(async ({ context, user }) => {
        if (user) {
          userPool.releaseUser(user);
        }
        await context.close();
      }));
    }
  },
  
  unauthenticatedUsers: async ({ browser, unauthenticatedUserCount }, use) => {
    const users: UnauthenticatedUserFixture[] = [];
    
    try {
      // Create unauthenticated users in parallel
      const unauthPromises = Array.from(
        { length: unauthenticatedUserCount }, 
        () => createUnauthenticatedUser(browser)
      );
      const createdUsers = await Promise.all(unauthPromises);
      users.push(...createdUsers);
      
      await use(users);
      
    } finally {
      // Clean up
      await Promise.all(users.map(async ({ context }) => {
        await context.close();
      }));
    }
  }
});

// Convenience fixture for single authenticated + single unauthenticated
export const singleMixedAuthTest = mixedAuthTest.extend({
  authenticatedUserCount: 1,
  unauthenticatedUserCount: 1
});

export { expect } from '@playwright/test';