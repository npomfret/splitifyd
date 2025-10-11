import { ExpenseFormPage, GroupDTOBuilder, GroupFullDetailsBuilder, GroupMemberBuilder } from '@splitifyd/test-support';
import { test } from '../../utils/console-logging-fixture';
import { mockGroupCommentsApi, mockGroupDetailApi } from '../../utils/mock-firebase-service';

test.describe('Expense Form', () => {
    test.describe('Page Loading', () => {
        test('should display expense form page correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [new GroupMemberBuilder().withUid(testUser.uid).build()];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.verifyPageLoaded();
        });
    });

    test.describe('Equal Split Recalculation', () => {
        test('should recalculate EQUAL splits when amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-split';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$33.33');
            await expenseFormPage.verifyEqualSplitsContainAmount('$33.34');

            await expenseFormPage.fillAmount('150');

            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('$33.33');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('$33.34');
        });

        test('should recalculate EQUAL splits with 2 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-2';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');
        });

        test('should recalculate EQUAL splits with 4 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-equal-4';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
                new GroupMemberBuilder().withUid('user-4').withDisplayName('User 4').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$25.00');
        });
    });

    test.describe('Currency Handling', () => {
        test('should recalculate splits when currency changes (USD to JPY)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-usd-jpy';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');

            await expenseFormPage.selectCurrency('JPY');

            await expenseFormPage.verifyEqualSplitsContainAmount('¥50');
            await expenseFormPage.verifyEqualSplitsDoNotContainAmount('¥50.00');
        });

        test('should recalculate splits when currency changes (JPY to USD)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-jpy-usd';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500');

            await expenseFormPage.selectCurrency('USD');

            await expenseFormPage.verifyEqualSplitsContainAmount('$500.00');
        });

        test('should recalculate splits when currency changes (USD to EUR)', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-currency-usd-eur';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');

            await expenseFormPage.selectCurrency('EUR');

            await expenseFormPage.verifyEqualSplitsContainAmount('€50.00');
        });
    });

    test.describe('Exact Split Recalculation', () => {
        test('should recalculate EXACT splits when amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-split';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyExactSplitInputsHaveValue('50');

            await expenseFormPage.fillAmount('200');

            await expenseFormPage.verifyExactSplitInputsHaveValue('100');
            await expenseFormPage.verifyExactSplitTotal('$200.00', '$200.00');
        });

        test('should recalculate EXACT splits with 3 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-3';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyExactSplitInputsHaveValue('50');
        });

        test('should recalculate EXACT splits when currency changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-currency';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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

            await expenseFormPage.verifyExactSplitInputsHaveValue('50');
            await expenseFormPage.verifyExactSplitTotal('$100.00', '$100.00');

            await expenseFormPage.selectCurrency('JPY');

            await expenseFormPage.verifyExactSplitTotal('¥100', '¥100');
        });
    });

    test.describe('Split Type Switching', () => {
        test('should switch from EQUAL to EXACT split type', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-switch-equal-exact';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');

            await expenseFormPage.selectSplitType('Exact amounts');

            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputCount(2);
            await expenseFormPage.verifyExactSplitInputsHaveValue('50');
        });

        test('should switch from EXACT to EQUAL split type', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-switch-exact-equal';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');
        });
    });

    test.describe('Decimal Amount Handling', () => {
        test('should handle decimal amounts correctly in equal splits', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-decimal';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');
        });

        test('should handle amounts with 3 decimal places', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-3-decimals';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

            await mockGroupDetailApi(page, groupId, fullDetails);
            await mockGroupCommentsApi(page, groupId);

            const expenseFormPage = new ExpenseFormPage(page);
            await expenseFormPage.navigateToAddExpense(groupId);

            await expenseFormPage.fillDescription('3 Decimal Test');
            await expenseFormPage.fillAmount('100.001');
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.selectPayer(testUser.displayName);
            await expenseFormPage.selectSplitParticipants(['User 2', 'User 3']);

            await expenseFormPage.verifyEqualSplitDisplayed();
            // Should round to 2 decimal places: $100.00 ÷ 3
            await expenseFormPage.verifyEqualSplitsContainAmount('$33.33');
        });
    });

    test.describe('Large Numbers', () => {
        test('should handle large amounts correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-large';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$500,000.00');
        });
    });

    test.describe('Many Participants', () => {
        test('should recalculate splits with 5 members', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-5-members';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
                new GroupMemberBuilder().withUid('user-4').withDisplayName('User 4').build(),
                new GroupMemberBuilder().withUid('user-5').withDisplayName('User 5').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$20.00');
        });
    });

    test.describe('Sequential Multiple Changes', () => {
        test('should handle rapid consecutive amount changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-rapid-changes';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');

            // Change 2
            await expenseFormPage.fillAmount('200');
            await expenseFormPage.verifyEqualSplitsContainAmount('$100.00');

            // Change 3
            await expenseFormPage.fillAmount('75');
            await expenseFormPage.verifyEqualSplitsContainAmount('$37.50');

            // Change 4
            await expenseFormPage.fillAmount('150');
            await expenseFormPage.verifyEqualSplitsContainAmount('$75.00');
        });

        test('should handle complex multi-step changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-complex-changes';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$50.00');

            // Change to JPY
            await expenseFormPage.selectCurrency('JPY');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥50');

            // Change amount
            await expenseFormPage.fillAmount('1000');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500');

            // Switch to Exact amounts
            await expenseFormPage.selectSplitType('Exact amounts');
            await expenseFormPage.verifyExactSplitDisplayed();
            await expenseFormPage.verifyExactSplitInputsHaveValue('500');

            // Back to Equal
            await expenseFormPage.selectSplitType('Equal');
            await expenseFormPage.verifyEqualSplitsContainAmount('¥500');

            // Back to USD
            await expenseFormPage.selectCurrency('USD');
            await expenseFormPage.verifyEqualSplitsContainAmount('$500.00');
        });
    });

    test.describe('Edge Case Amounts', () => {
        test('should handle amounts that do not divide evenly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-uneven';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
                new GroupMemberBuilder().withUid('user-3').withDisplayName('User 3').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$3.33');
            await expenseFormPage.verifyEqualSplitsContainAmount('$3.34');
        });

        test('should handle very small amounts', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-small';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('$0.01');
        });
    });

    test.describe('Multiple Currencies', () => {
        test('should handle GBP correctly', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-gbp';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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
            await expenseFormPage.verifyEqualSplitsContainAmount('£50.00');
        });
    });

    test.describe('Exact Split Advanced', () => {
        test('should recalculate exact split total display when currency changes', async ({ authenticatedPage }) => {
            const { page, user: testUser } = authenticatedPage;
            const groupId = 'test-group-exact-curr-adv';

            const group = GroupDTOBuilder.groupForUser(testUser.uid).withId(groupId).build();
            const members = [
                new GroupMemberBuilder().withUid(testUser.uid).withDisplayName(testUser.displayName).build(),
                new GroupMemberBuilder().withUid('user-2').withDisplayName('User 2').build(),
            ];
            const fullDetails = new GroupFullDetailsBuilder().withGroup(group).withMembers(members).build();

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

            await expenseFormPage.verifyExactSplitTotal('$200.00', '$200.00');

            await expenseFormPage.selectCurrency('EUR');
            await expenseFormPage.verifyExactSplitTotal('€200.00', '€200.00');
        });
    });
});
