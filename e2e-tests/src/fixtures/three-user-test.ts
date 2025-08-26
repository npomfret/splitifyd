import { multiUserTest } from './multi-user-test';
import type { MultiUserFixtures } from './multi-user-test';
import type { Page } from '@playwright/test';
import type { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, CreateGroupModalPage } from '../pages';
import type { User as BaseUser } from '@splitifyd/shared';

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
    userCount: 3,
    thirdUser: async ({ users }, use) => {
        if (users.length < 3) {
            throw new Error('threeUserTest requires at least 3 users');
        }
        const third = users[2];
        await use({
            page: third.page,
            user: third.user,
            loginPage: third.pages.login,
            registerPage: third.pages.register,
            homepagePage: third.pages.homepage,
            pricingPage: third.pages.pricing,
            dashboardPage: third.pages.dashboard,
            groupDetailPage: third.pages.groupDetail,
            createGroupModalPage: third.pages.createGroupModal,
        });
    },
});

export { expect } from '@playwright/test';
