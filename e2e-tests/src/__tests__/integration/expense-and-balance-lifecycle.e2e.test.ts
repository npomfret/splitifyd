import { CreateGroupFormDataBuilder, ExpenseFormDataBuilder, generateShortId, SettlementFormDataBuilder } from '@splitifyd/test-support';
import { expect, simpleTest } from '../../fixtures';
import { groupDetailUrlPattern } from '../../pages/group-detail.page';
import { ExpenseFormPage as E2EExpenseFormPage } from '../../pages/expense-form.page';

/**
 * Consolidated Expense and Balance Lifecycle E2E Tests
 *
 * CONSOLIDATION: Merged overlapping tests from:
 * - expense-comprehensive.e2e.test.ts (expense creation, currency, CRUD)
 * - balance-and-settlements-comprehensive.e2e.test.ts (balance calculations)
 * - expense-features.e2e.test.ts (date/time selection, comments)
 * - settlement-operations.e2e.test.ts (settlement CRUD operations)
 *
 * This file covers the complete lifecycle of expenses and their impact on balances,
 * eliminating redundancy while maintaining comprehensive coverage of:
 * - Expense creation with various currencies and precision
 * - Date/time selection functionality
 * - Real-time comments system
 * - Balance calculations and debt relationships
 * - Settlement integration with balance updates and CRUD operations
 * - Multi-currency handling across expenses and balances
 */

