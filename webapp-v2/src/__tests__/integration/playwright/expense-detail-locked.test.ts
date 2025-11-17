import { ExpenseDTOBuilder, ExpenseDetailPage, ExpenseFullDetailsBuilder, GroupDTOBuilder, GroupMemberBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { mockExpenseCommentsApi, mockExpenseDetailApi } from '../../utils/mock-firebase-service';

test.describe('Expense Detail - Locked Expense UI', () => {
    test('should display lock warning banner when expense is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'locked-expense-123';
        const groupId = 'test-group-456';

        // Mock the expense detail API response with a locked expense
        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
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

        // Wait for expense to load - description is now in a <p> tag, not a heading
        await expect(page.getByText('Locked Expense')).toBeVisible();

        // Verify lock warning banner is displayed using page object
        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyLockWarningBanner();
    });

    test('should disable edit button when expense is locked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const expenseId = 'locked-expense-123';
        const groupId = 'test-group-456';

        const expense = new ExpenseDTOBuilder()
            .withExpenseId(expenseId)
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

        // Wait for expense to load - description is now in a <p> tag, not a heading
        await expect(page.getByText('Locked Expense')).toBeVisible();

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
            .withExpenseId(expenseId)
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

        // Wait for expense to load - description is now in a <p> tag, not a heading
        await expect(page.getByText('Normal Expense')).toBeVisible();

        // Verify lock warning banner is NOT displayed using page object
        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyLockWarningBannerNotVisible();

        // Find the edit button
        const editButton = page.getByRole('button', { name: translationEn.expenseComponents.expenseActions.edit });

        // Verify edit button is enabled
        await expect(editButton).toBeEnabled();
    });
});
