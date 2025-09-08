import { multiUserTest } from './multi-user-declarative';
import type { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, ExpenseDetailPage, CreateGroupModalPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';
import {Page} from "@playwright/test";

export interface AuthenticatedPageFixtures {
    authenticatedPage: {
        page: Page;
        user: PooledTestUser;
        dashboardPage: DashboardPage;
    };
    loginPage: LoginPage;
    registerPage: RegisterPage;
    homepagePage: HomepagePage;
    pricingPage: PricingPage;
    dashboardPage: DashboardPage;
    groupDetailPage: GroupDetailPage;
    expenseDetailPage: ExpenseDetailPage;
    createGroupModalPage: CreateGroupModalPage;
}

export const authenticatedPageTest = multiUserTest.extend<AuthenticatedPageFixtures>({
    authenticatedPage: async ({ primaryUser }, use) => {
        await use({
            page: primaryUser.page,
            user: primaryUser.user,
            dashboardPage: primaryUser.pages.dashboard,
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
    expenseDetailPage: async ({ primaryUser }, use) => {
        await use(primaryUser.pages.expenseDetail);
    },
    createGroupModalPage: async ({ primaryUser }, use) => {
        await use(primaryUser.pages.createGroupModal);
    },
});

export { expect } from '@playwright/test';