simpleTest.describe('Expense and Balance Lifecycle - Comprehensive Integration', () => {
    simpleTest('should handle complete expense lifecycle with balance calculations and settlement', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Step 1: Create group and verify initial state (settled up)
        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );
        const groupId = groupDetailPage1.inferGroupId();

        // Step 2: Create expense with EUR currency and verify balance calculation
        const expenseDescription = `Lifecycle Test ${generateShortId()}`;
        const expenseFormPage = await groupDetailPage1.clickAddExpenseAndOpenForm(
            await groupDetailPage1.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(100, 'EUR')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('EUR')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        // Verify expense appears and balance is calculated correctly (€50 each)
        await groupDetailPage1.waitForExpense(expenseDescription);
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00 EUR');

        // Step 3: Edit the expense and verify balance updates
        const expenseDetailPage = await groupDetailPage1.clickExpenseToView(expenseDescription);
        const editFormPage = await expenseDetailPage.clickEditExpenseAndReturnForm(
            [user1DisplayName, user2DisplayName],
            (page) => new E2EExpenseFormPage(page),
        );
        const updatedDescription = `Updated ${generateShortId()}`;

        await editFormPage.fillDescription(updatedDescription);
        await editFormPage.fillAmount('150.00');
        await editFormPage.clickUpdateExpenseButton();

        await expenseDetailPage.waitForExpenseDescription(updatedDescription);
        await expenseDetailPage.waitForCurrencyAmount('€150.00');

        // Navigate back to group to verify updated balance (€75.00 each)
        await expenseDetailPage.page.goto(`/groups/${groupId}`);
        await groupDetailPage1.waitForPage(groupId, 2);
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€75.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€75.00 EUR');

        // Step 4: Record partial settlement and verify balance update
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user2DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(50.00, 'EUR')
                .withNote('Partial settlement test')
                .build(),
            2,
        );

        // Verify partial settlement reduces debt (€75.00 - €50.00 = €25.00)
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€25.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€25.00 EUR');

        // Step 5: Delete expense and verify balance cleared
        const expenseDetailPage2 = await groupDetailPage1.clickExpenseToView(updatedDescription);
        await expenseDetailPage2.deleteExpense();

        // Should be back to group page with expense deleted
        await expect(groupDetailPage1.page).toHaveURL(groupDetailUrlPattern(groupId));
        await expect(groupDetailPage1.getExpenseByDescription(updatedDescription)).not.toBeVisible();

        // Balance should still show the settlement amount as the only transaction
        // Since expense is deleted but settlement remains, User2 actually paid User1 €50.00
        // So User1 now owes User2 €50.00 (debt relationship reversed)
        await groupDetailPage1.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€50.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user1DisplayName, user2DisplayName, '€50.00 EUR');
    });

    simpleTest('should handle comprehensive multi-currency expenses with precision and cross-currency settlements', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );
        const uniqueId = generateShortId();

        // PHASE 1: Test JPY (0 decimals) - amount divides evenly
        const expenseFormPage2 = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage2.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(`Multi-currency JPY ${uniqueId}`)
                .withAmount(124, 'JPY') // Divides evenly: ¥62 each
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('JPY')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        // PHASE 2: Test BHD (3 decimals) - add to same group
        const expenseFormPage1 = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage1.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(`Multi-currency BHD ${uniqueId}`)
                .withAmount(31.000, 'BHD')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('BHD')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );
        await groupDetailPage.waitForExpense(`Multi-currency BHD ${uniqueId}`);
        await groupDetailPage.verifyCurrencyAmountInExpenses(user1DisplayName, '.د.ب31.000 BHD');

        // PHASE 3: Test KWD (3 decimals) - comprehensive currency test
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(`Multi-currency KWD ${uniqueId}`)
                .withAmount(6.000, 'KWD')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('KWD')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );
        await groupDetailPage.waitForExpense(`Multi-currency KWD ${uniqueId}`);
        await groupDetailPage.verifyCurrencyAmountInExpenses(user1DisplayName, 'KD6.000 KWD');

        // Verify JPY expense (created first) is still visible
        await groupDetailPage.waitForExpense(`Multi-currency JPY ${uniqueId}`);
        await groupDetailPage.verifyCurrencyAmountInExpenses(user1DisplayName, '¥124 JPY');

        // Verify multi-currency balances (separate debt per currency)
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62 JPY');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62 JPY');

        // PHASE 4: Test cross-currency settlement (settle with different currency)
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user2DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(25, 'EUR')
                .withNote('Cross-currency settlement test')
                .build(),
            2,
        );

        // Verify cross-currency settlement recorded while original debts remain
        await groupDetailPage.verifySettlementDetails({ note: 'Cross-currency settlement test' });
        await groupDetailPage2.verifySettlementDetails({ note: 'Cross-currency settlement test' });

        // Original currency debts should persist (cross-currency doesn't auto-convert)
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62 JPY');
    });

    simpleTest('should handle expense creation with custom date, time, and immediate balance impact', async ({ createLoggedInBrowsers }) => {
        const [{ page, dashboardPage }] = await createLoggedInBrowsers(1);

        const userDisplayName = await dashboardPage.header.getCurrentUserDisplayName();
        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const groupId = groupDetailPage.inferGroupId();

        // Create expense with custom date/time and currency
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage.waitForExpenseFormSections();

        // Fill expense details with custom date/time
        const expenseDescription = 'Dinner with custom datetime and balance';
        await expenseFormPage.fillDescription(expenseDescription);
        await expenseFormPage.fillAmount('89.99');

        // Set currency to EUR using page object method
        await expenseFormPage.selectCurrency('EUR');

        // Set yesterday's date and custom time
        await expenseFormPage.clickYesterdayButton();

        // Set custom time
        let timeButtonCount = await expenseFormPage.getTimeButtonCount();

        if (timeButtonCount === 0) {
            const clockIconCount = await expenseFormPage.getClockIconCount();
            if (clockIconCount > 0) {
                await expenseFormPage.clickClockIcon();
            }
            timeButtonCount = await expenseFormPage.getTimeButtonCount();
        }

        await expenseFormPage.verifyTimeButtonVisible();
        await expenseFormPage.clickTimeButton();
        await expenseFormPage.fillTimeInput('7:30pm');
        await expenseFormPage.clickExpenseDetailsHeading(); // Blur to commit

        // Submit expense (single person group, so no balance change expected)
        await expenseFormPage.selectPayer(userDisplayName);
        await expenseFormPage.clickSelectAllButton();
        await expenseFormPage.clickSaveExpenseButton();

        // Verify success and currency display
        await expect(page).toHaveURL(groupDetailUrlPattern(groupId));
        await groupDetailPage.verifyExpenseInList(expenseDescription, '€89.99');

        // Should remain settled up since only one person
        await groupDetailPage.verifyAllSettledUp(groupId);
    });

    simpleTest('should handle complex multi-expense net balance calculations with settlements', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Scenario: Complex expense and settlement flow to test net calculations

        // User1 pays €300 (each owes €150)
        const expenseFormPage2 = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage2.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Large User1 Payment')
                .withAmount(300, 'EUR')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('EUR')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€150.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€150.00 EUR');

        // User2 pays €100 (each owes €50, net: User2 owes €100)
        const expenseFormPage1 = await groupDetailPage2.clickAddExpenseAndOpenForm(
            await groupDetailPage2.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage1.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Small User2 Payment')
                .withAmount(100, 'EUR')
                .withPaidByDisplayName(user2DisplayName)
                .withCurrency('EUR')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        // Net calculation: User2 owes €150 - €50 = €100
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€100.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€100.00 EUR');

        // User2 makes partial settlement of €60
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user2DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(60.00, 'EUR')
                .withNote('Partial settlement in complex scenario')
                .build(),
            2,
        );

        // Final balance: €100 - €60 = €40
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€40.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€40.00 EUR');

        // Verify settlement is recorded
        await groupDetailPage.verifySettlementDetails({ note: 'Partial settlement in complex scenario' });
        await groupDetailPage2.verifySettlementDetails({ note: 'Partial settlement in complex scenario' });

        // Add one more expense to test continued calculation
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription('Final Test Expense')
                .withAmount(50, 'EUR')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('EUR')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        // Final net: €40 + €25 = €65
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€65.00 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€65.00 EUR');
    });

    simpleTest('should handle comprehensive multi-user settlement scenarios with real-time updates', async ({ createLoggedInBrowsers }) => {
        const memberCount = 3;

        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }, { dashboardPage: user3DashboardPage }] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
            user3DashboardPage,
        );
        const groupId = groupDetailPage1.inferGroupId();
        const pages = [groupDetailPage1, groupDetailPage2, groupDetailPage3];

        // Create expense for ¥120, split 3 ways (¥40 each)
        // Result: User2 owes ¥40, User3 owes ¥40 to User1
        const expenseDescription = 'Group dinner expense';
        const expenseFormPage = await groupDetailPage1.clickAddExpenseAndOpenForm(
            await groupDetailPage1.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(120, 'JPY')
                .withPaidByDisplayName(user1DisplayName)
                .withCurrency('JPY')
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName, user3DisplayName])
                .build(),
        );

        // Wait for expense on creator's page first to allow real-time propagation
        await groupDetailPage1.waitForExpense(expenseDescription);

        // Verify initial state across all pages
        for (const page of pages) {
            await page.waitForExpense(expenseDescription);
            await page.waitForPage(groupId, memberCount);
            // Enable "Show all balances" to see all debts, not just current user's
            await page.toggleShowAllBalances(true);
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40 JPY');
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40 JPY');
        }

        // PHASE 1: User2 makes partial settlement of ¥30 (leaving ¥10 debt)
        const settlementNote1 = 'Partial payment from user2';
        const settlementFormPage2 = await groupDetailPage1.clickSettleUpButton(memberCount);
        await settlementFormPage2.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user2DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(30, 'JPY')
                .withNote(settlementNote1)
                .build(),
            memberCount,
        );

        // Verify real-time updates for partial settlement
        for (const page of pages) {
            // Enable "Show all settlements" to see all settlements, not just current user's
            await page.toggleShowAllSettlements(true);
            await page.verifySettlementDetails({ note: settlementNote1 });
            await page.waitForPage(groupId, memberCount);
            // Ensure "Show all balances" is enabled (should already be from earlier, but be explicit)
            await page.toggleShowAllBalances(true);
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥10 JPY'); // 40 - 30 = 10
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40 JPY'); // unchanged
        }

        // PHASE 2: User2 makes final settlement of ¥10 (fully settled)
        const settlementNote2 = 'Final payment from user2 - all settled!';
        const settlementFormPage1 = await groupDetailPage1.clickSettleUpButton(memberCount);
        await settlementFormPage1.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user2DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(10, 'JPY')
                .withNote(settlementNote2)
                .build(),
            memberCount,
        );

        // Verify real-time updates for final settlement
        for (const page of pages) {
            // Enable "Show all settlements" to see all settlements, not just current user's
            await page.toggleShowAllSettlements(true);
            await page.verifySettlementDetails({ note: settlementNote2 });
            await page.waitForPage(groupId, memberCount);
            // Ensure "Show all balances" is enabled
            await page.toggleShowAllBalances(true);
            await expect(page.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible(); // User2 fully settled
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40 JPY'); // User3 still owes
        }

        // PHASE 3: Test additional real-time scenarios - User3 partial settlement
        const settlementNote3 = 'User3 partial payment';
        const settlementFormPage = await groupDetailPage1.clickSettleUpButton(memberCount);
        await settlementFormPage.submitSettlement(
            new SettlementFormDataBuilder()
                .withPayerName(user3DisplayName)
                .withPayeeName(user1DisplayName)
                .withAmount(25, 'JPY')
                .withNote(settlementNote3)
                .build(),
            memberCount,
        );

        // Verify final real-time state
        for (const page of pages) {
            // Enable "Show all settlements" to see all settlements, not just current user's
            await page.toggleShowAllSettlements(true);
            await page.verifySettlementDetails({ note: settlementNote3 });
            await page.waitForPage(groupId, memberCount);
            // Ensure "Show all balances" is enabled
            await page.toggleShowAllBalances(true);
            await expect(page.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible(); // User2 still fully settled
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥15 JPY'); // 40 - 25 = 15
        }

        // Verify all settlements appear in history
        for (const page of pages) {
            // Enable "Show all settlements" to see all settlements, not just current user's
            await page.toggleShowAllSettlements(true);
            await page.verifySettlementDetails({ note: settlementNote1 });
            await page.verifySettlementDetails({ note: settlementNote2 });
            await page.verifySettlementDetails({ note: settlementNote3 });
        }
    });
});

