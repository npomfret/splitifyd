import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { TIMEOUT_CONTEXTS } from '../../../config/timeouts';
import { PLACEHOLDERS } from '../../../constants/selectors';

test.describe('Member Management E2E', () => {
    test('should display current group members', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Members Display Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member display');

        // Should show the current user as a member in the main content area
        // Use the groupDetailPage page object model instead of direct selectors
        await expect(groupDetailPage.getUserName(await dashboardPage.getCurrentUserDisplayName())).toBeVisible();

        // Look for members section showing 1 member
        await expect(groupDetailPage.getMemberCountElement()).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
    });

    test('should show member in expense split options', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Split Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for split options');

        // Navigate to add expense
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(1);

        // Wait for expense form
        await expect(page.getByPlaceholder(PLACEHOLDERS.EXPENSE_DESCRIPTION)).toBeVisible();

        // Member should be visible in split section
        const splitHeading = expenseFormPage.getSplitBetweenHeading();
        await expect(splitHeading).toBeVisible();

        // The current user should be included and checked by default (payer is auto-selected)
        const userCheckbox = expenseFormPage.getSplitOptionsFirstCheckbox();
        await expect(userCheckbox).toBeVisible();
        await expect(userCheckbox).toBeChecked();

        // User name should be visible in split section
        const isUserInSplit = await expenseFormPage.isUserInSplitOptions(await dashboardPage.getCurrentUserDisplayName());
        expect(isUserInSplit).toBe(true);
    });

    test('should show creator as admin', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Admin Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for admin badge');

        // Creator should have admin badge - we expect a specific UI element
        // The UI must show "admin" text for the group creator
        await expect(groupDetailPage.getAdminBadge()).toBeVisible();
    });

    test('should show share functionality', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Share Test Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for sharing');

        // Share button should be visible and functional
        const shareButton = groupDetailPage.getShareButton();
        await expect(shareButton).toBeVisible();

        // Get share link (opens modal, waits for link, closes modal)
        const linkValue = await groupDetailPage.getShareLink();

        // Link should contain the join URL with linkId parameter
        expect(linkValue).toMatch(/\/join\?linkId=/);
    });

    test('should handle member count display', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();

        // Navigate to dashboard
        await dashboardPage.navigateToDashboard();
        await dashboardPage.waitForDashboard();

        // Create a group
        const groupName = 'Member Count Group';
        const groupDetailPage = await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member count');

        // Should show member count
        const memberCount = groupDetailPage.getMemberCountElement();
        await expect(memberCount).toBeVisible();

        // Note: Balance display testing is centralized in balance-settlement.e2e.test.ts
    });
});
