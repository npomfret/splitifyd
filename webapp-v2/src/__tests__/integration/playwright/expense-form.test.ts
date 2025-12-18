import type { GroupId } from '@billsplit-wl/shared';
import { DisplayName, toUserId } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import { ExpenseDTOBuilder, ExpenseFormPage, ExpenseFullDetailsBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import type { Page } from '@playwright/test';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockExpenseCommentsApi, mockExpenseDetailApi, mockGroupCommentsApi, mockGroupDetailApi, mockResolveRedirectApi, mockUpdateExpenseApi } from '../../utils/mock-firebase-service';

type MemberSeed = {
    uid: string;
    displayName: DisplayName;
    groupDisplayName?: string;
};

async function expectNoGlobalError(expenseFormPage: ExpenseFormPage) {
    await expenseFormPage.expectNoGlobalErrors();
}

async function openExpenseFormForTest(
    authenticatedPage: { page: Page; user: { uid: string; displayName: DisplayName; }; },
    groupId: GroupId | string,
    additionalMembers: MemberSeed[] = [],
) {
    const { page, user: testUser } = authenticatedPage;

    const group = GroupDTOBuilder
        .groupForUser(toUserId(testUser.uid))
        .withId(groupId)
        .build();

    const members = [
        new GroupMemberBuilder()
            .withUid(testUser.uid)
            .withDisplayName(testUser.displayName)
            .withGroupDisplayName(testUser.displayName)
            .build(),
        ...additionalMembers.map((member) => {
            const groupDisplayName = member.groupDisplayName ?? member.displayName;
            return new GroupMemberBuilder()
                .withUid(member.uid)
                .withGroupDisplayName(groupDisplayName)
                .build();
        }),
    ];

    const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

    await mockGroupDetailApi(page, groupId, fullDetails);
    await mockGroupCommentsApi(page, groupId);

    const expenseFormPage = new ExpenseFormPage(page);
    await expenseFormPage.navigateToAddExpense(groupId);

    return { expenseFormPage, page, testUser };
}

