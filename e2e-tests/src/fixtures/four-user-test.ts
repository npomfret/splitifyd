import { threeUserTest } from './three-user-test';
import type { ThreeUserFixtures } from './three-user-test';
import type { Page } from '@playwright/test';
import type { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, CreateGroupModalPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';

export interface FourUserFixtures extends ThreeUserFixtures {
    fourthUser: {
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

export const fourUserTest = threeUserTest.extend<FourUserFixtures>({
    userCount: 4,
    fourthUser: async ({ users }, use) => {
        if (users.length < 4) {
            throw new Error('fourUserTest requires at least 4 users');
        }
        const fourth = users[3];
        await use({
            page: fourth.page,
            user: fourth.user,
            loginPage: fourth.pages.login,
            registerPage: fourth.pages.register,
            homepagePage: fourth.pages.homepage,
            pricingPage: fourth.pages.pricing,
            dashboardPage: fourth.pages.dashboard,
            groupDetailPage: fourth.pages.groupDetail,
            createGroupModalPage: fourth.pages.createGroupModal,
        });
    },
});

export { expect } from '@playwright/test';