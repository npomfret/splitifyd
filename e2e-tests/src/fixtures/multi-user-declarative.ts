import { test as base, Page, BrowserContext } from '@playwright/test';
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
import type {User as BaseUser} from "@shared/types/webapp-shared-types";

export interface PageObjects {
  login: LoginPage;
  register: RegisterPage;
  homepage: HomepagePage;
  pricing: PricingPage;
  dashboard: DashboardPage;
  groupDetail: GroupDetailPage;
  createGroupModal: CreateGroupModalPage;
}

export interface UserFixture {
  page: Page;
  user: BaseUser;
  context: BrowserContext;
  pages: PageObjects;
}

export interface MultiUserFixtures {
  users: UserFixture[];
  userCount: number;
  primaryUser: UserFixture;
  secondaryUsers: UserFixture[];
}

function createPageObjects(page: Page): PageObjects {
  return {
    login: new LoginPage(page),
    register: new RegisterPage(page),
    homepage: new HomepagePage(page),
    pricing: new PricingPage(page),
    dashboard: new DashboardPage(page),
    groupDetail: new GroupDetailPage(page),
    createGroupModal: new CreateGroupModalPage(page)
  };
}

async function createUserFixture(browser: any): Promise<UserFixture> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const userPool = getUserPool();
  const user = await userPool.claimUser(page);
  
  const authWorkflow = new AuthenticationWorkflow(page);
  await authWorkflow.loginExistingUser(user);
  
  return {
    page,
    user,
    context,
    pages: createPageObjects(page)
  };
}

export const multiUserTest = base.extend<MultiUserFixtures>({
  userCount: 1,
  
  users: async ({ browser, userCount }, use) => {
    const users: UserFixture[] = [];
    const userPool = getUserPool();
    
    try {
      const userPromises = Array.from({ length: userCount }, () => createUserFixture(browser));
      const createdUsers = await Promise.all(userPromises);
      users.push(...createdUsers);
      
      await use(users);
      
    } finally {
      await Promise.all(users.map(async ({ context, user }) => {
        userPool.releaseUser(user);
        await context.close();
      }));
    }
  },
  
  primaryUser: async ({ users }, use) => {
    if (users.length === 0) {
      throw new Error('No users available. Set userCount > 0');
    }
    await use(users[0]);
  },
  
  secondaryUsers: async ({ users }, use) => {
    await use(users.slice(1));
  }
});

// Dynamic user count test - allows tests to specify user count at runtime
export const dynamicUserTest = multiUserTest;

// Pre-configured convenience fixtures
export const singleUserTest = multiUserTest.extend({ userCount: 1 });
export const twoUserTest = multiUserTest.extend({ userCount: 2 });
export const threeUserTest = multiUserTest.extend({ userCount: 3 });
export const fourUserTest = multiUserTest.extend({ userCount: 4 });
export const fiveUserTest = multiUserTest.extend({ userCount: 5 });

export { expect } from '@playwright/test';