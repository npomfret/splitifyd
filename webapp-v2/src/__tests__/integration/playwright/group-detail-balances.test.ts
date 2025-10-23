import { ExpenseDTOBuilder, GroupBalancesBuilder, GroupDetailPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder, ThemeBuilder } from '@splitifyd/test-support';
import translationEn from '../../../locales/en/translation.json' with { type: 'json' };
import { expect, test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

test.describe('Group Detail - Balance Display: All Settled Up', () => {
    test('should show "All settled up" message when no debts exist', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'settled-group';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Settled Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify "All settled up!" message is displayed using POM method
        await groupDetailPage.verifySettledUp();
    });

    test('should show "All settled up" with multiple members when no expenses exist', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'multi-member-settled';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Multi Member Settled')
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
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Bob')
                .withGroupDisplayName('Bob')
                .withTheme(
                    new ThemeBuilder()
                        .withName('green')
                        .build(),
                )
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify "All settled up!" message using POM method
        await groupDetailPage.verifySettledUp();

        // Verify no debt items are present using POM method
        await expect(groupDetailPage.getDebtItems()).toHaveCount(0);
    });
});

test.describe('Group Detail - Balance Display: With Debts', () => {
    test('should display debt items when balances exist', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'simple-debt-group';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Simple Debt Group')
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

        // Verify specific debt relationship
        await groupDetailPage.verifyDebtRelationship(user.displayName, 'Alice', '$25.00 USD');
    });

    test('should display reversed debt relationship', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'reversed-debt';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Reversed Debt Group')
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

        // Alice owes the test user
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt('user-2', 'Alice', user.uid, user.displayName, 30.0)
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

        // Verify specific reversed debt relationship
        await groupDetailPage.verifyDebtRelationship('Alice', user.displayName, '$30.00 USD');
    });
});

test.describe('Group Detail - Balance Display: Complex Multi-Person Debts', () => {
    test('should display multiple debt relationships in three-person group', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'three-person-debts';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Three Person Group')
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
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Bob')
                .withGroupDisplayName('Bob')
                .withTheme(
                    new ThemeBuilder()
                        .withName('green')
                        .build(),
                )
                .build(),
        ];

        // Create complex debt scenario:
        // Test user owes Alice $20
        // Bob owes Test user $15
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt(user.uid, user.displayName, 'user-2', 'Alice', 20.0)
            .withSimpleTwoPersonDebt('user-3', 'Bob', user.uid, user.displayName, 15.0)
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

        // Verify both specific debt relationships
        await groupDetailPage.verifyDebtRelationship(user.displayName, 'Alice', '$20.00 USD');
        await groupDetailPage.verifyDebtRelationship('Bob', user.displayName, '$15.00 USD');
    });

    test('should display simplified debts after optimization', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'optimized-debts';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Optimized Debts Group')
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
            new GroupMemberBuilder()
                .withUid('user-3')
                .withDisplayName('Bob')
                .withGroupDisplayName('Bob')
                .withTheme(
                    new ThemeBuilder()
                        .withName('green')
                        .build(),
                )
                .build(),
        ];

        // Simplified/optimized debt: Bob owes Alice $10 (direct)
        // This represents the simplified result after debt optimization
        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt('user-3', 'Bob', 'user-2', 'Alice', 10.0)
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

        // Default view should hide debts that don't involve the current user
        await expect(groupDetailPage.getSettledUpMessage()).toBeVisible();
        await expect(groupDetailPage.getDebtItems()).toHaveCount(0);

        // Enable "Show all" filter since the current user is not involved in this debt
        await groupDetailPage.toggleShowAllBalances(true);

        await expect(groupDetailPage.getSettledUpMessage()).not.toBeVisible();

        // Verify specific optimized debt relationship
        await groupDetailPage.verifyDebtRelationship('Bob', 'Alice', '$10.00 USD');
    });
});

test.describe('Group Detail - Balance Display: Loading States', () => {
    test('should show balances section on page load', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'loading-group';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Loading Group')
            .build();

        const members = [
            new GroupMemberBuilder()
                .withUid(user.uid)
                .withDisplayName(user.displayName)
                .withGroupDisplayName(user.displayName)
                .withTheme(ThemeBuilder.blue().build())
                .build(),
        ];

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);

        // Verify balances section is visible using POM method
        await expect(groupDetailPage.getBalanceContainer()).toBeVisible();

        // Verify heading using POM method
        await expect(groupDetailPage.getBalanceSummaryHeading()).toBeVisible();
    });
});

test.describe('Group Detail - Balance Display: With Expenses', () => {
    test('should display balances reflecting expense split', async ({ authenticatedPage }) => {
        const { page, user } = authenticatedPage;
        const groupDetailPage = new GroupDetailPage(page);
        const groupId = 'expense-balances';

        const group = GroupDTOBuilder
            .groupForUser(user.uid)
            .withId(groupId)
            .withName('Expense Balances Group')
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

        // Test user paid $100, split equally with Alice
        // So Alice owes test user $50
        const expenses = [
            new ExpenseDTOBuilder()
                .withId('expense-1')
                .withDescription('Dinner')
                .withAmount(100.0, 'USD')
                .withPaidBy(user.uid)
                .withGroupId(groupId)
                .build(),
        ];

        const balances = new GroupBalancesBuilder()
            .withGroupId(groupId)
            .withSimpleTwoPersonDebt('user-2', 'Alice', user.uid, user.displayName, 50.0)
            .build();

        const fullDetails = new GroupFullDetailsBuilder()
            .withGroup(group)
            .withMembers(members)
            .withExpenses(expenses)
            .withBalances(balances)
            .build();

        await mockGroupDetailApi(page, groupId, fullDetails);
        await mockGroupCommentsApi(page, groupId);

        await groupDetailPage.navigateToGroup(groupId);
        await groupDetailPage.waitForGroupToLoad();

        // Verify specific debt from expense split
        await groupDetailPage.verifyDebtRelationship('Alice', user.displayName, '$50.00 USD');
    });
});
