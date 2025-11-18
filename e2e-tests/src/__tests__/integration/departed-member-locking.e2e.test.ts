import { Page } from '@playwright/test';
import { ExpenseFormDataBuilder, ExpenseFormPage, generateShortId } from '@billsplit-wl/test-support';
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
            bobDashboardPage,
            charlieDashboardPage,
        );

        const groupId = aliceGroupDetailPage.inferGroupId();

        // Alice creates expense with all 3 participants ($90 split equally)
        const expenseDescription = `Departed Member Test ${generateShortId()}`;
        const expenseFormPage = await aliceGroupDetailPage.clickAddExpenseAndOpenForm(
            await aliceGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(90, 'USD')
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
        const [aliceGroupDetailPage, bobGroupDetailPage] = await aliceDashboardPage.createMultiUserGroup(bobDashboardPage);

        const groupId = aliceGroupDetailPage.inferGroupId();

        // Alice creates expense with both participants ($100 split equally)
        const expenseDescription = `Settlement Lock Test ${generateShortId()}`;
        const expenseFormPage = await aliceGroupDetailPage.clickAddExpenseAndOpenForm(
            await aliceGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(100, 'USD')
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
        await aliceGroupDetailPage.verifySettlementEditButtonDisabled(settlementNote);
    });

    simpleTest('should lock settlement when payee leaves group', async ({ createLoggedInBrowsers }, testInfo) => {
        // Annotate for expected 404 errors when Alice tries to access after leaving
        testInfo.annotations.push({
            type: 'skip-error-checking',
            description: 'Expected 404 errors when departed member loses access',
        });

        // Create group with 2 users
        const [{ dashboardPage: aliceDashboardPage }, { dashboardPage: bobDashboardPage }] = await createLoggedInBrowsers(2);

        // Get display names
        const aliceDisplayName = await aliceDashboardPage.header.getCurrentUserDisplayName();
        const bobDisplayName = await bobDashboardPage.header.getCurrentUserDisplayName();

        // Bob creates group with both members
        const [bobGroupDetailPage, aliceGroupDetailPage] = await bobDashboardPage.createMultiUserGroup(aliceDashboardPage);

        const groupId = bobGroupDetailPage.inferGroupId();

        // Bob creates expense with both participants ($100 split equally)
        const expenseDescription = `Payee Lock Test ${generateShortId()}`;
        const expenseFormPage = await bobGroupDetailPage.clickAddExpenseAndOpenForm(
            await bobGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(expenseDescription)
                .withAmount(100, 'USD')
                .withPaidByDisplayName(bobDisplayName)
                .withSplitType('equal')
                .withParticipants([aliceDisplayName, bobDisplayName])
                .build(),
        );

        // Wait for expense to appear and balances to update
        await bobGroupDetailPage.waitForExpense(expenseDescription);
        await aliceGroupDetailPage.waitForExpense(expenseDescription);

        // Verify Alice owes Bob $50.00
        await aliceGroupDetailPage.verifyDebtRelationship(aliceDisplayName, bobDisplayName, '$50.00');

        // Alice records partial settlement payment to Bob ($25)
        const settlementNote = `Partial payment ${generateShortId()}`;
        const settlementFormPage = await aliceGroupDetailPage.clickSettleUpButton(2);
        await settlementFormPage.fillAndSubmitSettlement(bobDisplayName, '25', 'USD', settlementNote);

        // Wait for Alice's page to be back on group detail after settlement
        await expect(aliceGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await aliceGroupDetailPage.waitForBalancesSection(groupId);

        // Verify settlement appears in payment history for both users
        await aliceGroupDetailPage.verifySettlementDetails({
            note: settlementNote,
            amount: '$25.00',
            payerName: aliceDisplayName,
            payeeName: bobDisplayName,
        });

        await bobGroupDetailPage.verifySettlementDetails({
            note: settlementNote,
            amount: '$25.00',
            payerName: aliceDisplayName,
            payeeName: bobDisplayName,
        });

        // Alice now owes Bob $25.00 (remaining balance)
        await aliceGroupDetailPage.verifyDebtRelationship(aliceDisplayName, bobDisplayName, '$25.00');

        // Alice settles remaining debt
        const finalSettlementFormPage = await aliceGroupDetailPage.clickSettleUpButton(2);
        await finalSettlementFormPage.fillAndSubmitSettlement(bobDisplayName, '25', 'USD');

        // Wait for settlement to complete and verify Alice is settled
        await expect(aliceGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));
        await aliceGroupDetailPage.waitForBalancesSection(groupId);
        await aliceGroupDetailPage.verifyNoDebtRelationship(aliceDisplayName, bobDisplayName);

        // Alice leaves the group
        const leaveModal = await aliceGroupDetailPage.clickLeaveGroupButton();
        await leaveModal.confirmLeaveGroup();

        // Ensure Bob stays on group detail page (only Alice should navigate away)
        await expect(bobGroupDetailPage.page).toHaveURL(new RegExp(`/groups/${groupId}$`));

        // Wait for member count to update
        await bobGroupDetailPage.waitForMemberCount(1);

        // Bob opens payment history and verifies the settlement is locked
        await bobGroupDetailPage.openHistoryIfClosed();

        // VERIFY SETTLEMENT LOCK
        // The settlement edit button should be disabled (Alice was the payer/payee)
        await bobGroupDetailPage.verifySettlementEditButtonDisabled(settlementNote);
    });

    simpleTest('should allow creating new expense after member leaves', async ({ createLoggedInBrowsers }, testInfo) => {
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
            bobDashboardPage,
            charlieDashboardPage,
        );

        const groupId = aliceGroupDetailPage.inferGroupId();

        // Alice creates initial expense with all 3 participants ($90 split equally)
        const initialExpenseDescription = `Initial Expense ${generateShortId()}`;
        const expenseFormPage = await aliceGroupDetailPage.clickAddExpenseAndOpenForm(
            await aliceGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );
        await expenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(initialExpenseDescription)
                .withAmount(90, 'USD')
                .withPaidByDisplayName(aliceDisplayName)
                .withSplitType('equal')
                .withParticipants([aliceDisplayName, bobDisplayName, charlieDisplayName])
                .build(),
        );

        // Wait for expense to appear and balances to update
        await aliceGroupDetailPage.waitForExpense(initialExpenseDescription);
        await bobGroupDetailPage.waitForExpense(initialExpenseDescription);

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

        // Bob leaves the group
        const leaveModal = await bobGroupDetailPage.clickLeaveGroupButton();
        await leaveModal.confirmLeaveGroup();

        // Wait for member count to update from 3 to 2
        await aliceGroupDetailPage.waitForMemberCount(2);
        await charlieGroupDetailPage.waitForMemberCount(2);

        // VERIFY DEPARTED MEMBER NOT IN PARTICIPANT DROPDOWN
        // Alice opens expense form
        const newExpenseFormPage = await aliceGroupDetailPage.clickAddExpenseAndOpenForm(
            await aliceGroupDetailPage.getMemberNames(),
            (page: Page) => new ExpenseFormPage(page),
        );

        // Verify Bob is NOT in the participant dropdown
        await newExpenseFormPage.verifyMemberNotInParticipantDropdown(bobDisplayName);

        // Create new expense with only remaining members (Alice and Charlie)
        const newExpenseDescription = `After Member Left ${generateShortId()}`;
        await newExpenseFormPage.submitExpense(
            new ExpenseFormDataBuilder()
                .withDescription(newExpenseDescription)
                .withAmount(60, 'USD')
                .withPaidByDisplayName(aliceDisplayName)
                .withSplitType('equal')
                .withParticipants([aliceDisplayName, charlieDisplayName])
                .build(),
        );

        // VERIFY EXPENSE CREATED SUCCESSFULLY
        // Wait for expense to appear in both remaining members' views
        await aliceGroupDetailPage.waitForExpense(newExpenseDescription);
        await charlieGroupDetailPage.waitForExpense(newExpenseDescription);

        // Verify expense appears in expense list
        await aliceGroupDetailPage.verifyExpenseInList(newExpenseDescription);

        // Verify Charlie owes Alice $60.00 total:
        // - $30 from initial expense (never settled)
        // - $30 from new expense (just created)
        await charlieGroupDetailPage.verifyDebtRelationship(charlieDisplayName, aliceDisplayName, '$60.00');
    });
});
