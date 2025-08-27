import { expect, multiUserTest as test } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { JoinGroupPage } from '../../pages';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';
import {groupDetailUrlPattern} from "../../pages/group-detail.page.ts";

setupMCPDebugOnFailure();

test.describe('Multi-User Collaboration E2E', () => {
    test('should handle group sharing via share link', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Shared'), 'Testing group sharing');

        const shareLink = await groupDetailPage.getShareLink();
        expect(shareLink).toMatch(/\/join(\?|\/)/); // Verify format

        const page2 = secondUser.page;
        const groupDetailPage2 = secondUser.groupDetailPage;
        const user2 = secondUser.user;

        // Use robust JoinGroupPage for reliable share link joining
        const joinGroupPage = new JoinGroupPage(page2);
        await joinGroupPage.joinGroupUsingShareLink(shareLink);
    });

    test('should allow multiple users to add expenses to same group', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page, user } = authenticatedPage;
        const memberCount = 2;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('MultiExp'), 'Testing concurrent expenses');
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));

        const user1 = user;

        // Get share link (includes all validation)
        const shareLink = await groupDetailPage.getShareLink();

        // Second user joins
        const page2 = secondUser.page;
        const groupDetailPage2 = secondUser.groupDetailPage;
        const user2 = secondUser.user;
        const joinGroupPage2 = new JoinGroupPage(page2);

        await page2.goto(shareLink);
        try {
            await expect(joinGroupPage2.getJoinGroupHeading()).toBeVisible();
        } catch (error) {
            throw new Error(`Join page should load from share link: ${shareLink} - check if link is valid and emulator is running`);
        }

        await joinGroupPage2.getJoinGroupButton().click();
        try {
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId), { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
        } catch (error) {
            throw new Error(`Second user should navigate to group page after joining, but stayed on: ${page2.url()}`);
        }

        // Wait for synchronization of users
        await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);

        // Also ensure second user sees both members
        await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);

        // SEQUENTIAL EXPENSE ADDITION: User 1 adds expense first
        const expenseFormPage1 = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage1.submitExpense({
            description: 'User 1 Lunch',
            amount: 25,
            currency: 'USD',
            paidBy: user1.displayName,
            splitType: 'equal',
        });

        // Wait for User 1's expense to be fully processed and synced
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify User 1's expense is visible to both users before proceeding
        await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();

        // SEQUENTIAL EXPENSE ADDITION: User 2 adds expense ONLY AFTER User 1's expense is synchronized
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(memberCount);
        await expenseFormPage2.submitExpense({
            description: 'User 2 Dinner',
            amount: 40,
            currency: 'USD',
            paidBy: user2.displayName,
            splitType: 'equal',
        });

        // Wait for User 2's expense to be fully processed and synced
        await groupDetailPage.waitForBalancesToLoad(groupId);
        await groupDetailPage2.waitForBalancesToLoad(groupId);

        // Verify expenses
        await expect(groupDetailPage.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage.getExpenseByDescription('User 2 Dinner')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 1 Lunch')).toBeVisible();
        await expect(groupDetailPage2.getExpenseByDescription('User 2 Dinner')).toBeVisible();
    });

    test('should show group creator as admin', async ({ authenticatedPage, groupDetailPage }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Admin'), 'Testing admin badge');

        await expect(groupDetailPage.getAdminBadge()).toBeVisible();
    });

    test('single user can create group and add multiple expenses', async ({ authenticatedPage, groupDetailPage }) => {
        const memberCount = 1;
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Solo'), 'Testing multiple expenses');

        // Add multiple expenses
        const expenses = [
            { description: 'Hotel Booking', amount: 300 },
            { description: 'Car Rental', amount: 150 },
            { description: 'Groceries', amount: 80 },
        ];

        for (const expense of expenses) {
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
            await expenseFormPage.submitExpense({
                description: expense.description,
                amount: expense.amount,
                currency: 'USD',
                paidBy: user.displayName,
                splitType: 'equal',
            });

            // Wait for each expense to be processed
            await groupDetailPage.waitForBalancesToLoad(groupId);
        }

        // Verify all expenses are visible
        for (const expense of expenses) {
            await expect(groupDetailPage.getExpenseByDescription(expense.description)).toBeVisible();
        }
    });

    test('balances update correctly with multiple users and expenses', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const memberCount = 2;
        const { page, user } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Balance'), 'Testing balance calculations');
        const groupInfo = { user };
        const user1 = groupInfo.user;

        // Get share link - verify page state first with detailed error messages
        try {
            await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        } catch (error) {
            throw new Error(`Expected to be on group page after creation, but got: ${page.url()}. Original error: ${(error as Error).message}`);
        }

        // Get share link (includes all validation)
        const shareLink = await groupDetailPage.getShareLink();

        // Second user joins
        const page2 = secondUser.page;
        const groupDetailPage2 = secondUser.groupDetailPage;
        const user2 = secondUser.user;
        const joinGroupPage2 = new JoinGroupPage(page2);
        await page2.goto(shareLink);
        try {
            await expect(joinGroupPage2.getJoinGroupHeading()).toBeVisible();
        } catch (error) {
            throw new Error(`Join page should load from share link: ${shareLink} - check if link is valid and emulator is running`);
        }

        await joinGroupPage2.getJoinGroupButton().click();
        try {
            await expect(page2).toHaveURL(groupDetailUrlPattern(groupId), { timeout: TIMEOUT_CONTEXTS.GROUP_CREATION });
        } catch (error) {
            throw new Error(`Second user should navigate to group page after joining, but stayed on: ${page2.url()}`);
        }

        // WAIT for user synchronization before adding expense
        await groupDetailPage.waitForUserSynchronization(user1.displayName, user2.displayName);
        await groupDetailPage2.waitForUserSynchronization(user1.displayName, user2.displayName);

        // User 1 pays for shared expense AFTER synchronization
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);
        await expenseFormPage.submitExpense({
            description: 'Shared Meal',
            amount: 100,
            currency: 'USD',
            paidBy: user1.displayName,
            splitType: 'equal',
        });

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
        const hasArrowDebt = (await page.getByText(`${user2.displayName} → ${user1.displayName}`).count()) > 0;
        const hasOwesDebt = (await page.getByText(`${user2.displayName} owes ${user1.displayName}`).count()) > 0;

        // Verify that the debt relationship exists
        expect(hasArrowDebt || hasOwesDebt).toBeTruthy();

        // Verify the specific debt amount: $100 / 2 = $50.00
        const expectedDebt = expenseFormPage.calculateEqualSplitDebt(100, 2);
        const hasCorrectAmount = await groupDetailPage.hasDebtAmount(`$${expectedDebt}`);
        expect(hasCorrectAmount).toBe(true);
    });
});