simpleTest.describe('Date and Time Selection', () => {
    simpleTest('should handle date convenience buttons and time input', async ({ createLoggedInBrowsers }) => {
        const memberCount = 1;

        const [{ dashboardPage }] = await createLoggedInBrowsers(memberCount);

        const [groupDetailPage] = await dashboardPage.createMultiUserGroup(new CreateGroupFormDataBuilder()
            .build());
        const expenseFormPage = await groupDetailPage.clickAddExpenseAndOpenForm(
            await groupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );

        // Test date convenience buttons
        // Test Today button
        await expenseFormPage.clickTodayButton();
        await expenseFormPage.verifyDateInputMatchesPattern(/^\d{4}-\d{2}-\d{2}$/);
        const todayInputValue = await expenseFormPage.getDateInputValue();

        // Test Yesterday button
        await expenseFormPage.clickYesterdayButton();
        await expenseFormPage.verifyDateInputMatchesPattern(/^\d{4}-\d{2}-\d{2}$/);
        const yesterdayInputValue = await expenseFormPage.getDateInputValue();

        // Verify yesterday is one day before today
        const todayParsed = new Date(todayInputValue + 'T00:00:00');
        const yesterdayParsed = new Date(yesterdayInputValue + 'T00:00:00');
        const dayDifference = (todayParsed.getTime() - yesterdayParsed.getTime()) / (1000 * 60 * 60 * 24);
        expect(dayDifference).toBe(1);

        // Test Last Night button (sets evening time)
        await expenseFormPage.clickLastNightButton();
        await expenseFormPage.verifyDateInputMatchesPattern(/^\d{4}-\d{2}-\d{2}$/);

        // Test time input functionality
        let timeButtonCount = await expenseFormPage.getTimeButtonCount();

        if (timeButtonCount === 0) {
            const clockIconCount = await expenseFormPage.getClockIconCount();
            if (clockIconCount > 0) {
                await expenseFormPage.clickClockIcon();
            }
            timeButtonCount = await expenseFormPage.getTimeButtonCount();
        }

        await expenseFormPage.verifyTimeButtonVisible();
        await expenseFormPage.clickTimeButton();

        await expenseFormPage.verifyTimeInputVisible();
        await expenseFormPage.verifyTimeInputFocused();

        // Test time suggestions
        await expenseFormPage.fillTimeInput('3');
        await expenseFormPage.verifyTimeSuggestionVisible('3:00 AM');
        await expenseFormPage.verifyTimeSuggestionVisible('3:00 PM');

        // Accept time selection
        await expenseFormPage.clickTimeSuggestion('3:00 PM');
        await expenseFormPage.verifyTimeSuggestionVisible('at 3:00 PM');
    });
});

