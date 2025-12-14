import { ExpenseDetailPage, ExpenseDTOBuilder, ExpenseFullDetailsBuilder, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockExpenseCommentsApi, mockExpenseDetailApi, mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

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

        // Mock group detail API for GroupDetailPage to load
        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        // Mock expense detail API for ExpenseDetailModal to load
        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail URL - this opens GroupDetailPage which auto-opens the modal
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense detail modal to open and show the expense description
        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();
        await expenseDetailPage.verifyExpenseDescriptionInModal('Locked Expense');

        // Verify lock warning banner is displayed
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

        // Mock group detail API for GroupDetailPage to load
        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        // Mock expense detail API for ExpenseDetailModal to load
        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail URL - this opens GroupDetailPage which auto-opens the modal
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense detail modal to open
        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();
        await expenseDetailPage.verifyExpenseDescriptionInModal('Locked Expense');

        // Verify edit button is disabled
        await expenseDetailPage.verifyEditButtonDisabled();

        // Verify tooltip is present on the immediate wrapper div
        await expenseDetailPage.verifyEditButtonTooltip();
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

        // Mock group detail API for GroupDetailPage to load
        const groupFullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockGroupDetailApi(page, groupId, groupFullDetails);
        await mockGroupCommentsApi(page, groupId);

        // Mock expense detail API for ExpenseDetailModal to load
        const expenseFullDetails = new ExpenseFullDetailsBuilder()
            .withExpense(expense)
            .withGroup(group)
            .withMembers(members)
            .build();
        await mockExpenseDetailApi(page, expenseId, expenseFullDetails);
        await mockExpenseCommentsApi(page, expenseId);

        // Navigate to expense detail URL - this opens GroupDetailPage which auto-opens the modal
        await page.goto(`/groups/${groupId}/expenses/${expenseId}`, { waitUntil: 'domcontentloaded' });

        // Wait for expense detail modal to open
        const expenseDetailPage = new ExpenseDetailPage(page);
        await expenseDetailPage.verifyModalVisible();
        await expenseDetailPage.verifyExpenseDescriptionInModal('Normal Expense');

        // Verify lock warning banner is NOT displayed
        await expenseDetailPage.verifyLockWarningBannerNotVisible();

        // Verify edit button is enabled
        await expenseDetailPage.verifyEditButtonEnabled();
    });
});
