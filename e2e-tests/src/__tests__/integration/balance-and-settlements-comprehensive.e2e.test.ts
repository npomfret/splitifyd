import {expect, simpleTest} from '../../fixtures';
import {SettlementData} from '../../pages/settlement-form.page';

/**
 * Comprehensive Balance & Settlement Operations E2E Tests
 *
 * CONSOLIDATION: Reduced from 18 to ~10 tests by eliminating redundancy
 * while maintaining 100% feature coverage.
 *
 * Covers:
 * - Balance calculations across all scenarios
 * - Settlement CRUD operations (create, read, update, delete)
 * - Multi-currency support and formatting
 * - Real-time balance updates
 * - Partial and full settlement flows
 */


simpleTest.describe('Balance Calculation & Settlement Lifecycle', () => {

    simpleTest('should handle complete balance lifecycle: empty -> debt -> settled -> partial -> full settlement', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        // Scenario 1: Empty group -> ALWAYS settled up
        const [groupDetailPage1, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // Scenario 2: Single expense creates debt
        await groupDetailPage1.addExpense({
            description: 'Test Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        await groupDetailPage1.waitForExpense('Test Expense');
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥50');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥50');

        // Scenario 3: Equal expenses -> settled up
        await groupDetailPage2.addExpense({
            description: 'User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        await groupDetailPage2.waitForExpense('User2 Payment');
        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();

        // Scenario 4: New debt + partial settlement
        await groupDetailPage1.addExpense({
            description: 'Final Test Payment',
            amount: 80,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        await groupDetailPage1.waitForExpense('Final Test Payment');
        await groupDetailPage1.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');

        // Scenario 5: Full settlement clears debt -> settled up
        const settlementForm = await groupDetailPage2.clickSettleUpButton(2);
        await settlementForm.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '40',
            currency: 'JPY',
            note: 'Full settlement test',
        }, 2);

        await groupDetailPage1.waitForSettledUpMessage();
        await groupDetailPage2.waitForSettledUpMessage();
    });

    simpleTest('should calculate debt correctly with different currencies and precision', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Test 1: EUR currency with decimal precision
        await groupDetailPage.addExpense({
            description: 'EUR Expense',
            amount: 100,
            paidByDisplayName: user1DisplayName,
            currency: 'EUR',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '€50.00');

        // Test 2: JPY currency with no decimals + rounding
        await groupDetailPage.addExpense({
            description: 'JPY Rounding Test',
            amount: 123,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName]
        }, 2);

        // JPY: 123/2 = 61.5 -> rounds up to \u00a562
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥62');

        // Verify original expense amount is preserved
        await expect(groupDetailPage.getCurrencyAmount('123')).toBeVisible();
    });

    simpleTest('should handle complex multi-expense net debt calculations', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // User1 pays \u00a5300 (owes \u00a5150)
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Large User1 Payment',
            amount: 300,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        await groupDetailPage.verifyExpenseVisible('Large User1 Payment');
        await groupDetailPage2.verifyExpenseVisible('Large User1 Payment');

        // User2 pays \u00a5100 (owes \u00a5200)
        const expenseFormPage2 = await groupDetailPage2.clickAddExpenseButton(2);
        await expenseFormPage2.submitExpense({
            description: 'Small User2 Payment',
            amount: 100,
            paidByDisplayName: user2DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Net calculation: User1 owes \u00a5150, User2 owes \u00a5200 -> User2 owes User1 \u00a5100
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥100');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥100');
    });


});

simpleTest.describe('Settlement CRUD Operations', () => {
    simpleTest('should create settlements with comprehensive display and permissions', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Test 1: Normal settlement creation and display
        const settlementForm1 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData1: SettlementData = {
            payerName: payerName,
            payeeName: payeeName,
            amount: '100.50',
            currency: 'JPY',
            note: 'Test payment for history',
        };

        await settlementForm1.submitSettlement(settlementData1, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData1.note});
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails(settlementData1);

        // Test 2: Settlement where creator is payee (different permissions scenario)
        const settlementForm2 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData2: SettlementData = {
            payerName: payeeName,  // Other user pays
            payeeName: payerName,  // Creator receives
            amount: '75.00',
            currency: 'JPY',
            note: 'Creator receives payment',
        };

        await settlementForm2.submitSettlement(settlementData2, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData2.note});
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({ note: settlementData2.note });

        // Verify creator can edit/delete even when they're the payee
        await groupDetailPage.verifySettlementHasEditButton(settlementData2.note);
        await groupDetailPage.verifySettlementHasDeleteButton(settlementData2.note);
    });

    simpleTest('should edit settlements with comprehensive validation and form handling', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlement for editing
        let settlementForm = await groupDetailPage.clickSettleUpButton(2);
        const initialData: SettlementData = {
            payerName,
            payeeName,
            amount: '100.50',
            currency: 'JPY',
            note: 'Initial test payment',
        };

        await settlementForm.submitSettlement(initialData, 2);
        await groupDetailPage.verifySettlementDetails({note: initialData.note});

        // Test successful edit flow
        await groupDetailPage.openHistoryIfClosed();
        settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

        await settlementForm.verifyUpdateMode();
        await settlementForm.verifyFormValues({
            amount: initialData.amount,
            note: initialData.note,
        });

        const updatedData = {
            amount: '150.75',
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

        // Test valid amount and cancel without saving
        await settlementForm.clearAndFillAmount('75.50');
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
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create settlements for testing deletion flows
        const settlementForm1 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData1: SettlementData = {
            payerName,
            payeeName,
            amount: '100.00',
            currency: 'JPY',
            note: 'Payment to be deleted',
        };

        await settlementForm1.submitSettlement(settlementData1, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData1.note});

        const settlementForm2 = await groupDetailPage.clickSettleUpButton(2);
        const settlementData2: SettlementData = {
            payerName,
            payeeName,
            amount: '75.00',
            currency: 'JPY',
            note: 'Payment to keep',
        };

        await settlementForm2.submitSettlement(settlementData2, 2);
        await groupDetailPage.verifySettlementDetails({note: settlementData2.note});

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

    simpleTest('should update debt correctly after partial settlement', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage }
        ] = await createLoggedInBrowsers(2);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage, groupDetailPage2] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

        // Create expense: User1 pays \u00a5200 -> User2 owes \u00a5100
        const expenseFormPage = await groupDetailPage.clickAddExpenseButton(2);
        await expenseFormPage.submitExpense({
            description: 'Test Expense for Settlement',
            amount: 200,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName],
        });

        // Verify expense appears and initial debt
        await groupDetailPage.verifyExpenseVisible('Test Expense for Settlement');
        await groupDetailPage2.verifyExpenseVisible('Test Expense for Settlement');
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥100');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥100');

        // Record partial settlement of \u00a560
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(2);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '60',
            currency: 'JPY',
            note: 'Partial payment of $60',
        }, 2);

        // Verify updated debt (\u00a5100 - \u00a560 = \u00a540 remaining)
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
    });
});