simpleTest.describe('Real-time Comments', () => {
    simpleTest('should support real-time expense comments', async ({ createLoggedInBrowsers }, testInfo) => {
        // Create two browser instances - Alice and Bob
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [user1GroupDetailPage, user2GroupDetailPage] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Create expense
        const expenseFormPage = await user1GroupDetailPage.clickAddExpenseAndOpenForm(
            await user1GroupDetailPage.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        const expenseDescription = 'Test Expense for Comments';
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(50000, 'VND')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        await user1GroupDetailPage.waitForExpense(expenseDescription);
        await user2GroupDetailPage.waitForExpense(expenseDescription);

        // Navigate to expense detail pages
        const aliceExpenseDetailPage = await user1GroupDetailPage.clickExpenseToView(expenseDescription);
        const bobExpenseDetailPage = await user2GroupDetailPage.clickExpenseToView(expenseDescription);

        await aliceExpenseDetailPage.verifyCommentsSection();
        await bobExpenseDetailPage.verifyCommentsSection();

        // Test real-time comments
        const comment1 = `comment ${generateShortId()}`;
        await aliceExpenseDetailPage.addComment(comment1);
        await bobExpenseDetailPage.waitForCommentToAppear(comment1);

        const comment2 = `comment ${generateShortId()}`;
        await bobExpenseDetailPage.addComment(comment2);
        await aliceExpenseDetailPage.waitForCommentToAppear(comment2);

        // Verify both comments visible
        await aliceExpenseDetailPage.waitForCommentCount(2);
        await bobExpenseDetailPage.waitForCommentCount(2);

        await aliceExpenseDetailPage.verifyCommentVisible(comment1);
        await aliceExpenseDetailPage.verifyCommentVisible(comment2);
        await bobExpenseDetailPage.verifyCommentVisible(comment1);
        await bobExpenseDetailPage.verifyCommentVisible(comment2);
    });
});

simpleTest.describe('Settlement CRUD Operations', () => {
    simpleTest('should create settlements with comprehensive display and permissions', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Test 1: Normal settlement creation and display
        const settlementForm1 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData1 = new SettlementFormDataBuilder()
            .withPayerName(payerName)
            .withPayeeName(payeeName)
            .withAmount(101, 'JPY')
            .withNote('Test payment for history')
            .build();

        await settlementForm1.submitSettlement(settlementData1, 2);
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData1.note });
        await groupDetailPage.verifySettlementDetails(settlementData1);

        // Test 2: Settlement where creator is payee (different permissions scenario)
        const settlementForm2 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData2 = new SettlementFormDataBuilder()
            .withPayerName(payeeName) // Other user pays
            .withPayeeName(payerName) // Creator receives
            .withAmount(75, 'JPY')
            .withNote('Creator receives payment')
            .build();

        await settlementForm2.submitSettlement(settlementData2, 2);
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData2.note });
        await groupDetailPage.verifySettlementDetails({ note: settlementData2.note });

        // Verify creator can edit/delete even when they're the payee
        await groupDetailPage.verifySettlementHasEditButton(settlementData2.note);
        await groupDetailPage.verifySettlementHasDeleteButton(settlementData2.note);
    });

    simpleTest('should edit settlements with comprehensive validation and form handling', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Create settlement for editing
        let settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const initialData = new SettlementFormDataBuilder()
            .withPayerName(payerName)
            .withPayeeName(payeeName)
            .withAmount(101, 'JPY')
            .withNote('Initial test payment')
            .build();

        await settlementForm.submitSettlement(initialData, 2);
        await groupDetailPage.verifySettlementDetails({ note: initialData.note });

        // Test successful edit flow
        await groupDetailPage.openHistoryIfClosed();
        settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

        await settlementForm.verifyUpdateMode();
        await settlementForm.verifyFormValues({
            amount: initialData.amount,
            note: initialData.note,
        });

        const updatedData = {
            amount: '151',
            note: 'Updated test payment',
        };

        await settlementForm.updateSettlement(updatedData);
        await settlementForm.waitForModalClosed();
        await groupDetailPage.verifySettlementDetails({ note: updatedData.note });

        // Test validation during edit
        settlementForm = await groupDetailPage.clickEditSettlement(updatedData.note);

        // Test invalid amounts
        await settlementForm.clearAndFillAmount('0');
        await settlementForm.verifyUpdateButtonDisabled();

        await settlementForm.clearAndFillAmount('-50');
        await settlementForm.verifyUpdateButtonDisabled();

        // Test valid amount and cancel without saving (JPY has 0 decimal places)
        await settlementForm.clearAndFillAmount('75');
        await settlementForm.verifyUpdateButtonEnabled();
        await settlementForm.closeModal();
        await settlementForm.waitForModalClosed();

        // Verify no changes were saved
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({
            note: updatedData.note,
            amount: updatedData.amount,
            payerName: initialData.payerName,
            payeeName: initialData.payeeName,
        });
    });

    simpleTest('should delete settlements with confirmation and cancellation flows', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Create settlements for testing deletion flows
        const settlementForm1 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData1 = new SettlementFormDataBuilder()
            .withPayerName(payerName)
            .withPayeeName(payeeName)
            .withAmount(100, 'JPY')
            .withNote('Payment to be deleted')
            .build();

        await settlementForm1.submitSettlement(settlementData1, 2);
        await groupDetailPage.verifySettlementDetails({ note: settlementData1.note });

        const settlementForm2 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData2 = new SettlementFormDataBuilder()
            .withPayerName(payerName)
            .withPayeeName(payeeName)
            .withAmount(75, 'JPY')
            .withNote('Payment to keep')
            .build();

        await settlementForm2.submitSettlement(settlementData2, 2);
        await groupDetailPage.verifySettlementDetails({ note: settlementData2.note });

        // Test 1: Successful deletion with confirmation
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData1.note });
        await groupDetailPage.deleteSettlement(settlementData1.note, true);
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementNotInHistory(settlementData1.note);

        // Test 2: Cancelled deletion - settlement should remain
        await groupDetailPage.deleteSettlement(settlementData2.note, false); // Cancel deletion
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData2.note });
    });
});

