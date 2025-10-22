import type { Page } from '@playwright/test';
import { GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementFormPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

type MemberSeed = {
    uid: string;
    displayName: string;
    groupDisplayName?: string;
};

async function expectNoGlobalError(page: Page): Promise<void> {
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await expect(page.getByText(/ErrorBoundary caught an error/i)).toHaveCount(0);
}

async function openSettlementFormForTest(
    authenticatedPage: { page: Page; user: { uid: string; displayName: string; }; },
    groupId: string,
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
        ...additionalMembers.map((member) =>
            new GroupMemberBuilder()
                .withUid(member.uid)
                .withDisplayName(member.displayName)
                .withGroupDisplayName(member.groupDisplayName ?? member.displayName)
                .build(),
        ),
    ];

    const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

    await mockGroupDetailApi(page, groupId, fullDetails);
    await mockGroupCommentsApi(page, groupId);

    const settlementFormPage = new SettlementFormPage(page);
    await settlementFormPage.navigateAndOpen(groupId);

    return { settlementFormPage, page, testUser };
}

test.describe('Settlement Form Validation', () => {
    test('should keep submit button disabled with only payer pre-selected', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-default');
        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without payee selection', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-no-payee');

        await settlementFormPage.fillAmount('50.00');
        await settlementFormPage.selectCurrency('USD');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without amount', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-no-amount');

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should keep submit button disabled without currency', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-no-currency');

        await settlementFormPage.selectPayee('User 2');

        await settlementFormPage.expectSubmitDisabled();
    });

    test('should enable submit button when all fields are filled', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-validation');

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
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, 'test-group-zero-amount');

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('0');

        await settlementFormPage.submitExpectValidationError('Please enter a valid amount greater than 0');
        await expectNoGlobalError(page);
    });

    test('should show validation error when amount exceeds maximum', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, 'test-group-amount-too-large');

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('1000000');

        await settlementFormPage.submitExpectValidationError('Amount cannot exceed 999,999.99');
        await expectNoGlobalError(page);
    });

    test('should show validation error when date is in the future', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, 'test-group-future-date');

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('40.00');
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await settlementFormPage.setDate(tomorrow);

        await settlementFormPage.submitExpectValidationError('Date cannot be in the future');
        await expectNoGlobalError(page);
    });

    test('should keep submit button disabled when amount precision exceeds currency limit', async ({ authenticatedPage }) => {
        const { settlementFormPage, page } = await openSettlementFormForTest(authenticatedPage, 'test-group-precision');

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');
        await settlementFormPage.fillAmount('10.123');

        await settlementFormPage.expectSubmitDisabled();
        await settlementFormPage.expectAmountValue('10.123');
        await expectNoGlobalError(page);
    });

    test('should close modal when close button (X) is clicked', async ({ authenticatedPage }) => {
        const { settlementFormPage } = await openSettlementFormForTest(authenticatedPage, 'test-group-close');

        await settlementFormPage.clickCloseButton();

        await settlementFormPage.expectModalClosed();
    });
});
