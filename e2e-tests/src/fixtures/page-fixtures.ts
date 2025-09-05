import { Page } from '@playwright/test';
import { singleUserTest as base } from './multi-user-declarative';
import { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, CreateGroupModalPage } from '../pages';

// Define fixtures for pre-navigated pages
export interface PageFixtures {
    loginPageNavigated: { page: Page; loginPage: LoginPage };
    registerPageNavigated: { page: Page; registerPage: RegisterPage };
    homepageNavigated: { page: Page; homepagePage: HomepagePage };
    pricingPageNavigated: { page: Page; pricingPage: PricingPage };
    // Non-navigated page objects for reuse
    loginPage: LoginPage;
    registerPage: RegisterPage;
    homepagePage: HomepagePage;
    pricingPage: PricingPage;
    dashboardPage: DashboardPage;
    groupDetailPage: GroupDetailPage;
    createGroupModalPage: CreateGroupModalPage;
}

export const pageTest = base.extend<PageFixtures>({
    // Pre-navigated page fixtures
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
    },

    // Non-navigated page object fixtures (lazy instantiation)
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    registerPage: async ({ page }, use) => {
        await use(new RegisterPage(page));
    },

    homepagePage: async ({ page }, use) => {
        await use(new HomepagePage(page));
    },

    pricingPage: async ({ page }, use) => {
        await use(new PricingPage(page));
    },

    dashboardPage: async ({ page }, use) => {
        await use(new DashboardPage(page));
    },

    groupDetailPage: async ({ page }, use) => {
        await use(new GroupDetailPage(page));
    },

    createGroupModalPage: async ({ page }, use) => {
        await use(new CreateGroupModalPage(page));
    },
});

export { expect } from '@playwright/test';