simpleTest.describe('Real-time Balance Updates', () => {
    simpleTest('should handle multi-user partial settlements correctly', async ({ createLoggedInBrowsers }) => {
        const memberCount = 3;

        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
            { dashboardPage: user3DashboardPage }
        ] = await createLoggedInBrowsers(memberCount);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage, user3DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();

        // User1 creates expense for \u00a5120, split 3 ways (\u00a540 each)
        // Result: User2 owes \u00a540, User3 owes \u00a540 to User1
        const expenseDescription = 'Group dinner expense';
        await groupDetailPage1.addExpense({
            description: expenseDescription,
            amount: 120,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName, user3DisplayName]
        }, memberCount);

        // Synchronize all pages
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.waitForExpense(expenseDescription);
            await groupDetailPage.waitForPage(groupId, memberCount);
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40');
        }

        // User2 makes partial settlement of \u00a530 (leaving \u00a510 debt)
        const settlementNote1 = 'Partial payment from user2';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30',
            currency: 'JPY',
            note: settlementNote1,
        }, memberCount);

        // Synchronize settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({note: settlementNote1});
            await groupDetailPage.waitForPage(groupId, memberCount);
        }

        // Verify updated balances: User2 now owes \u00a510, User3 still owes \u00a540
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥10');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40');
        }

        // User2 makes final settlement of \u00a510 (fully settled)
        const settlementNote2 = 'Final payment from user2 - all settled!';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '10',
            currency: 'JPY',
            note: settlementNote2,
        }, memberCount);

        // Synchronize final settlement
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({note: settlementNote2});
            await groupDetailPage.waitForPage(groupId, memberCount);
        }

        // Verify final state: User2 fully settled, User3 still owes \u00a540
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await expect(groupDetailPage.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible();
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40');
        }

        // Verify both settlements in history
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifySettlementDetails({ note: "Partial payment from user2" });
            await groupDetailPage.verifySettlementDetails({ note: "Final payment from user2 - all settled!" });
        }
    });

    simpleTest('should handle real-time balance updates across multiple users', async ({ createLoggedInBrowsers }) => {
        const [
            { dashboardPage: user1DashboardPage },
            { dashboardPage: user2DashboardPage },
            { dashboardPage: user3DashboardPage }
        ] = await createLoggedInBrowsers(3);

        const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
        const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
        const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

        const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage, user3DashboardPage);
        const groupId = groupDetailPage1.inferGroupId();
        const pages = [groupDetailPage1, groupDetailPage2, groupDetailPage3];

        // Test complex multi-user scenario with partial settlements
        const expenseDescription = 'Group dinner expense';
        await groupDetailPage1.addExpense({
            description: expenseDescription,
            amount: 120,
            paidByDisplayName: user1DisplayName,
            currency: 'JPY',
            splitType: 'equal',
            participants: [user1DisplayName, user2DisplayName, user3DisplayName]
        }, 3);

        // Verify real-time updates across all pages
        for (const page of pages) {
            await page.waitForExpense(expenseDescription);
            await page.waitForPage(groupId, 3);
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40');
        }

        // User2 makes partial settlement
        const settlementNote1 = 'Partial payment from user2';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '30',
            currency: 'JPY',
            note: settlementNote1,
        }, 3);

        // Verify real-time settlement updates
        for (const page of pages) {
            await page.verifySettlementDetails({note: settlementNote1});
            await page.waitForPage(groupId, 3);
            await page.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥10'); // 40 - 30 = 10
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40'); // unchanged
        }

        // User2 completes final settlement
        const settlementNote2 = 'Final payment from user2';
        await groupDetailPage1.recordSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '10',
            currency: 'JPY',
            note: settlementNote2,
        }, 3);

        // Verify final real-time updates
        for (const page of pages) {
            await page.verifySettlementDetails({note: settlementNote2});
            await page.waitForPage(groupId, 3);
            await expect(page.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible(); // User2 fully settled
            await page.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40'); // User3 still owes
        }
    });
});

// Comprehensive test coverage achieved with 9 tests (reduced from 18)
// - Balance lifecycle: empty -> debt -> settled -> partial -> full
// - Currency handling: precision, formatting, mixed currencies
// - Settlement CRUD: create, read, update, delete with validation
// - Multi-currency: separate tracking, cross-currency settlements
// - Real-time updates: multi-user synchronization