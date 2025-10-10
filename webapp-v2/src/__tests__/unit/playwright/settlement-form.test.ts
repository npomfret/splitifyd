import { GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementFormPage } from '@splitifyd/test-support';
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

test.describe('Settlement Form Validation', () => {
    test('should keep submit button disabled with only payer pre-selected', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-default';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await expect(settlementFormPage.getRecordPaymentButton()).toBeDisabled();
    });

    test('should keep submit button disabled without payee selection', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-no-payee';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await settlementFormPage.fillAmount('50.00');
        await settlementFormPage.selectCurrency('USD');

        await expect(settlementFormPage.getRecordPaymentButton()).toBeDisabled();
    });

    test('should keep submit button disabled without amount', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-no-amount';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await settlementFormPage.selectCurrency('USD');
        await settlementFormPage.selectPayee('User 2');

        await expect(settlementFormPage.getRecordPaymentButton()).toBeDisabled();
    });

    test('should keep submit button disabled without currency', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-no-currency';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await settlementFormPage.selectPayee('User 2');

        await expect(settlementFormPage.getRecordPaymentButton()).toBeDisabled();
    });

    test('should enable submit button when all fields are filled', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-validation';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        const submitButton = settlementFormPage.getRecordPaymentButton();
        await expect(submitButton).toBeDisabled();

        await settlementFormPage.selectCurrency('GBP');
        await expect(submitButton).toBeDisabled();

        await settlementFormPage.selectPayee('User 2');
        await expect(submitButton).toBeDisabled();

        await settlementFormPage.fillAmount('50.00');
        await expect(submitButton).toBeEnabled();
    });

    test('should close modal when close button (X) is clicked', async ({ authenticatedPage }) => {
        const { page, user: testUser } = authenticatedPage;
        const groupId = 'test-group-close';

        const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
        const members = [
            new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
            new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
        ];
        const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        const settlementFormPage = new SettlementFormPage(page);
        await settlementFormPage.navigateAndOpen(groupId);

        await settlementFormPage.clickCloseButton();

        await expect(settlementFormPage.getModal()).not.toBeVisible();
    });
});