simpleTest.describe('Copy Expense Feature', () => {
    simpleTest('should copy expense with all fields pre-filled correctly', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Step 1: Create group and original expense
        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
        );

        // Create original expense with specific details
        const originalExpenseFormPage = await groupDetailPage1.clickAddExpenseAndOpenForm(
            await groupDetailPage1.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        const originalDescription = `Original Expense ${generateShortId()}`;
        await originalExpenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(originalDescription)
                .withAmount(127.50, 'EUR')
                .withPaidByDisplayName(user1DisplayName)
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName])
                .build(),
        );

        // Step 2: Navigate to expense detail page
        await groupDetailPage1.waitForExpense(originalDescription);
        const expenseDetailPage = await groupDetailPage1.clickExpenseToView(originalDescription);

        // Step 3: Click "Copy expense" button
        const copyExpenseFormPage = await expenseDetailPage.clickCopyExpenseAndReturnForm(
            [user1DisplayName, user2DisplayName],
            (page) => new E2EExpenseFormPage(page),
        );

        // Step 4: Verify copy mode UI
        await copyExpenseFormPage.verifyCopyMode();

        // Step 5: Verify all fields are pre-filled from original expense
        await copyExpenseFormPage.verifyPreFilledValues({
            description: originalDescription,
            amount: '127.5',
        });

        // Step 6: Verify date is set to today (not original date)
        await copyExpenseFormPage.verifyDateIsToday();

        // Step 7: Modify some fields (description and amount)
        const copiedDescription = `Copied Expense ${generateShortId()}`;
        await copyExpenseFormPage.fillDescription(copiedDescription);
        await copyExpenseFormPage.fillAmount('90.00');

        // Step 8: Submit the copied expense
        await copyExpenseFormPage.clickUpdateExpenseButton();

        // Step 9: Verify redirect to group page
        await groupDetailPage1.waitForExpense(copiedDescription);

        // Step 10: Verify both expenses exist independently
        await groupDetailPage1.waitForExpense(originalDescription); // Original still exists
        await groupDetailPage1.waitForExpense(copiedDescription); // Copied expense exists

        // Step 11: Verify balances updated correctly (original €63.75 + copied €45.00 = €108.75 total)
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€108.75 EUR');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€108.75 EUR');

        // Step 12: Verify both users can see both expenses
        await groupDetailPage2.waitForExpense(originalDescription);
        await groupDetailPage2.waitForExpense(copiedDescription);
    });

    simpleTest('should handle copy expense for multi-user scenarios with real-time updates', async ({ createLoggedInBrowsers }) => {
        const [{ dashboardPage: user1DashboardPage }, { dashboardPage: user2DashboardPage }, { dashboardPage: user3DashboardPage }] = await createLoggedInBrowsers(3);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        // Create 3-user group
        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder()
                .build(),
            user2DashboardPage,
            user3DashboardPage,
        );

        // Create original expense with complex split
        const originalExpenseFormPage = await groupDetailPage1.clickAddExpenseAndOpenForm(
            await groupDetailPage1.getMemberNames(),
            (page) => new E2EExpenseFormPage(page),
        );
        const originalDescription = `Multi-user Original ${generateShortId()}`;
        await originalExpenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(originalDescription)
                .withAmount(150, 'JPY')
                .withPaidByDisplayName(user2DisplayName) // User2 pays
                .withSplitType('equal')
                .withParticipants([user1DisplayName, user2DisplayName, user3DisplayName]) // Split 3 ways
                .build(),
        );

        // Wait for all users to see the original expense
        await groupDetailPage1.waitForExpense(originalDescription);
        await groupDetailPage2.waitForExpense(originalDescription);
        await groupDetailPage3.waitForExpense(originalDescription);

        // User3 clicks to view and copy the expense
        const expenseDetailPage = await groupDetailPage3.clickExpenseToView(originalDescription);
        const copyExpenseFormPage = await expenseDetailPage.clickCopyExpenseAndReturnForm(
            [user1DisplayName, user2DisplayName, user3DisplayName],
            (page) => new E2EExpenseFormPage(page),
        );

        // Modify the copied expense (different payer and amount)
        const copiedDescription = `Multi-user Copied ${generateShortId()}`;
        await copyExpenseFormPage.fillDescription(copiedDescription);
        await copyExpenseFormPage.fillAmount('90');

        // Change payer to User1
        await copyExpenseFormPage.selectPayer(user1DisplayName);
        await copyExpenseFormPage.clickUpdateExpenseButton();

        // Verify real-time updates: all users should see both expenses
        await groupDetailPage1.waitForExpense(originalDescription);
        await groupDetailPage1.waitForExpense(copiedDescription);
        await groupDetailPage2.waitForExpense(originalDescription);
        await groupDetailPage2.waitForExpense(copiedDescription);
        await groupDetailPage3.waitForExpense(originalDescription);
        await groupDetailPage3.waitForExpense(copiedDescription);

        // Verify complex balance calculations:
        // Original: User2 paid ¥150, split 3 ways (¥50 each) -> User1 owes ¥50, User3 owes ¥50
        // Copied: User1 paid ¥90, split 3 ways (¥30 each) -> User2 owes ¥30, User3 owes ¥30
        // Net: User1 owes User2 ¥50-¥30=¥20, User3 owes User1 ¥30, User3 owes User2 ¥50
        // But let's verify what the actual balances show first
        // Enable "Show all balances" to see debts not involving current user (user1)
        await groupDetailPage1.toggleShowAllBalances(true);
        await groupDetailPage1.verifyDebtRelationship(user3DisplayName, user2DisplayName, '¥70 JPY');
        await groupDetailPage1.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥10 JPY');
    });
});
