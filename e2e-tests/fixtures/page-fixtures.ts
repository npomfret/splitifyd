import { test as base, Page } from '@playwright/test';
import { 
  LoginPage, 
  RegisterPage, 
  HomepagePage, 
  PricingPage
} from '../pages';

// Define fixtures for pre-navigated pages
export interface PageFixtures {
  loginPageNavigated: { page: Page; loginPage: LoginPage };
  registerPageNavigated: { page: Page; registerPage: RegisterPage };
  homepageNavigated: { page: Page; homepagePage: HomepagePage };
  pricingPageNavigated: { page: Page; pricingPage: PricingPage };
}

export const pageTest = base.extend<PageFixtures>({
  loginPageNavigated: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await use({ page, loginPage });
  },
  
  registerPageNavigated: async ({ page }, use) => {
    const registerPage = new RegisterPage(page);
    await registerPage.navigate();
    await use({ page, registerPage });
  },
  
  homepageNavigated: async ({ page }, use) => {
    const homepagePage = new HomepagePage(page);
    await homepagePage.navigate();
    await use({ page, homepagePage });
  },
  
  pricingPageNavigated: async ({ page }, use) => {
    const pricingPage = new PricingPage(page);
    await pricingPage.navigate();
    await use({ page, pricingPage });
  }
});

export { expect } from '@playwright/test';