import {expect, simpleTest} from '../../fixtures';
import {SettlementData} from '../../pages/settlement-form.page';

/**
 * Settlement CRUD Operations E2E Tests
 *
 * This file focuses exclusively on settlement-specific CRUD operations:
 * - Settlement creation with comprehensive display and permissions
 * - Settlement editing with form validation
 * - Settlement deletion with confirmation flows
 *
 * For settlement integration with balance calculations and multi-user scenarios,
 * see expense-and-balance-lifecycle.e2e.test.ts
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
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({note: settlementData1.note});
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
        await groupDetailPage.openHistoryIfClosed();
        await groupDetailPage.verifySettlementDetails({note: settlementData2.note});
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
});