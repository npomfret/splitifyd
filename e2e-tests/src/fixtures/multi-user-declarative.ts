import { test as base, Page, BrowserContext } from '@playwright/test';
import { getUserPool } from './user-pool.fixture';
import { AuthenticationWorkflow } from '../workflows';
import { LoginPage, RegisterPage, HomepagePage, PricingPage, DashboardPage, GroupDetailPage, ExpenseDetailPage, CreateGroupModalPage } from '../pages';
import { PooledTestUser } from '@splitifyd/shared';
import * as fs from 'fs';
import * as path from 'path';

export interface PageObjects {
    login: LoginPage;
    register: RegisterPage;
    homepage: HomepagePage;
    pricing: PricingPage;
    dashboard: DashboardPage;
    groupDetail: GroupDetailPage;
    expenseDetail: ExpenseDetailPage;
    createGroupModal: CreateGroupModalPage;
}

export interface UserFixture {
    page: Page;
    user: PooledTestUser;
    context: BrowserContext;
    pages: PageObjects;
}

export interface MultiUserFixtures {
    users: UserFixture[];
    userCount: number;
    primaryUser: UserFixture;
    secondaryUsers: UserFixture[];
}

function createPageObjects(page: Page, user?: PooledTestUser): PageObjects {
    return {
        login: new LoginPage(page, user),
        register: new RegisterPage(page, user),
        homepage: new HomepagePage(page, user),
        pricing: new PricingPage(page, user),
        dashboard: new DashboardPage(page, user),
        groupDetail: new GroupDetailPage(page, user),
        expenseDetail: new ExpenseDetailPage(page, user),
        createGroupModal: new CreateGroupModalPage(page, user),
    };
}

async function createUserFixture(browser: any, userIndex: number = 0, existingPage?: Page, existingContext?: BrowserContext, testInfo?: any): Promise<UserFixture> {
    // Use existing page/context if provided (for primary user), otherwise create new ones
    const context = existingContext || (await browser.newContext());
    const page = existingPage || (await context.newPage());

    const userPool = getUserPool();
    const user = await userPool.claimUser(browser); // Pass browser instead of page

    // Set up console log capture for this user - use test info to create unique directory
    const testDir = testInfo ? testInfo.outputDir : path.join(process.cwd(), 'e2e-tests', 'playwright-report', 'output');
    const logFile = path.join(testDir, `user-${userIndex}-${user.email.replace(/\s+/g, '-')}-console.log`);
    
    // Ensure directory exists
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Clear existing log file
    fs.writeFileSync(logFile, `Console logs for User ${userIndex}: ${user.email}\n`, 'utf8');

    // Set up console message listener
    page.on('console', (msg: any) => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${msg.type().toUpperCase()}: ${msg.text()}\n`;
        fs.appendFileSync(logFile, logEntry, 'utf8');
    });

    const authWorkflow = new AuthenticationWorkflow(page);
    await authWorkflow.loginExistingUser(user);

    return {
        page,
        user,
        context,
        pages: createPageObjects(page, user),
    };
}

export const multiUserTest = base.extend<MultiUserFixtures>({
    userCount: 1,

    users: async ({ browser, userCount, page, context }, use, testInfo) => {
        const users: UserFixture[] = [];
        const userPool = getUserPool();

        try {
            // Create and authenticate users sequentially to avoid race conditions
            // Parallel authentication can cause login failures in the Firebase emulator
            for (let i = 0; i < userCount; i++) {
                let userFixture: UserFixture;

                if (i === 0) {
                    // First user: reuse default page/context
                    userFixture = await createUserFixture(browser, i, page, context, testInfo);
                } else {
                    // Additional users: create new contexts
                    userFixture = await createUserFixture(browser, i, undefined, undefined, testInfo);
                }

                users.push(userFixture);
            }

            await use(users);
        } finally {
            await Promise.all(
                users.map(async ({ context, user }, index) => {
                    await userPool.releaseUser(user);
                    // Don't close the default context (index 0), Playwright will handle it
                    if (index > 0) {
                        try {
                            await context.close();
                        } catch (error) {
                            // Ignore trace file cleanup errors - they don't affect test results
                            if (error instanceof Error && error.message?.includes('ENOENT') && error.message?.includes('.trace')) {
                                console.warn(`Ignoring trace cleanup error for context ${index}:`, error.message);
                            } else {
                                throw error;
                            }
                        }
                    }
                }),
            );
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
    },
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
