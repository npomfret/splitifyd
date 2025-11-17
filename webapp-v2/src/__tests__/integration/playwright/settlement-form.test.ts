import type { Page } from '@playwright/test';
import type { GroupId } from '@splitifyd/shared';
import { DisplayName } from '@splitifyd/shared';
import { toGroupId } from '@splitifyd/shared';
import { GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementFormPage, ThemeBuilder } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

type MemberSeed = {
    uid: string;
    displayName: DisplayName;
    groupDisplayName?: string;
};

async function expectNoGlobalError(settlementFormPage: SettlementFormPage): Promise<void> {
    await settlementFormPage.expectNoGlobalErrors();
}

async function openSettlementFormForTest(
    authenticatedPage: { page: Page; user: { uid: string; displayName: DisplayName; }; },
    groupId: GroupId,
    additionalMembers: MemberSeed[] = [{ uid: 'user-2', displayName: 'User 2' }],
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

    const settlementFormPage = new SettlementFormPage(page);
    await settlementFormPage.navigateAndOpen(groupId);

    return { settlementFormPage, page, testUser };
}

test.describe('Settlement Form Validation', () => {
    test('should display symbol and code in currency selector button', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-currency-display'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.expectCurrencySelectionDisplays('$', 'USD');

        await settlementFormPage.selectCurrency('CAD');
        await settlementFormPage.expectCurrencySelectionDisplays('$', 'CAD');
    });

    test('should keep submit button disabled with only payer pre-selected', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-default'));
        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without payee selection', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-no-payee'));

        await settlementFormPage.fillAmount('50.00');
        await settlementFormPage.selectCurrency('USD');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without amount', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-no-amount'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without currency', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-no-currency'));

        await settlementFormPage.selectPayee('User 2');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should enable submit button when all fields are filled', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-validation'));

        await settlementFormPage.expectSubmitDisabled();

        await settlementFormPage.selectCurrency('GBP');
        await settlementFormPage.expectSubmitDisabled();

        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.expectSubmitDisabled();

        await settlementFormPage.fillAmount('50.00');
        await settlementFormPage.expectSubmitEnabled();
    });

    // Note: The test "should show validation error when payer and payee are the same" was removed
    // because this scenario cannot occur in the UI. The payee dropdown actively filters out the
    // currently selected payer, making it impossible to select the same person for both roles.
    // When the payer is changed to match the current payee, the payee selection is automatically
    // cleared. The validation logic at lines 211-213 in SettlementForm.tsx exists as a safety check
    // but cannot be reached through normal UI interaction.

    test('should show validation error when amount is zero', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-zero-amount'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('0');

        await settlementFormPage.submitExpectValidationError('Please enter a valid amount greater than 0');
        await expectNoGlobalError(settlementFormPage);
    });

    test('should show validation error when amount exceeds maximum', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-amount-too-large'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('1000000');

        await settlementFormPage.submitExpectValidationError('Amount cannot exceed 999,999.99');
        await expectNoGlobalError(settlementFormPage);
    });

    test('should show validation error when date is in the future', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-future-date'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('40.00');
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await settlementFormPage.setDate(tomorrow);

        await settlementFormPage.submitExpectValidationError('Date cannot be in the future');
        await expectNoGlobalError(settlementFormPage);
    });

    test('should keep submit button disabled when amount precision exceeds currency limit', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-precision'));

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('10.123');

        const precisionError = settlementFormPage.getAmountErrorMessage();
        await expect(precisionError).toContainText('decimal place');
        await settlementFormPage.expectSubmitDisabled();
        await settlementFormPage.expectAmountValue('10.123');

        await settlementFormPage.fillAmount('10.12');
        await settlementFormPage.expectAmountValue('10.12');
        await expect(settlementFormPage.getAmountErrorMessage()).toHaveCount(0);

        await expectNoGlobalError(settlementFormPage);
    });

    test('should close modal when close button (X) is clicked', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, toGroupId('test-group-close'));

        await settlementFormPage.clickCloseButton();

        await settlementFormPage.expectModalClosed();
    });
});

