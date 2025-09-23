import {expect, simpleTest} from '../../fixtures';
import {SettlementData} from '../../pages/settlement-form.page';

/**
 * Settlement-Focused Operations E2E Tests
 *
 * CONSOLIDATION UPDATE: Removed overlapping expense creation and balance calculation
 * tests that were moved to expense-and-balance-lifecycle.e2e.test.ts.
 *
 * This file now focuses exclusively on settlement-specific operations:
 * - Settlement CRUD operations (create, read, update, delete)
 * - Settlement form validation and UI behavior
 * - Multi-user settlement scenarios
 * - Settlement-specific real-time updates
 */

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

        // Create expense: User1 pays ¥200 -> User2 owes ¥100
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

        // Record partial settlement of ¥60
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(2);
        await settlementFormPage.submitSettlement({
            payerName: user2DisplayName,
            payeeName: user1DisplayName,
            amount: '60',
            currency: 'JPY',
            note: 'Partial payment of $60',
        }, 2);

        // Verify updated debt (¥100 - ¥60 = ¥40 remaining)
        await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
        await groupDetailPage2.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥40');
    });
});

simpleTest.describe('Settlement Real-time Updates', () => {
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

        // User1 creates expense for ¥120, split 3 ways (¥40 each)
        // Result: User2 owes ¥40, User3 owes ¥40 to User1
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

        // User2 makes partial settlement of ¥30 (leaving ¥10 debt)
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

        // Verify updated balances: User2 now owes ¥10, User3 still owes ¥40
        for (let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
            await groupDetailPage.verifyDebtRelationship(user2DisplayName, user1DisplayName, '¥10');
            await groupDetailPage.verifyDebtRelationship(user3DisplayName, user1DisplayName, '¥40');
        }

        // User2 makes final settlement of ¥10 (fully settled)
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

        // Verify final state: User2 fully settled, User3 still owes ¥40
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

    simpleTest('should handle real-time settlement updates across multiple users', async ({ createLoggedInBrowsers }) => {
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

        // Create expense for testing settlement real-time updates
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