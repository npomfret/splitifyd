import { authenticatedTest } from './authenticated-test';
import { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage,
  DashboardPage,
  GroupDetailPage
} from '../pages';

// Extend authenticated test with page object fixtures
export interface AuthenticatedPageFixtures {
  // Page objects that work with the authenticated page
  loginPage: LoginPage;
  registerPage: RegisterPage;
  homepagePage: HomepagePage;
  pricingPage: PricingPage;
  dashboardPage: DashboardPage;
  groupDetailPage: GroupDetailPage;
}

export const authenticatedPageTest = authenticatedTest.extend<AuthenticatedPageFixtures>({
  loginPage: async ({ authenticatedPage }, use) => {
    await use(new LoginPage(authenticatedPage.page));
  },
  
  registerPage: async ({ authenticatedPage }, use) => {
    await use(new RegisterPage(authenticatedPage.page));
  },
  
  homepagePage: async ({ authenticatedPage }, use) => {
    await use(new HomepagePage(authenticatedPage.page));
  },
  
  pricingPage: async ({ authenticatedPage }, use) => {
    await use(new PricingPage(authenticatedPage.page));
  },
  
  dashboardPage: async ({ authenticatedPage }, use) => {
    await use(new DashboardPage(authenticatedPage.page));
  },
  
  groupDetailPage: async ({ authenticatedPage }, use) => {
    await use(new GroupDetailPage(authenticatedPage.page));
  }
});

export { expect } from '@playwright/test';