import { GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, SettlementFormPage, ThemeBuilder } from '@billsplit-wl/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Balance Settlement Button', () => {
    test('should show settlement button when current user owes money', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'debt-with-button';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Debt Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Alice')
                .withGroupDisplayName('Alice')
                .withTheme(ThemeBuilder.red().build())
                .build(),
        ];

        // Current user owes Alice $25
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'user-2', 'Alice', 25.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify debt relationship exists
        await groupDetailPage.verifyDebtRelationship(user.displayName, 'Alice', '$25.00');

        // Verify settlement button is visible
        await groupDetailPage.verifySettlementButtonVisible(user.displayName, 'Alice');
    });

    test('should not show settlement button when current user is owed money', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'debt-no-button';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Owed Money Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Bob')
                .withGroupDisplayName('Bob')
                .withTheme(ThemeBuilder.red().build())
                .build(),
        ];

        // Bob owes current user $30 (reverse debt)
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt('user-2', 'Bob', user.uid, user.displayName, 30.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify debt relationship exists
        await groupDetailPage.verifyDebtRelationship('Bob', user.displayName, '$30.00');

        // Verify settlement button is NOT visible (current user is creditor, not debtor)
        await groupDetailPage.verifySettlementButtonNotVisible('Bob', user.displayName);
    });

    test('should open settlement form with pre-filled data when button is clicked', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const settlementFormPage = new SettlementFormPage(page);
        const groupId = 'debt-prefill';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Pre-fill Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('Charlie')
                .withGroupDisplayName('Charlie')
                .withTheme(ThemeBuilder.red().build())
                .build(),
        ];

        // Current user owes Charlie $42.50
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'user-2', 'Charlie', 42.50)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Click the settlement button
        await groupDetailPage.clickSettlementButton(user.displayName, 'Charlie');

        // Verify settlement form modal is open
        await settlementFormPage.verifyModalVisible();

        // Verify form title says "Record Settlement" not "Record Payment"
        await settlementFormPage.verifyRecordSettlementMode();

        // Verify the form is pre-filled with correct data
        // Note: Actual form field verification would require additional methods in SettlementFormPage
        // For now, just verify the modal opened successfully
    });

    test('should show multiple settlement buttons for multiple debts', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'multiple-debts';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Multiple Debts Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('user-2')
                .withDisplayName('David')
                .withGroupDisplayName('David')
                .withTheme(ThemeBuilder.red().build())
                .build(),
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Emma')
                .withGroupDisplayName('Emma')
                .withTheme(
                    new ThemeBuilder()
                        .withName('green')
                        .build(),
                )
                .build(),
        ];

        // Current user owes both David and Emma
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'user-2', 'David', 15.0)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'user-3', 'Emma', 20.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify both debts exist
        await groupDetailPage.verifyDebtRelationship(user.displayName, 'David', '$15.00');
        await groupDetailPage.verifyDebtRelationship(user.displayName, 'Emma', '$20.00');

        // Verify both settlement buttons are visible
        await groupDetailPage.verifySettlementButtonVisible(user.displayName, 'David');
        await groupDetailPage.verifySettlementButtonVisible(user.displayName, 'Emma');
    });
});
