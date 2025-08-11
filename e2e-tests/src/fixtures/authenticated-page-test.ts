import { multiUserTest } from './multi-user-declarative';
import type { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage,
  DashboardPage,
  GroupDetailPage,
  CreateGroupModalPage
} from '../pages/index';
import type {User as BaseUser} from "@shared/shared-types";

export interface AuthenticatedPageFixtures {
  authenticatedPage: {
    page: any;
    user: BaseUser;
  };
  loginPage: LoginPage;
  registerPage: RegisterPage;
  homepagePage: HomepagePage;
  pricingPage: PricingPage;
  dashboardPage: DashboardPage;
  groupDetailPage: GroupDetailPage;
  createGroupModalPage: CreateGroupModalPage;
}

export const authenticatedPageTest = multiUserTest.extend<AuthenticatedPageFixtures>({
  authenticatedPage: async ({ primaryUser }, use) => {
    await use({
      page: primaryUser.page,
      user: primaryUser.user
    });
  },
  loginPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.login);
  },
  registerPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.register);
  },
  homepagePage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.homepage);
  },
  pricingPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.pricing);
  },
  dashboardPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.dashboard);
  },
  groupDetailPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.groupDetail);
  },
  createGroupModalPage: async ({ primaryUser }, use) => {
    await use(primaryUser.pages.createGroupModal);
  }
});

export { expect } from '@playwright/test';