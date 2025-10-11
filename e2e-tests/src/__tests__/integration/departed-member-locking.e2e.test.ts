import { CreateGroupFormDataBuilder, ExpenseFormDataBuilder, generateShortId } from '@splitifyd/test-support';
import { expect, simpleTest } from '../../fixtures';

simpleTest.describe('Departed Member Transaction Locking', () => {
    simpleTest('should lock expense when participant leaves group', async ({ createLoggedInBrowsers }, testInfo) => {
        // Annotate for expected 404 errors when Bob tries to access after leaving
        testInfo.annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 404 errors when departed member loses access',
        });

        // Create group with 3 users
        const [
            { dashboardPage: aliceDashboardPage },
            { dashboardPage: bobDashboardPage },
            { dashboardPage: charlieDashboardPage },
        ] = await createLoggedInBrowsers(3);

        // Get display names
        const aliceDisplayName = await aliceDashboardPage.header.getCurrentUserDisplayName();
        const bobDisplayName = await bobDashboardPage.header.getCurrentUserDisplayName();
        const charlieDisplayName = await charlieDashboardPage.header.getCurrentUserDisplayName();

        // Alice creates group with all 3 members
        const [aliceGroupDetailPage, bobGroupDetailPage, charlieGroupDetailPage] = await aliceDashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder(),
            bobDashboardPage,
            charlieDashboardPage,
        );

        const groupId = aliceGroupDetailPage.inferGroupId();

        // Alice creates expense with all 3 participants ($90 split equally)
        const expenseDescription = `Departed Member Test ${generateShortId()}`;
        const expenseFormPage = await aliceGroupDetailPage.clickAddExpenseButton();
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(90)
                .withCurrency('USD')
                .withPaidByDisplayName(aliceDisplayName)
                .withSplitType('equal')
                .withParticipants([aliceDisplayName, bobDisplayName, charlieDisplayName])
                .build(),
        );

        // Wait for expense to appear and balances to update
        await aliceGroupDetailPage.waitForExpense(expenseDescription);
        await bobGroupDetailPage.waitForExpense(expenseDescription);

        // Verify Bob owes Alice $30.00
        await bobGroupDetailPage.verifyDebtRelationship(bobDisplayName, aliceDisplayName, '$30.00');

        // Bob settles his debt
        const settlementFormPage = await bobGroupDetailPage.clickSettleUpButton(3);
        await settlementFormPage.fillAndSubmitSettlement(aliceDisplayName, '30', 'USD');

        // Wait for Bob's page to be back on group detail after settlement
        await expect(bobGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await bobGroupDetailPage.waitForBalancesSection(groupId);

        // Verify Bob no longer owes Alice (his balance is settled)
        await bobGroupDetailPage.verifyNoDebtRelationship(bobDisplayName, aliceDisplayName);

        // Bob should no longer appear in simplified debts (he's settled his balance)
        // Charlie still owes Alice $30, so the group isn't fully settled, but Bob can leave

        // Bob leaves the group
        const leaveModal = await bobGroupDetailPage.clickLeaveGroupButton();
        await leaveModal.confirmLeaveGroup();

        // Wait for member count to update
        await aliceGroupDetailPage.waitForMemberCount(2);
        await charlieGroupDetailPage.waitForMemberCount(2);

        // Alice navigates to the expense detail page
        const expenseDetailPage = await aliceGroupDetailPage.clickExpenseToView(expenseDescription);
        await expenseDetailPage.waitForPageReady();

        // VERIFY LOCK UI
        // 1. Verify lock warning banner is displayed
        await expenseDetailPage.verifyLockWarningBanner();

        // 2. Verify edit button is disabled
        await expenseDetailPage.verifyEditButtonDisabled();

        // 3. Verify tooltip shows correct message
        await expenseDetailPage.verifyEditButtonTooltip();
    });

    simpleTest('should lock settlement when payer leaves group', async ({ createLoggedInBrowsers }, testInfo) => {
        // Annotate for expected 404 errors when Bob tries to access after leaving
        testInfo.annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 404 errors when departed member loses access',
        });

        // Create group with 2 users
        const [{ dashboardPage: aliceDashboardPage }, { dashboardPage: bobDashboardPage }] = await createLoggedInBrowsers(2);

        // Get display names
        const aliceDisplayName = await aliceDashboardPage.header.getCurrentUserDisplayName();
        const bobDisplayName = await bobDashboardPage.header.getCurrentUserDisplayName();

        // Alice creates group with both members
        const [aliceGroupDetailPage, bobGroupDetailPage] = await aliceDashboardPage.createMultiUserGroup(
            new CreateGroupFormDataBuilder(),
            bobDashboardPage,
        );

        const groupId = aliceGroupDetailPage.inferGroupId();

        // Alice creates expense with both participants ($100 split equally)
        const expenseDescription = `Settlement Lock Test ${generateShortId()}`;
        const expenseFormPage = await aliceGroupDetailPage.clickAddExpenseButton();
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(100)
                .withCurrency('USD')
                .withPaidByDisplayName(aliceDisplayName)
                .withSplitType('equal')
                .withParticipants([aliceDisplayName, bobDisplayName])
                .build(),
        );

        // Wait for expense to appear and balances to update
        await aliceGroupDetailPage.waitForExpense(expenseDescription);
        await bobGroupDetailPage.waitForExpense(expenseDescription);

        // Verify Bob owes Alice $50.00
        await bobGroupDetailPage.verifyDebtRelationship(bobDisplayName, aliceDisplayName, '$50.00');

        // Bob records partial settlement payment to Alice ($25)
        const settlementNote = `Partial payment ${generateShortId()}`;
        const settlementFormPage = await bobGroupDetailPage.clickSettleUpButton(2);
        await settlementFormPage.fillAndSubmitSettlement(aliceDisplayName, '25', 'USD', settlementNote);

        // Wait for Bob's page to be back on group detail after settlement
        await expect(bobGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await bobGroupDetailPage.waitForBalancesSection(groupId);

        // Verify settlement appears in payment history for both users
        await bobGroupDetailPage.verifySettlementDetails({
            note: settlementNote,
            amount: '$25.00',
            payerName: bobDisplayName,
            payeeName: aliceDisplayName,
        });

        await aliceGroupDetailPage.verifySettlementDetails({
            note: settlementNote,
            amount: '$25.00',
            payerName: bobDisplayName,
            payeeName: aliceDisplayName,
        });

        // Bob now owes Alice $25.00 (remaining balance)
        await bobGroupDetailPage.verifyDebtRelationship(bobDisplayName, aliceDisplayName, '$25.00');

        // Bob settles remaining debt
        const finalSettlementFormPage = await bobGroupDetailPage.clickSettleUpButton(2);
        await finalSettlementFormPage.fillAndSubmitSettlement(aliceDisplayName, '25', 'USD');

        // Wait for settlement to complete and verify Bob is settled
        await expect(bobGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await bobGroupDetailPage.waitForBalancesSection(groupId);
        await bobGroupDetailPage.verifyNoDebtRelationship(bobDisplayName, aliceDisplayName);

        // Bob leaves the group
        const leaveModal = await bobGroupDetailPage.clickLeaveGroupButton();
        await leaveModal.confirmLeaveGroup();

        // Ensure Alice stays on group detail page (only Bob should navigate away)
        await expect(aliceGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));

        // Wait for member count to update
        await aliceGroupDetailPage.waitForMemberCount(1);

        // Alice opens payment history and verifies the settlement is locked
        await aliceGroupDetailPage.openHistoryIfClosed();

        // VERIFY SETTLEMENT LOCK
        // The settlement edit button should be disabled
        // Note: We'll add a POM method to verify this
        await aliceGroupDetailPage.verifySettlementEditButtonDisabled(settlementNote);
    });
});
