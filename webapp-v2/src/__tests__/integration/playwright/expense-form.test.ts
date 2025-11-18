import type { Page } from '@playwright/test';
import type { GroupId } from '@billsplit-wl/shared';
import { DisplayName } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';
import { ExpenseFormPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@billsplit-wl/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

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
        .groupForUser(testUser.uid)
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

            await expenseFormPage.verifyPageLoaded();
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
            await expenseFormPage.expectCurrencySelectionDisplays('$', 'USD');

            await expenseFormPage.selectCurrency('CAD');
            await expenseFormPage.expectCurrencySelectionDisplays('$', 'CAD');
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
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
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
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
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
            await expenseFormPage.verifyAmountErrorMessageContains('Amount is required');
            await expenseFormPage.expectAmountValue('');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should require amount greater than zero', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-amount-positive';
            const { expenseFormPage, page } = await openExpenseFormForTest(authenticatedPage, groupId);

            await expenseFormPage.fillDescription('Zero amount');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.fillAmount('0');
            await expenseFormPage.verifyAmountErrorMessageContains('Amount must be greater than 0');
            await expenseFormPage.expectAmountValue('0');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
            await expectNoGlobalError(expenseFormPage);
        });

        test('should require currency selection before submitting', async ({ authenticatedPage }) => {
            const groupId = 'test-group-validation-currency-required';
            const { expenseFormPage, page, testUser } = await openExpenseFormForTest(authenticatedPage, groupId, [
                { uid: 'user-2', displayName: toDisplayName('User 2') },
            ]);

            await expenseFormPage.fillDescription('Currency required');
            await expenseFormPage.fillAmount('25');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2']);
            await expenseFormPage.expectSaveButtonEnabled();
            await expenseFormPage.submitForm();
            await expenseFormPage.verifyAmountErrorMessageContains('Currency is required');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
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
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
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
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
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

            await expenseFormPage.verifyAmountErrorMessageContains('Amount seems too large');
            await expenseFormPage.expectAmountValue('1000001');
            await expenseFormPage.expectFormOpen();
            await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/add-expense`));
            await expectNoGlobalError(expenseFormPage);
        });
    });
});
