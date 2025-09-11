import { expect, simpleTest as test } from '../../../fixtures/simple-test.fixture';
import { TestGroupWorkflow } from '../../../helpers';
import { GroupWorkflow } from '../../../workflows';
import { JoinGroupPage, GroupDetailPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';
import { groupDetailUrlPattern } from '../../../pages/group-detail.page.ts';
import { ExpenseFormDataBuilder } from '../../../pages/expense-form.page';

test.describe('Multi-User Collaboration E2E', () => {
    test('should handle group sharing via share link', async ({ newLoggedInBrowser }) => {
        // Create first user and group
        const { page, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const groupId = await TestGroupWorkflow.getOrCreateGroup(page, user.email, { fresh: true });

        const shareLink = await groupDetailPage.getShareLink();
        expect(shareLink).toMatch(/\/join(\?|\/)/); // Verify format

        // Create second user
        const { page: page2, user: user2 } = await newLoggedInBrowser();
        const groupDetailPage2 = new GroupDetailPage(page2, user2);

        // Use robust JoinGroupPage for reliable share link joining
        const joinGroupPage = new JoinGroupPage(page2);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
    });

    test('should allow multiple users to add expenses to same group', async ({ newLoggedInBrowser }) => {
        // Create first user
        const { page, dashboardPage: user1DashboardPage, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);

        // Create second user
        const { page: page2, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();

        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        const memberCount = 2;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('MultiExp'), 'Testing concurrent expenses');
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        const user1 = user;

        // Get share link (includes all validation)
        const shareLink = await groupDetailPage.getShareLink();
        const groupDetailPage2 = new GroupDetailPage(page2, user2);
        const joinGroupPage2 = new JoinGroupPage(page2);

        await page2.goto(shareLink);
        try {
            await expect(joinGroupPage2.getJoinGroupHeading()).toBeVisible();
        } catch (error) {
            throw new Error(`Join page should load from share link: ${shareLink} - check if link is valid and emulator is running`);
        }

        await joinGroupPage2.getJoinGroupButton().click();
        try {
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));
        } catch (error) {
            throw new Error(`Second user should navigate to group page after joining, but stayed on: ${page2.url()}`);
        }

        // Wait for synchronization of users
        await groupDetailPage.waitForUserSynchronization(user1DisplayName, user2DisplayName);

        // Also ensure second user sees both members
        await groupDetailPage2.waitForUserSynchronization(user1DisplayName, user2DisplayName);

        // SEQUENTIAL EXPENSE ADDITION: User 1 adds expense first
        const expenseFormPage1 = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage1.submitExpense(
            new ExpenseFormDataBuilder().withDescription('User 1 Lunch').withAmount(25).withCurrency('USD').withPaidByDisplayName('Test User').withSplitType('equal').build(),
        );

        // Wait for User 1's expense to be fully processed and synced
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify User 1's expense is visible to both users before proceeding
        await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();

        // SEQUENTIAL EXPENSE ADDITION: User 2 adds expense ONLY AFTER User 1's expense is synchronized
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(memberCount);
        const user2Expense = new ExpenseFormDataBuilder().withDescription('User 2 Dinner').withAmount(40).withCurrency('USD').withPaidByDisplayName('Test User').withSplitType('equal').build();
        await expenseFormPage2.submitExpense(user2Expense);

        // Wait for User 2's expense to be fully processed and synced
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify expenses
        await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage.getExpenseByDescription('User 2 Dinner')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    });

    test('should show group creator as admin', async ({ newLoggedInBrowser }) => {
        const { page, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const groupWorkflow = new GroupWorkflow(page);
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Admin'), 'Testing admin badge');

        await expect(groupDetailPage.getAdminBadge()).toBeVisible();
    });

    test('single user can create group and add multiple expenses', async ({ newLoggedInBrowser }) => {
        const memberCount = 1;
        const { page, user } = await newLoggedInBrowser();
        const groupDetailPage = new GroupDetailPage(page, user);
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Solo'), 'Testing multiple expenses');

        // Add multiple expenses
        const expenseData = [
            { description: 'Hotel Booking', amount: 300 },
            { description: 'Car Rental', amount: 150 },
            { description: 'Groceries', amount: 80 },
        ];

        for (const expenseInfo of expenseData) {
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage.submitExpense(
                new ExpenseFormDataBuilder()
                    .withDescription(expenseInfo.description)
                    .withAmount(expenseInfo.amount)
                    .withCurrency('USD')
                    .withPaidByDisplayName('Test User')
                    .withSplitType('equal')
                    .build(),
            );

            // Wait for each expense to be processed
            await groupDetailPage.waitForBalancesToLoad(groupId);
        }

        // Verify all expenses are visible
        for (const expense of expenseData) {
            await expect(groupDetailPage.getExpenseByDescription(expense.description)).toBeVisible();
        }
    });

    test('balances update correctly with multiple users and expenses', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - User 1 and User 2
        const { page, user, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
        const { page: page2, user: user2, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

        // Create page objects
        const groupDetailPage = new GroupDetailPage(page, user);
        const groupDetailPage2 = new GroupDetailPage(page2, user2);

        const user1DisplayName = await user1DashboardPage.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.getCurrentUserDisplayName();

        const memberCount = 2;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Balance'), 'Testing balance calculations');
        const user1 = user;

        // Get share link - verify page state first with detailed error messages
        try {
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        } catch (error) {
            throw new Error(`Expected to be on group page after creation, but got: ${page.url()}. Original error: ${(error as Error).message}`);
        }

        // Get share link (includes all validation)
        const shareLink = await groupDetailPage.getShareLink();
        const joinGroupPage2 = new JoinGroupPage(page2);
        await page2.goto(shareLink);
        try {
            await expect(joinGroupPage2.getJoinGroupHeading()).toBeVisible();
        } catch (error) {
            throw new Error(`Join page should load from share link: ${shareLink} - check if link is valid and emulator is running`);
        }

        await joinGroupPage2.getJoinGroupButton().click();
        try {
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId));
        } catch (error) {
            throw new Error(`Second user should navigate to group page after joining, but stayed on: ${page2.url()}`);
        }

        // WAIT for user synchronization before adding expense
        await groupDetailPage.waitForUserSynchronization(user1DisplayName, user2DisplayName);
        await groupDetailPage2.waitForUserSynchronization(user1DisplayName, user2DisplayName);

        // User 1 pays for shared expense AFTER synchronization
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder().withDescription('Shared Meal').withAmount(100).withCurrency('USD').withPaidByDisplayName('Test User').withSplitType('equal').build(),
        );

        // Wait for expense to be fully processed
        await groupDetailPage.waitForBalancesToLoad(groupId);

        // Verify balance shows User 2 owes User 1

        // Check if Balances section might be collapsed and expand it if needed
        const balancesHeading = groupDetailPage.getBalancesHeading();
        await expect(balancesHeading).toBeVisible();

        // Click on the balances heading to expand if it's collapsed
        // Some UI designs make sections collapsible
        const balancesSection = page
            .locator('section, div')
            .filter({
                has: groupDetailPage.getBalancesHeading(),
            })
            .first();

        // Try clicking the heading to expand if collapsed
        try {
            await balancesHeading.click({ timeout: 1000 });
        } catch {
            // If clicking fails, the section might already be expanded
        }

        // UI now uses arrow notation: "User A → User B" instead of "owes"
        // Check if the debt relationship exists in the DOM (regardless of visibility)
        const hasArrowDebt = (await page.getByText(`${user2DisplayName} → ${user1DisplayName}`).count()) > 0;
        const hasOwesDebt = (await page.getByText(`${user2DisplayName} owes ${user1DisplayName}`).count()) > 0;

        // Verify that the debt relationship exists
        expect(hasArrowDebt || hasOwesDebt).toBeTruthy();

        // Verify the specific debt amount: $100 / 2 = $50.00
        const expectedDebt = expenseFormPage.calculateEqualSplitDebt(100, 2);
        const hasCorrectAmount = await groupDetailPage.hasDebtAmount(`$${expectedDebt}`);
        expect(hasCorrectAmount).toBe(true);
    });
});
