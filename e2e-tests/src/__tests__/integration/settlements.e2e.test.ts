import {simpleTest, expect} from '../../fixtures';
import {simpleTest as test} from '../../fixtures/simple-test.fixture';
import {JoinGroupPage, GroupDetailPage} from '../../pages';
import {generateTestGroupName} from '@splitifyd/test-support';
import {SettlementData} from '../../pages/settlement-form.page.ts';

simpleTest.describe('Settlements - Complete Functionality', () => {
    simpleTest.describe('Settlement Creation and History', () => {
        simpleTest('should create settlement and display in history with proper formatting', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(memberCount);

            const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

            const [groupDetailPage, user2GroupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

            // Create settlement
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);

            const settlementData: SettlementData = {
                payerName: payerName,
                payeeName: payeeName,
                amount: '100.50',
                note: 'Test payment for history',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);

            // Wait for settlement to propagate
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Open history and verify settlement appears
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Verify amount and participants are displayed correctly
            await groupDetailPage.verifySettlementDetails(settlementData);
        });

        simpleTest('should handle settlements where creator is payee', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(memberCount);

            // Create group and add second user
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);
            const groupId = groupDetailPage.inferGroupId();

            // Create settlement where creator is the payee (receives money)
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);

            const settlementData: SettlementData = {
                payerName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                payeeName: await groupDetailPage.header.getCurrentUserDisplayName(),
                amount: '75.00',
                note: 'Creator receives payment',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);

            // Wait for settlement to propagate
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Verify settlement appears correctly
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Verify creator can still edit/delete even when they're the payee
            await groupDetailPage.verifySettlementHasEditButton(settlementData.note);
            await groupDetailPage.verifySettlementHasDeleteButton(settlementData.note);
        });
    });

    simpleTest.describe('Settlement Editing', () => {
        simpleTest('should edit settlement successfully', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(memberCount);

            const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

            // Create group and setup
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

            // Create initial settlement
            let settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);

            const initialData: SettlementData = {
                payerName: payerName,
                payeeName: payeeName,
                amount: '100.50',
                note: 'Initial test payment',
            };

            await settlementForm.submitSettlement(initialData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Open history and click edit
            await groupDetailPage.openHistoryIfClosed();
            settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

            // Verify update form is shown
            await settlementForm.verifyUpdateMode();

            // Verify current values are populated
            await settlementForm.verifyFormValues({
                amount: initialData.amount,
                note: initialData.note,
            });

            // Update the settlement
            const updatedData = {
                amount: '150.75',
                note: 'Updated test payment',
            };

            await settlementForm.updateSettlement(updatedData);

            // Wait for modal to close and update to propagate
            await settlementForm.waitForModalClosed();
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Verify updated settlement in history
            await groupDetailPage.verifySettlementInHistoryVisible(updatedData.note);
            await groupDetailPage.verifySettlementDetails({
                note: updatedData.note,
                amount: updatedData.amount,
                payerName: initialData.payerName,
                payeeName: initialData.payeeName,
            });
        });

        simpleTest('should validate form inputs during edit', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(memberCount);

            const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

            // Create group and settlement
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

            let settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);

            const initialData: SettlementData = {
                payerName,
                payeeName,
                amount: '50.00',
                note: 'Validation test payment',
            };

            await settlementForm.submitSettlement(initialData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Open edit form
            await groupDetailPage.openHistoryIfClosed();
            settlementForm = await groupDetailPage.clickEditSettlement(initialData.note);

            // Test invalid amount
            await settlementForm.clearAndFillAmount('0');
            await settlementForm.verifyUpdateButtonDisabled();

            // Test negative amount
            await settlementForm.clearAndFillAmount('-50');
            await settlementForm.verifyUpdateButtonDisabled();

            // Test valid amount
            await settlementForm.clearAndFillAmount('75.50');
            await settlementForm.verifyUpdateButtonEnabled();

            // Close without saving
            await settlementForm.closeModal();
            await settlementForm.waitForModalClosed();

            // Verify original settlement is unchanged
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementDetails({
                note: initialData.note,
                amount: initialData.amount,
                payerName: initialData.payerName,
                payeeName: initialData.payeeName,
            });
        });
    });

    simpleTest.describe('Settlement Deletion', () => {
        simpleTest('should delete settlement successfully', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(memberCount);

            const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

            // Create group and settlement
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName,
                payeeName,
                amount: '100.00',
                note: 'Payment to be deleted',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Open history and verify settlement exists
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Delete the settlement
            await groupDetailPage.deleteSettlement(settlementData.note, true);

            // Wait for deletion to propagate
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Verify settlement is removed from history
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementNotInHistory(settlementData.note);
        });

        simpleTest('should cancel settlement deletion when user clicks cancel', async ({createLoggedInBrowsers}) => {
            const memberCount = 2;

            // Create two browser instances - User 1 and User 2
            const [
                {page: user1Page, dashboardPage: user1DashboardPage},
                {page: user2Page, dashboardPage: user2DashboardPage}
            ] = await createLoggedInBrowsers(2);

            const payerName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const payeeName = await user2DashboardPage.header.getCurrentUserDisplayName();

            // Create group and settlement
            const [groupDetailPage] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage);

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName: payerName,
                payeeName: payeeName,
                amount: '75.00',
                note: 'Payment to keep',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', {timeout: 5000});

            // Open history and attempt deletion
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.deleteSettlement(settlementData.note, false); // Cancel deletion

            // Verify settlement still exists
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);
        });
    });

    simpleTest.describe('Multi-User Settlement Scenarios', () => {
        simpleTest('should handle partial settlement with 3 users correctly', async ({createLoggedInBrowsers}) => {
            // Create three browser instances - User 1, User 2, and User 3
            const memberCount = 3;

            const [
                {dashboardPage: user1DashboardPage, user: user1},
                {page: user2Page, dashboardPage: user2DashboardPage, user: user2},
                {page: user3Page, dashboardPage: user3DashboardPage, user: user3}
            ] = await createLoggedInBrowsers(memberCount);

            const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
            const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

            const [groupDetailPage1, groupDetailPage2, groupDetailPage3] = await user1DashboardPage.createMultiUserGroup({}, user2DashboardPage, user3DashboardPage);
            const groupId = groupDetailPage1.inferGroupId();

            // 2. User 1 makes a expense for 120, split equally
            // DEBT CALCULATION:
            // - Total expense: $120
            // - Split 3 ways: $120 / 3 = $40 per person
            // - User1 paid full $120, but only owes $40 share
            // - User1 is owed: $120 - $40 = $80 total
            // - User2 owes: $40 to User1
            // - User3 owes: $40 to User1

            const expect1Description = 'Group dinner expense';
            await groupDetailPage1.addExpense(
                {
                    description: expect1Description,
                    amount: 120,
                    paidByDisplayName: user1DisplayName,
                    currency: 'USD',
                    splitType: 'equal',
                },
                memberCount,
            );

            // Synchronize all pages to see the expense
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.waitForExpense(expect1Description)
                await groupDetailPage.waitForPage(groupId, memberCount);
            }

            // 3. Assert initial balances after first expense
            // EXPECTED STATE:
            // - User1 is owed $80 total ($40 from User2 + $40 from User3)
            // - User2 owes $40 to User1
            // - User3 owes $40 to User1
            // This represents the initial debt distribution after the group dinner

            // Verify both debts exist across all pages
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.verifyDebt(user2DisplayName, user1DisplayName, '$40.00');
            }

            // 4. User 2 makes partial settlement of 30
            // SETTLEMENT CALCULATION:
            // - User2 current debt: $40
            // - Payment amount: $30
            // - Remaining debt after payment: $40 - $30 = $10

            const settlementNote1 = 'Partial payment from user2';
            await groupDetailPage1.recordSettlement(
                {
                    payerName: user2DisplayName,
                    payeeName: user1DisplayName,
                    amount: '30',
                    note: settlementNote1,
                },
                memberCount,
            );

            // Synchronize all pages to see the settlement
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.waitForSettlementToAppear(settlementNote1)
                await groupDetailPage.verifySettlementInHistory(settlementNote1)
                await groupDetailPage1.waitForPage(groupId, memberCount);
            }

            // 5. Assert updated balances after partial settlement
            // EXPECTED STATE AFTER $30 PAYMENT:
            // - User1 is now owed $50 total (was $80, received $30)
            // - User2 now owes $10 to User1 (was $40, paid $30)
            // - User3 still owes $40 to User1 (unchanged)
            // The partial payment reduces User2's debt but doesn't fully settle

            // Verify updated debts across all pages
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.verifyDebt(user2DisplayName, user1DisplayName, '$10.00');
                await groupDetailPage.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            }

            // 6. User 2 makes final settlement of remaining $10
            // FINAL SETTLEMENT CALCULATION:
            // - User2 remaining debt: $10
            // - Payment amount: $10
            // - User2 will be fully settled after this payment

            const settlementNote2 = 'Final payment from user2 - all settled!';
            await groupDetailPage1.recordSettlement(
                {
                    payerName: user2DisplayName,
                    payeeName: user1DisplayName,
                    amount: '10',
                    note: settlementNote2,
                },
                memberCount,
            );

            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.waitForSettlementToAppear(settlementNote2)
                await groupDetailPage.verifySettlementInHistory(settlementNote2)
                await groupDetailPage1.waitForPage(groupId, memberCount);
            }

            // 7. Assert final state after all settlements
            // EXPECTED FINAL STATE:
            // - User1 is now owed only $40 (from User3)
            // - User2 is FULLY SETTLED (paid $30 + $10 = $40 total)
            // - User3 still owes $40 to User1 (no payments made)
            // This verifies that partial settlements work correctly in 3-user groups

            // User2 should no longer appear in debt list (settled up)
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await expect(groupDetailPage.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible();
            }

            // User3 should still owe $40
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            }

            // Verify both settlements appear in history
            for(let groupDetailPage of [groupDetailPage1, groupDetailPage2, groupDetailPage3]) {
                await groupDetailPage.verifySettlementInHistory("Partial payment from user2");
                await groupDetailPage.verifySettlementInHistory("Final payment from user2 - all settled!");
            }
        });
    });
});
