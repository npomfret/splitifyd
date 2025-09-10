import { authenticatedPageTest } from './authenticated-page-test';
import type { Page } from '@playwright/test';
import type { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, CreateGroupModalPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';

export interface MultiUserFixtures {
    secondUser: {
        page: Page;
        user: PooledTestUser;
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
    userCount: 2,
    secondUser: async ({ users }, use) => {
        if (users.length < 2) {
            throw new Error('multiUserTest requires at least 2 users');
        }
        const second = users[1];
        await use({
            page: second.page,
            user: second.user,
            loginPage: second.pages.login,
            registerPage: second.pages.register,
            homepagePage: second.pages.homepage,
            pricingPage: second.pages.pricing,
            dashboardPage: second.pages.dashboard,
            groupDetailPage: second.pages.groupDetail,
            createGroupModalPage: second.pages.createGroupModal,
        });
    },
});

export { expect } from '@playwright/test';