test.describe('Expense Form', () => {
    test.describe('Page Loading', () => {
        test('should display expense form page correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group';

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
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.verifyPageLoaded('add');
        });
    });

    test.describe('Unsaved changes guard', () => {
        test('cancel without edits should not prompt', async ({ authenticatedPage }) => {
            const groupId = 'unsaved-guard-group';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            const dialogs: string[] = [];
            const onDialog = (dialog: any) => {
                dialogs.push(dialog.message());
                void dialog.dismiss();
            };
            page.on('dialog', onDialog);

            await expenseFormPage.verifyCancelButtonVisible();
            await expenseFormPage.clickCancel();

            await expect(page).toHaveURL(/\/groups\/unsaved-guard-group$/);
            expect(dialogs).toHaveLength(0);

            page.off('dialog', onDialog);
        });
    });

    test.describe('Equal Split Recalculation', () => {
        test('should recalculate EQUAL splits when amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-split';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3']);
            await expenseFormPage.selectSplitType('Equal');

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$33.33 USD');
            await expenseFormPage.verifyEqualSplitsContainAmount('$33.34 USD');

            await expenseFormPage.fillAmount('150');

            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('$33.33 USD');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('$33.34 USD');
        });

        test('should recalculate EQUAL splits with 2 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-2';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Equal');

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');
        });

        test('should recalculate EQUAL splits with 4 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-4';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-4')
                    .withDisplayName('User 4')
                    .withGroupDisplayName('User 4')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3', 'User 4']);
            await expenseFormPage.selectSplitType('Equal');

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$25.00 USD');
        });
    });

    test.describe('Currency Handling', () => {
        test('should display symbol and code in currency selector button', async ({ authenticatedPage }) => {
            const { expenseFormPage } = await openExpenseFormForTest(
                authenticatedPage,
                'test-group-currency-display',
                [{ uid: 'user-2', displayName: toDisplayName('User 2') }],
            );

            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.expectCurrencySelectionDisplays('$', USD);

            await expenseFormPage.selectCurrency('CAD');
            await expenseFormPage.expectCurrencySelectionDisplays('$', toCurrencyISOCode('CAD'));
        });

        test('should recalculate splits when currency changes (USD to JPY)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-usd-jpy';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            await expenseFormPage.selectCurrency('JPY');

            await expenseFormPage.verifyEqualSplitsContainAmount('¥50 JPY');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('¥50.00 JPY');
        });

        test('should recalculate splits when currency changes (JPY to USD)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-jpy-usd';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('1000');
            await expenseFormPage.selectCurrency('JPY');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500 JPY');

            await expenseFormPage.selectCurrency('USD');

            await expenseFormPage.verifyEqualSplitsContainAmount('$500.00 USD');
        });

        test('should recalculate splits when currency changes (USD to EUR)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-usd-eur';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            await expenseFormPage.selectCurrency('EUR');

            await expenseFormPage.verifyEqualSplitsContainAmount('€50.00 EUR');
        });
    });

    test.describe('Exact Split Recalculation', () => {
        test('should recalculate EXACT splits when amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-split';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputCount(2);
            await expenseFormPage.verifyExactSplitInputsHaveValue('50.00');

            await expenseFormPage.fillAmount('200');

            await expenseFormPage.verifyExactSplitInputsHaveValue('100.00');
            await expenseFormPage.verifyExactSplitTotal('$200.00 USD', '$200.00 USD');
        });

        test('should recalculate EXACT splits with 3 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-3';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('150');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3']);
            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputCount(3);
            await expenseFormPage.verifyExactSplitInputsHaveValue('50.00');
        });

        test('should recalculate EXACT splits when currency changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-currency';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitInputsHaveValue('50.00');
            await expenseFormPage.verifyExactSplitTotal('$100.00 USD', '$100.00 USD');

            await expenseFormPage.selectCurrency('JPY');

            await expenseFormPage.verifyExactSplitTotal('¥100 JPY', '¥100 JPY');
        });
    });

    test.describe('Split Type Switching', () => {
        test('should switch from EQUAL to EXACT split type', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-switch-equal-exact';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputCount(2);
            await expenseFormPage.verifyExactSplitInputsHaveValue('50.00');
        });

        test('should switch from EXACT to EQUAL split type', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-switch-exact-equal';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Test Expense');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitDisplayed();

            await expenseFormPage.selectSplitType('Equal');

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');
        });
    });

    test.describe('Decimal Amount Handling', () => {
        test('should handle decimal amounts correctly in equal splits', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-decimal';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Decimal Test');
            await expenseFormPage.fillAmount('99.99');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');
        });

        test('should handle amounts with 3 decimal places', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-3-decimals';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('3 Decimal Test');
            await expenseFormPage.fillAmount('100.001');
            await expenseFormPage.selectCurrency('BHD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            // BHD supports 3 decimal places; split should show exact 3-decimal rounding
            await expenseFormPage.verifyEqualSplitsContainAmount('.د.ب33.333 BHD');
        });
    });

    test.describe('Large Numbers', () => {
        test('should handle large amounts correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-large';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Large Amount Test');
            await expenseFormPage.fillAmount('999999.99');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$500,000.00 USD');
        });
    });

    test.describe('Many Participants', () => {
        test('should recalculate splits with 5 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-5-members';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-4')
                    .withDisplayName('User 4')
                    .withGroupDisplayName('User 4')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-5')
                    .withDisplayName('User 5')
                    .withGroupDisplayName('User 5')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('5 Member Test');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3', 'User 4', 'User 5']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            // $100 ÷ 5 = $20 each
            await expenseFormPage.verifyEqualSplitsContainAmount('$20.00 USD');
        });
    });

    test.describe('Sequential Multiple Changes', () => {
        test('should handle rapid consecutive amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-rapid-changes';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Rapid Changes Test');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            // Change 1
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            // Change 2
            await expenseFormPage.fillAmount('200');
            await expenseFormPage.verifyEqualSplitsContainAmount('$100.00 USD');

            // Change 3
            await expenseFormPage.fillAmount('75');
            await expenseFormPage.verifyEqualSplitsContainAmount('$37.50 USD');

            // Change 4
            await expenseFormPage.fillAmount('150');
            await expenseFormPage.verifyEqualSplitsContainAmount('$75.00 USD');
        });

        test('should handle complex multi-step changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-complex-changes';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            // Initial state: $100 USD, Equal split
            await expenseFormPage.fillDescription('Complex Changes');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            // Change to JPY
            await expenseFormPage.selectCurrency('JPY');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥50 JPY');

            // Change amount
            await expenseFormPage.fillAmount('1000');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500 JPY');

            // Switch to Exact amounts
            await expenseFormPage.selectSplitType('Exact amounts');
            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputsHaveValue('500');

            // Back to Equal
            await expenseFormPage.selectSplitType('Equal');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500 JPY');

            // Back to USD
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.verifyEqualSplitsContainAmount('$500.00 USD');
        });
    });

    test.describe('Edge Case Amounts', () => {
        test('should handle amounts that do not divide evenly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-uneven';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-3')
                    .withDisplayName('User 3')
                    .withGroupDisplayName('User 3')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Uneven Division Test');
            await expenseFormPage.fillAmount('10');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            // $10 ÷ 3 = $3.33, $3.33, $3.34
            await expenseFormPage.verifyEqualSplitsContainAmount('$3.33 USD');
            await expenseFormPage.verifyEqualSplitsContainAmount('$3.34 USD');
        });

        test('should handle very small amounts', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-small';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Small Amount Test');
            await expenseFormPage.fillAmount('0.01');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);

            await expenseFormPage.verifyEqualSplitDisplayed();
            // $0.01 ÷ 2 = $0.01 and $0.00 (or both $0.01 depending on rounding)
            await expenseFormPage.verifyEqualSplitsContainAmount('$0.01 USD');
        });
    });

    test.describe('Multiple Currencies', () => {
        test('should handle GBP correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-gbp';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('GBP Test');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('GBP');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('£50.00 GBP');
        });
    });

    test.describe('Exact Split Advanced', () => {
        test('should recalculate exact split total display when currency changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-curr-adv';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Exact Currency Total Test');
            await expenseFormPage.fillAmount('200');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitTotal('$200.00 USD', '$200.00 USD');

            await expenseFormPage.selectCurrency('EUR');
            await expenseFormPage.verifyExactSplitTotal('€200.00 EUR', '€200.00 EUR');
        });
    });

    test.describe('Validation', () => {
        test('should surface precision errors inline without crashing the form', async ({ authenticatedPage }) => {
            const groupId = 'test-group-precision-validation';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId, [
                { uid: 'user-2', displayName: toDisplayName('User 2') },
            ]);

            await expenseFormPage.fillDescription('Invalid precision');
            await expenseFormPage.selectCurrency('EUR');
            await expenseFormPage.fillAmount('3.333');

            await expenseFormPage.verifyAmountErrorMessageContains('decimal place');
            await expenseFormPage.expectAmountValue('3.333');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should require description when field is cleared', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-description';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.fillDescription('Dinner with friends');
            await expenseFormPage.fillDescription('');
            await expenseFormPage.clickExpenseDetailsHeading();
            await expenseFormPage.verifyDescriptionErrorMessageContains('Description is required');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should require amount when cleared after entry', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-amount-required';
            const { expenseFormPage, page, testUser } = await openExpenseFormForTest(authenticatedPage, groupId, [
                { uid: 'user-2', displayName: toDisplayName('User 2') },
            ]);

            await expenseFormPage.fillDescription('Amount required');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.fillAmount('45');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.fillAmount('');
            await expenseFormPage.verifyAmountErrorMessageContains('valid decimal number');
            await expenseFormPage.expectAmountValue('');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should require amount greater than zero', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-amount-positive';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.fillDescription('Zero amount');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.fillAmount('0');
            await expenseFormPage.verifyAmountErrorMessageContains('Amount must be greater than zero');
            await expenseFormPage.expectAmountValue('0');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should reject future dates with inline error', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-date';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            await expenseFormPage.setDate(tomorrow);
            await expenseFormPage.clickExpenseDetailsHeading();
            await expenseFormPage.verifyDateErrorMessageContains('Date cannot be in the future');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should validate exact split totals without crashing', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-splits';
            const { expenseFormPage, page, testUser } = await openExpenseFormForTest(authenticatedPage, groupId, [
                { uid: 'user-2', displayName: toDisplayName('User 2') },
            ]);

            await expenseFormPage.fillDescription('Exact split mismatch');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.switchToExactAmounts();
            await expenseFormPage.setExactSplitAmount(0, '60');
            await expenseFormPage.setExactSplitAmount(1, '60');
            await expenseFormPage.verifySplitErrorMessageContains('Split amounts must equal the total expense amount');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should flag excessively large amounts inline', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-amount-max';
            const { expenseFormPage, page, testUser } = await openExpenseFormForTest(authenticatedPage, groupId, [
                { uid: 'user-2', displayName: toDisplayName('User 2') },
            ]);

            await expenseFormPage.fillDescription('Large amount');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.fillAmount('1000001');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyAmountErrorMessageContains('Amount cannot exceed');
            await expenseFormPage.expectAmountValue('1000001');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            await expectNoGlobalError(expenseFormPage);
        });
    });

    test.describe('Expense Editing (Edit History)', () => {
        test('should navigate to NEW expense ID after editing (edit history creates new document)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-edit-history';
            const oldExpenseId = 'original-expense-id';
            const newExpenseId = 'new-expense-id-after-edit';

            // Build group with minimal args
            const group = GroupDTOBuilder
                .groupForUser(toUserId(testUser.uid))
                .withId(groupId)
                .build();

            const members = [
                new GroupMemberBuilder()
                    .withUid(testUser.uid)
                    .withDisplayName(testUser.displayName)
                    .build(),
            ];

            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

            // Original expense - specify fields needed for form to load without errors
            const originalExpense = new ExpenseDTOBuilder()
                .withExpenseId(oldExpenseId)
                .withGroupId(groupId)
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .build();

            const expenseFullDetails = new ExpenseFullDetailsBuilder()
                .withExpense(originalExpense)
                .withGroup(group)
                .withMembers(members)
                .build();

            // Updated expense - only needs NEW ID (the key difference we're testing)
            const updatedExpense = new ExpenseDTOBuilder()
                .withExpenseId(newExpenseId)
                .withGroupId(groupId)
                .build();

            const updatedExpenseFullDetails = new ExpenseFullDetailsBuilder()
                .withExpense(updatedExpense)
                .withGroup(group)
                .withMembers(members)
                .build();

            // Mock APIs
            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);
            await mockExpenseDetailApi(page, oldExpenseId, expenseFullDetails);
            await mockExpenseCommentsApi(page, oldExpenseId);
            await mockUpdateExpenseApi(page, oldExpenseId, updatedExpense);
            await mockExpenseDetailApi(page, newExpenseId, updatedExpenseFullDetails);
            await mockExpenseCommentsApi(page, newExpenseId);

            // Navigate to edit expense page
            await page.goto(`/groups/${groupId}/add-expense?id=${oldExpenseId}&edit=true`);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.waitForExpenseFormSections();

            // Make changes and submit
            await expenseFormPage.fillDescription('Updated');
            await expenseFormPage.clickUpdateExpenseButton();

            // After editing via modal, user stays on group page (modal closes)
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
            // Expense form modal should be closed
            await expenseFormPage.expectFormClosed();
        });
    });

    test.describe('Percentage Split', () => {
        test('should display percentage split with equal percentages by default', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-percentage';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Percentage Test');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Percentage');

            await expenseFormPage.verifyPercentageSplitDisplayed();
            await expenseFormPage.verifyPercentageSplitInputCount(2);
            // 2 participants = 50% each
            await expenseFormPage.verifyPercentageSplitInputsHaveValue('50');
        });

        test('should update calculated amounts when expense amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-percentage-recalc';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Percentage Recalc');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Percentage');

            await expenseFormPage.verifyPercentageSplitDisplayed();
            // Total shows percentage validation: "100.00% / 100%"
            await expenseFormPage.verifyPercentageSplitTotal('100.00%', '100%');

            // Change amount - percentages stay same (validated), individual amounts recalculate
            await expenseFormPage.fillAmount('200');
            // Percentage total still valid
            await expenseFormPage.verifyPercentageSplitTotal('100.00%', '100%');
        });

        test('should validate percentage totals must equal 100%', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-percentage-validation';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Percentage Validation');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.selectSplitType('Percentage');

            // Set invalid percentages that don't add up to 100%
            await expenseFormPage.setPercentageSplitAmount(0, '60');
            await expenseFormPage.setPercentageSplitAmount(1, '60');

            await expenseFormPage.verifySplitErrorMessageContains('100%');
            await expenseFormPage.expectFormOpen();
            await expectNoGlobalError(expenseFormPage);
        });

        test('should switch from EQUAL to PERCENTAGE split type', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-switch-equal-percentage';

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
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('Switch to Percentage');
            await expenseFormPage.fillAmount('100');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00 USD');

            await expenseFormPage.selectSplitType('Percentage');

            await expenseFormPage.verifyPercentageSplitDisplayed();
            await expenseFormPage.verifyPercentageSplitInputsHaveValue('50');
        });
    });

    test.describe('Convenience Date Buttons', () => {
        test('should set date to today when clicking Today button', async ({ authenticatedPage }) => {
            const groupId = 'test-group-date-today';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Set a different date first
            const yesterday = expenseFormPage.getYesterdayDateString();
            await expenseFormPage.setDate(yesterday);
            await expenseFormPage.verifyDateValue(yesterday);

            // Click Today button
            await expenseFormPage.clickTodayButton();

            const today = expenseFormPage.getTodayDateString();
            await expenseFormPage.verifyDateValue(today);
        });

        test('should set date to yesterday when clicking Yesterday button', async ({ authenticatedPage }) => {
            const groupId = 'test-group-date-yesterday';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Click Yesterday button
            await expenseFormPage.clickYesterdayButton();

            const yesterday = expenseFormPage.getYesterdayDateString();
            await expenseFormPage.verifyDateValue(yesterday);
        });

        test('should set date and time for This Morning', async ({ authenticatedPage }) => {
            const groupId = 'test-group-date-this-morning';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Click This Morning button
            await expenseFormPage.clickThisMorningButton();

            // Should set today's date and show the time field (since it's not noon)
            const today = expenseFormPage.getTodayDateString();
            await expenseFormPage.verifyDateValue(today);
            // TimeInput shows as a button displaying "at {time}" when not editing
            await expenseFormPage.verifyTimeFieldVisible();
        });

        test('should set date and time for Last Night', async ({ authenticatedPage }) => {
            const groupId = 'test-group-date-last-night';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Click Last Night button
            await expenseFormPage.clickLastNightButton();

            // Should set yesterday's date and show the time field (since it's not noon)
            const yesterday = expenseFormPage.getYesterdayDateString();
            await expenseFormPage.verifyDateValue(yesterday);
            // TimeInput shows as a button displaying "at {time}" when not editing
            await expenseFormPage.verifyTimeFieldVisible();
        });
    });

    test.describe('Recent Amounts', () => {
        test('should not show recent amounts section when group has no expenses', async ({ authenticatedPage }) => {
            const groupId = 'test-group-no-recent-amounts';
            // openExpenseFormForTest creates a group with no expenses by default
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();
            await expenseFormPage.verifyRecentAmountsSectionNotVisible();
        });

        test('should show recent amounts from group expenses and fill both currency and amount when clicked', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-recent-amounts';

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

            // Create expenses with different amounts and currencies
            // paidBy must be a valid group member
            const expenses = [
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('50.00', 'USD')
                    .withPaidBy(testUser.uid)
                    .build(),
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('25.50', 'EUR')
                    .withPaidBy(testUser.uid)
                    .build(),
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('1000', 'JPY')
                    .withPaidBy(testUser.uid)
                    .build(),
            ];

            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .withExpenses(expenses)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Verify recent amounts section is visible with amounts from group expenses
            await expenseFormPage.verifyRecentAmountsSectionVisible();
            await expenseFormPage.verifyRecentAmountCount(3);

            // Click on the EUR amount and verify both currency and amount are filled
            // Note: CurrencyIcon has aria-hidden, so accessible name is just number + code
            await expenseFormPage.clickRecentAmount('25.50 EUR');

            await expenseFormPage.expectAmountValue('25.50');
            await expenseFormPage.verifyCurrencyValue('EUR');
        });

        test('should display unique recent amounts from group expenses (up to 3)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-recent-amounts-multiple';

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

            // Create 4 expenses but only 3 unique amount/currency combinations
            // The 4th expense has the same amount/currency as the 1st
            // paidBy must be a valid group member
            const expenses = [
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('10.00', 'USD')
                    .withPaidBy(testUser.uid)
                    .build(),
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('20.00', 'GBP')
                    .withPaidBy(testUser.uid)
                    .build(),
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('30.00', 'EUR')
                    .withPaidBy(testUser.uid)
                    .build(),
                new ExpenseDTOBuilder()
                    .withGroupId(groupId)
                    .withAmount('10.00', 'USD') // Duplicate - should not show twice
                    .withPaidBy(testUser.uid)
                    .build(),
            ];

            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .withExpenses(expenses)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Should show 3 unique amounts (duplicates filtered out)
            await expenseFormPage.verifyRecentAmountsSectionVisible();
            await expenseFormPage.verifyRecentAmountCount(3);
        });
    });

    test.describe('Modal State Reset on Reopen', () => {
        test('should reset form state when modal is closed and reopened', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-modal-reopen';

            const group = GroupDTOBuilder
                .groupForUser(toUserId(testUser.uid))
                .withId(groupId)
                .build();

            const members = [
                new GroupMemberBuilder()
                    .withUid(testUser.uid)
                    .withDisplayName(testUser.displayName)
                    .withGroupDisplayName(testUser.displayName)
                    .build(),
                new GroupMemberBuilder()
                    .withUid('user-2')
                    .withDisplayName('User 2')
                    .withGroupDisplayName('User 2')
                    .build(),
            ];

            const fullDetails = new GroupFullDetailsBuilder()
                .withGroup(group)
                .withMembers(members)
                .build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            // Navigate to group detail page
            const groupDetailPage = new GroupDetailPage(page);
            await groupDetailPage.navigateToGroup(groupId);
            await groupDetailPage.verifyGroupDetailPageLoaded(group.name);

            // First opening - fill in partial data
            const expenseFormPage1 = await groupDetailPage.clickAddExpenseAndOpenForm([testUser.displayName, 'User 2']);
            await expenseFormPage1.verifyFormModalOpen();
            await expenseFormPage1.fillDescription('Previous expense description');
            await expenseFormPage1.fillAmount('42.50');

            // Close the modal without saving
            await expenseFormPage1.clickCancel();
            await expenseFormPage1.expectFormClosed();

            // Second opening - should be clean state
            const expenseFormPage2 = await groupDetailPage.clickAddExpenseAndOpenForm([testUser.displayName, 'User 2']);
            await expenseFormPage2.verifyFormModalOpen();

            // Verify form is reset - description should be empty
            await expenseFormPage2.verifyDescriptionEmpty();

            // Verify participants are all checked by default (the bug was they were unchecked)
            await expenseFormPage2.verifySplitOptionsFirstCheckboxVisible();
            await expenseFormPage2.verifySplitOptionsFirstCheckboxChecked();

            // Verify save button is in expected state (disabled until form is filled)
            await expenseFormPage2.verifySaveButtonDisabled();
        });
    });

    test.describe('Multi-Label Input', () => {
        test('should allow adding a label by typing and pressing Enter', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-typing';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Initially no labels should be selected
            await expenseFormPage.verifyNoLabelsSelected();

            // Add a custom label by typing
            await expenseFormPage.addLabelByTyping('My Custom Label');

            // Verify the label is now selected
            await expenseFormPage.verifyLabelSelected('My Custom Label');
            await expenseFormPage.verifySelectedLabelsCount(1);
        });

        test('should allow adding a label from suggestions dropdown', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-suggestion';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Focus the labels input to open dropdown (focusLabelsInput waits for dropdown)
            await expenseFormPage.focusLabelsInput();

            // Add a suggested label (Groceries is in the suggestedLabels translation array)
            await expenseFormPage.addLabelFromSuggestions('Groceries');

            // Verify the label is selected
            await expenseFormPage.verifyLabelSelected('Groceries');
            await expenseFormPage.verifySelectedLabelsCount(1);
        });

        test('should allow adding up to 3 labels', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-max';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Add first label
            await expenseFormPage.addLabelByTyping('Label One');
            await expenseFormPage.verifySelectedLabelsCount(1);
            await expenseFormPage.verifyLabelsInputVisible();

            // Add second label
            await expenseFormPage.addLabelByTyping('Label Two');
            await expenseFormPage.verifySelectedLabelsCount(2);
            await expenseFormPage.verifyLabelsInputVisible();

            // Add third label
            await expenseFormPage.addLabelByTyping('Label Three');
            await expenseFormPage.verifySelectedLabelsCount(3);

            // Input should now be hidden and max indicator visible
            await expenseFormPage.verifyLabelsInputNotVisible();
            await expenseFormPage.verifyMaxLabelsIndicatorVisible();
        });

        test('should allow removing labels by clicking X button', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-remove';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Add two labels
            await expenseFormPage.addLabelByTyping('First Label');
            await expenseFormPage.addLabelByTyping('Second Label');
            await expenseFormPage.verifySelectedLabelsCount(2);

            // Remove the first label
            await expenseFormPage.removeLabel('First Label');

            // Verify only second label remains
            await expenseFormPage.verifyLabelNotSelected('First Label');
            await expenseFormPage.verifyLabelSelected('Second Label');
            await expenseFormPage.verifySelectedLabelsCount(1);
        });

        test('should filter suggestions based on typed text', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-filter';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Focus input and type partial text
            await expenseFormPage.focusLabelsInput();
            await expenseFormPage.typeLabelText('Groc');

            // Groceries should be visible (matches filter)
            await expenseFormPage.verifyLabelSuggestionVisible('Groceries');
        });

        test('should not show already selected labels in suggestions', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-no-dupe';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Add a label from suggestions
            await expenseFormPage.focusLabelsInput();
            await expenseFormPage.addLabelFromSuggestions('Groceries');

            // Re-focus the input to open the dropdown again
            await expenseFormPage.focusLabelsInput();

            // Groceries should no longer be in suggestions (already selected)
            await expenseFormPage.verifyLabelSuggestionNotVisible('Groceries');

            // But other suggestions should still be visible
            await expenseFormPage.verifyLabelSuggestionVisible('Takeout');
        });

        test('should restore input when max labels removed', async ({ authenticatedPage }) => {
            const groupId = 'test-group-labels-restore';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Add 3 labels to reach max
            await expenseFormPage.addLabelByTyping('One');
            await expenseFormPage.addLabelByTyping('Two');
            await expenseFormPage.addLabelByTyping('Three');

            // Verify at max
            await expenseFormPage.verifyLabelsInputNotVisible();
            await expenseFormPage.verifyMaxLabelsIndicatorVisible();

            // Remove one label
            await expenseFormPage.removeLabel('Two');

            // Input should reappear
            await expenseFormPage.verifyLabelsInputVisible();
            await expenseFormPage.verifySelectedLabelsCount(2);
        });
    });

    test.describe('Location field', () => {
        test('should display location input field', async ({ authenticatedPage }) => {
            const groupId = 'test-group-location';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Location input should be visible
            await expenseFormPage.verifyLocationInputVisible();
            await expenseFormPage.verifyLocationEmpty();
        });

        test('should fill location field', async ({ authenticatedPage }) => {
            const groupId = 'test-group-location-fill';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Fill the location
            await expenseFormPage.fillLocation('Starbucks');

            // Verify the value
            await expenseFormPage.verifyLocationValue('Starbucks');
        });

        test('should clear location field', async ({ authenticatedPage }) => {
            const groupId = 'test-group-location-clear';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Fill the location
            await expenseFormPage.fillLocation('Coffee Shop');
            await expenseFormPage.verifyLocationValue('Coffee Shop');

            // Clear button should be visible when location has value
            await expenseFormPage.verifyClearLocationButtonVisible();

            // Clear the location
            await expenseFormPage.clearLocation();

            // Verify cleared
            await expenseFormPage.verifyLocationEmpty();
        });

        test('should not show clear button when location is empty', async ({ authenticatedPage }) => {
            const groupId = 'test-group-location-no-clear';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // When location is empty, clear button should not be visible
            await expenseFormPage.verifyLocationEmpty();
            await expenseFormPage.verifyClearLocationButtonNotVisible();
        });

        test('should extract place name when pasting a full Google Maps URL', async ({ authenticatedPage }) => {
            const groupId = 'test-group-location-full-url';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Paste a full Google Maps URL with place name embedded
            const mapsUrl = 'https://www.google.com/maps/place/Eiffel+Tower/@48.858844,2.294351,17z';
            await expenseFormPage.pasteIntoLocationField(mapsUrl);

            // Should extract "Eiffel Tower" from the URL
            await expenseFormPage.verifyLocationValue('Eiffel Tower');
            // Should show the "Open on map" button (indicates URL is associated)
            await expenseFormPage.verifyOpenOnMapButtonVisible();
        });

        test('should resolve shortened Google Maps URL via backend API', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const groupId = 'test-group-location-short-url';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            // Mock the resolve redirect API to return a full URL
            const shortUrl = 'https://maps.app.goo.gl/eLBgYkQZPoEweLnZ6';
            const resolvedUrl = 'https://www.google.com/maps/place/Eiffel+Tower/@48.858844,2.294351,17z';
            await mockResolveRedirectApi(page, resolvedUrl);

            await expenseFormPage.waitForExpenseFormSections();

            // Paste a shortened Google Maps URL
            await expenseFormPage.pasteIntoLocationField(shortUrl);

            // Wait for resolution to complete
            await expenseFormPage.waitForLocationResolved();

            // Should have extracted "Eiffel Tower" from the resolved URL
            await expenseFormPage.verifyLocationValue('Eiffel Tower');
            // Should show the "Open on map" button (indicates URL is associated)
            await expenseFormPage.verifyOpenOnMapButtonVisible();
        });

        test('should show fallback text when URL cannot be parsed', async ({ authenticatedPage }) => {
            const { page } = authenticatedPage;
            const groupId = 'test-group-location-fallback';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            // Mock the resolve redirect API to return a URL without a parseable place name
            const shortUrl = 'https://maps.app.goo.gl/abc123';
            const resolvedUrl = 'https://www.google.com/maps/@48.858844,2.294351,17z';
            await mockResolveRedirectApi(page, resolvedUrl);

            await expenseFormPage.waitForExpenseFormSections();

            // Paste a shortened URL that resolves to a URL without a place name
            await expenseFormPage.pasteIntoLocationField(shortUrl);

            // Wait for resolution to complete
            await expenseFormPage.waitForLocationResolved();

            // Should show fallback "Map location" text
            await expenseFormPage.verifyLocationValue('Map location');
            // Should show the "Open on map" button (indicates URL is associated)
            await expenseFormPage.verifyOpenOnMapButtonVisible();
        });
    });

    test.describe('Receipt Upload', () => {
        test('should display receipt section with add button when no receipt', async ({ authenticatedPage }) => {
            const groupId = 'test-group-receipt-initial';
            const { expenseFormPage } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Receipt section should be visible with add button
            await expenseFormPage.verifyReceiptSectionVisible();
            await expenseFormPage.verifyAddReceiptButtonVisible();
            await expenseFormPage.verifyReceiptPreviewNotVisible();
            await expenseFormPage.verifyChangeReceiptButtonNotVisible();
        });

        test('should show change button after selecting a file', async ({ authenticatedPage }) => {
            const groupId = 'test-group-receipt-select';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Valid 1x1 red pixel PNG - renders correctly in browsers
            const pngBuffer = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
                'base64',
            );

            // Set the file on the hidden input
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles({
                name: 'receipt.png',
                mimeType: 'image/png',
                buffer: pngBuffer,
            });

            // After selecting, add button should be hidden and change button visible
            await expenseFormPage.verifyAddReceiptButtonNotVisible();
            await expenseFormPage.verifyChangeReceiptButtonVisible();
        });

        test('should show error for invalid file type', async ({ authenticatedPage }) => {
            const groupId = 'test-group-receipt-invalid-type';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Try to upload a text file (invalid type)
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles({
                name: 'document.txt',
                mimeType: 'text/plain',
                buffer: Buffer.from('This is not an image'),
            });

            // Error should be displayed
            await expenseFormPage.verifyReceiptErrorVisible();
            await expenseFormPage.verifyReceiptErrorContains('JPEG, PNG, and WebP');

            // Preview should not be shown, add button should still be visible
            await expenseFormPage.verifyReceiptPreviewNotVisible();
            await expenseFormPage.verifyAddReceiptButtonVisible();
        });

        test('should show error for file that is too large', async ({ authenticatedPage }) => {
            const groupId = 'test-group-receipt-too-large';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.waitForExpenseFormSections();

            // Create a buffer larger than 10MB (11MB)
            const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
            // Add minimal PNG header to pass type check
            const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            pngHeader.copy(largeBuffer);

            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles({
                name: 'large-receipt.png',
                mimeType: 'image/png',
                buffer: largeBuffer,
            }, { timeout: 10000 });

            // Error should be displayed
            await expenseFormPage.verifyReceiptErrorVisible();
            await expenseFormPage.verifyReceiptErrorContains('10MB');

            // Preview should not be shown
            await expenseFormPage.verifyReceiptPreviewNotVisible();
        });
    });
});
