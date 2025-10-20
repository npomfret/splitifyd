import { ExpenseDTOBuilder, ExpenseFullDetailsBuilder, GroupDTOBuilder, GroupMemberBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { ExpenseId } from "@splitifyd/shared";

/**
 * Helper function to mock the expense full-details API endpoint
 */
async function mockExpenseDetailApi(page: any, expenseId: ExpenseId, response: any): Promise<void> {
    await page.route(`/api/expenses/${expenseId}/full-details`, async (route: any) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        });
    });
}

/**
 * Helper function to mock the expense comments API endpoint
 */
async function mockExpenseCommentsApi(page: any, expenseId: ExpenseId, comments: any[] = []): Promise<void> {
    await page.route(`/api/expenses/${expenseId}/comments`, async (route: any) => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    comments,
                    count: comments.length,
                    hasMore: false,
                },
            }),
        });
    });
}

test.describe('Expense Detail - Locked Expense UI', () => {
    test('should display lock warning banner when expense is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'locked-expense-123';
        const groupId = 'test-group-456';

        // Mock the expense detail API response with a locked expense
        const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withDescription('Locked Expense')
                .withAmount(100.0, 'EUR')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withIsLocked(true) // Mark as locked
                .build();
        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .withName('Test Group')
            .build();
        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const fullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockExpenseDetailApi(page, expenseId, fullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail page
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense to load
        await expect(page.getByRole('heading', { name: 'Locked Expense' })).toBeVisible();

        // Verify lock warning banner is displayed
        const warningBanner = page.locator('.bg-yellow-50').filter({ hasText: translationEn.pages.expenseDetailPage.cannotEdit });
        await expect(warningBanner).toBeVisible();

        // Verify warning banner contains the emoji
        await expect(warningBanner).toContainText('⚠️');

        // Verify warning banner contains the main message
        await expect(warningBanner).toContainText(translationEn.pages.expenseDetailPage.cannotEdit);

        // Verify warning banner contains the detailed message
        await expect(warningBanner).toContainText(translationEn.pages.expenseDetailPage.containsDepartedMembers);
    });

    test('should disable edit button when expense is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'locked-expense-123';
        const groupId = 'test-group-456';

        const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withDescription('Locked Expense')
                .withAmount(100.0, 'EUR')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .withIsLocked(true) // Mark as locked
                .build();
        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();
        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const fullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockExpenseDetailApi(page, expenseId, fullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail page
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense to load
        await expect(page.getByRole('heading', { name: 'Locked Expense' })).toBeVisible();

        // Find the edit button
        const editButton = page.getByRole('button', { name: translationEn.expenseComponents.expenseActions.edit });

        // Verify edit button is disabled
        await expect(editButton).toBeDisabled();

        // Verify tooltip is present on the immediate wrapper div
        const editButtonWrapper = page.getByTitle(translationEn.expenseComponents.expenseActions.cannotEditTooltip);
        await expect(editButtonWrapper).toBeVisible();
    });

    test('should not display lock warning when expense is not locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'unlocked-expense-123';
        const groupId = 'test-group-456';

        // Mock the expense detail API response with a normal (unlocked) expense
        const expense = new ExpenseDTOBuilder()
                .withId(expenseId)
                .withGroupId(groupId)
                .withDescription('Normal Expense')
                .withAmount(50.0, 'EUR')
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .build();
        const group = GroupDTOBuilder
            .groupForUser(testUser.uid)
            .withId(groupId)
            .build();
        const members = [
            new GroupMemberBuilder()
                .withUid(testUser.uid)
                .withDisplayName(testUser.displayName)
                .withGroupDisplayName(testUser.displayName)
                .build(),
        ];

        const fullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockExpenseDetailApi(page, expenseId, fullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail page
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense to load
        await expect(page.getByRole('heading', { name: 'Normal Expense' })).toBeVisible();

        // Verify lock warning banner is NOT displayed
        const warningBanner = page.locator('.bg-yellow-50').filter({ hasText: translationEn.pages.expenseDetailPage.cannotEdit });
        await expect(warningBanner).not.toBeVisible();

        // Find the edit button
        const editButton = page.getByRole('button', { name: translationEn.expenseComponents.expenseActions.edit });

        // Verify edit button is enabled
        await expect(editButton).toBeEnabled();
    });
});