test.describe('Settlement Form - Warning Message Bug (Reproduce)', () => {
    /**
     * This test reproduces a bug where the settlement form incorrectly shows a warning
     * that "payer does not owe payee any money" even when the payer DOES owe money to the payee.
     *
     * The bug occurs in SettlementForm.tsx getCurrentDebt() function which only checks
     * if payer owes payee, but the warning logic doesn't correctly handle this case.
     *
     * Expected behavior:
     * - When Bill Splitter owes Han Solo €84.79, and tries to record a settlement of €84.79,
     *   NO warning should appear (this is a valid settlement matching the debt)
     *
     * Actual behavior (bug):
     * - The warning appears incorrectly: "Bill Splitter does not owe Han Solo any money in EUR.
     *   This settlement will create a debt in the opposite direction."
     */
    test('should NOT show warning when payer owes exact debt amount to payee', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'test-settlement-warning-bug';

        // Setup: Create a group where current user (Bill Splitter) owes €84.79 to Han Solo
        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Large Group')
            .build();

        const billSplitter = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName) // "Bill Splitter (You)"
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const hanSolo = new GroupMemberBuilder()
            .withUid('han-solo-uid')
            .withDisplayName('Han Solo')
            .withGroupDisplayName('Han Solo')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const members = [billSplitter, hanSolo];

        // Bill Splitter owes Han Solo €84.79
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(
                user.uid, // from: Bill Splitter
                user.displayName,
                'han-solo-uid', // to: Han Solo
                'Han Solo',
                84.79, // amount owed
                'EUR', // currency
            )
            .withBalancesByCurrency({
                'EUR': {
                    [user.uid]: {
                        uid: user.uid,
                        owes: { 'han-solo-uid': '84.79' },
                        owedBy: {},
                        netBalance: '-84.79',
                    },
                    'han-solo-uid': {
                        uid: 'han-solo-uid',
                        owes: {},
                        owedBy: { [user.uid]: '84.79' },
                        netBalance: '84.79',
                    },
                },
            })
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        // Fill the form: Bill Splitter (payer) pays Han Solo (payee) €84.79
        await settlementFormPage.selectCurrency('EUR');
        await settlementFormPage.selectPayee('Han Solo');
        await settlementFormPage.fillAmount('84.79');

        // BUG: The warning message appears even though this is a valid settlement
        // This assertion will FAIL due to the bug - the warning incorrectly appears
        await settlementFormPage.verifyWarningMessageNotVisible();

        // The form should be valid and submittable without warnings
        await settlementFormPage.expectSubmitEnabled();

        await expectNoGlobalError(settlementFormPage);
    });
});

test.describe('Settlement Form - Quick Settle Shortcuts', () => {
    test('shows quick settle shortcuts when opened from Group Actions', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'quick-settle-actions';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Quick Settle Group')
            .build();

        const debtorMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const creditorMember = new GroupMemberBuilder()
            .withUid('member-2')
            .withDisplayName('Alexandra Verylongname')
            .withGroupDisplayName('Alexandra Verylongname')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'member-2', 'Alexandra Verylongname', 37.25)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([debtorMember, creditorMember])
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Wait for balances to load - just check the balance summary card exists
        await expect(groupDetailPage.getBalanceContainerLocator()).toBeAttached();

        // Click the Settle Up button from Group Actions (not the balance summary button)
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(2, { waitForFormReady: true });

        await settlementFormPage.verifyQuickSettleHeadingVisible();

        // The name may be truncated in the UI, so match the beginning and amount
        await settlementFormPage.verifyQuickSettleShortcutButtonVisible(/\$37\.25\s*.*→\s*Alexandra Very/);
    });

    test('hides quick settle shortcuts when modal is pre-filled from balances', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'quick-settle-prefilled';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Prefilled Quick Settle Group')
            .build();

        const debtorMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const creditorMember = new GroupMemberBuilder()
            .withUid('member-2')
            .withDisplayName('Alexandra Verylongname')
            .withGroupDisplayName('Alexandra Verylongname')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'member-2', 'Alexandra Verylongname', 37.25)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([debtorMember, creditorMember])
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const groupDetailPage = new GroupDetailPage(page);
        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        const debtButton = groupDetailPage.getSettlementButtonForDebtLocator(user.displayName, 'Alexandra Verylongname');
        await debtButton.click();

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.verifyModalVisible();

        await settlementFormPage.verifyQuickSettleHeadingNotVisible();
        await settlementFormPage.verifyQuickSettleShortcutButtonNotVisible(/\$37\.25\s*→\s*Alexandra Verylongname/);
    });
});

test.describe('Settlement Form - Amount Warnings', () => {
    test('shows polite warning when settling less than the outstanding debt', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupId = 'settlement-underpayment-warning';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Underpayment Group')
            .build();

        const debtorMember = new GroupMemberBuilder()
            .withUid(user.uid)
            .withDisplayName(user.displayName)
            .withGroupDisplayName(user.displayName)
            .withTheme(ThemeBuilder.blue().build())
            .build();

        const creditorMember = new GroupMemberBuilder()
            .withUid('member-2')
            .withDisplayName('Alexandra Verylongname')
            .withGroupDisplayName('Alexandra Verylongname')
            .withTheme(ThemeBuilder.red().build())
            .build();

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'member-2', 'Alexandra Verylongname', 50.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers([debtorMember, creditorMember])
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('Alexandra Verylongname');
        await settlementFormPage.fillAmount('10.00');

        const warning = settlementFormPage.getSettlementWarningMessage();
        await expect(warning).toContainText('still owe');

        await settlementFormPage.fillAmount('50.00');
        await expect(settlementFormPage.getSettlementWarningMessage()).toHaveCount(0);
        await expectNoGlobalError(settlementFormPage);
    });
});
