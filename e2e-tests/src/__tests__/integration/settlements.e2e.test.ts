import { simpleTest, expect } from '../../fixtures';
import { JoinGroupPage, GroupDetailPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
import { SettlementData } from '../../pages/settlement-form.page.ts';

simpleTest.describe('Settlements - Complete Functionality', () => {
    simpleTest.describe('Settlement Creation and History', () => {
        simpleTest('should create settlement and display in history with proper formatting', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and add second user
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('SettlementHistory'), 'Testing settlement history');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            // Create settlement
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName: await groupDetailPage.header.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                amount: '100.50',
                note: 'Test payment for history',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);

            // Wait for settlement to propagate
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Open history and verify settlement appears
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Verify amount and participants are displayed correctly
            await groupDetailPage.verifySettlementDetails({
                note: settlementData.note,
                amount: settlementData.amount,
                payerName: settlementData.payerName,
                payeeName: settlementData.payeeName,
            });
        });

        simpleTest('should handle settlements where creator is payee', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage} = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and add second user
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('PayeeCreator'), 'Testing payee as creator');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            // Create settlement where creator is the payee (receives money)
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                payeeName: await groupDetailPage.header.getCurrentUserDisplayName(),
                amount: '75.00',
                note: 'Creator receives payment',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);

            // Wait for settlement to propagate
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Verify settlement appears correctly
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Verify creator can still edit/delete even when they're the payee
            await groupDetailPage.verifySettlementHasEditButton(settlementData.note);
            await groupDetailPage.verifySettlementHasDeleteButton(settlementData.note);
        });
    });

    simpleTest.describe('Settlement Editing', () => {
        simpleTest('should edit settlement successfully', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and setup
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('EditSettlement'), 'Testing settlement editing');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            // Create initial settlement
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const initialData: SettlementData = {
                payerName: await groupDetailPage.header.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                amount: '100.50',
                note: 'Initial test payment',
            };

            await settlementForm.submitSettlement(initialData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Open history and click edit
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.clickEditSettlement(initialData.note);

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
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Verify updated settlement in history
            await groupDetailPage.verifySettlementInHistoryVisible(updatedData.note);
            await groupDetailPage.verifySettlementDetails({
                note: updatedData.note,
                amount: updatedData.amount,
                payerName: initialData.payerName,
                payeeName: initialData.payeeName,
            });
        });

        simpleTest('should validate form inputs during edit', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and settlement
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('ValidationTest'), 'Testing form validation');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const initialData: SettlementData = {
                payerName: await groupDetailPage.header.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                amount: '50.00',
                note: 'Validation test payment',
            };

            await settlementForm.submitSettlement(initialData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Open edit form
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.clickEditSettlement(initialData.note);

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
        simpleTest('should delete settlement successfully', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and settlement
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('DeleteSettlement'), 'Testing settlement deletion');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName: await groupDetailPage.header.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                amount: '100.00',
                note: 'Payment to be deleted',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Open history and verify settlement exists
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);

            // Delete the settlement
            await groupDetailPage.deleteSettlement(settlementData.note, true);

            // Wait for deletion to propagate
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Verify settlement is removed from history
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementNotInHistory(settlementData.note);
        });

        simpleTest('should cancel settlement deletion when user clicks cancel', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage } = await newLoggedInBrowser();

            const memberCount = 2;

            // Create group and settlement
            const groupDetailPage = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('CancelDelete'), 'Testing deletion cancellation');
            const groupId = groupDetailPage.inferGroupId();

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const groupDetailPage2 = await JoinGroupPage.joinGroupViaShareLink(user2Page, shareLink, groupId);

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData: SettlementData = {
                payerName: await groupDetailPage.header.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.header.getCurrentUserDisplayName(),
                amount: '75.00',
                note: 'Payment to keep',
            };

            await settlementForm.submitSettlement(settlementData, memberCount);
            await user1Page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Open history and attempt deletion
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.deleteSettlement(settlementData.note, false); // Cancel deletion

            // Verify settlement still exists
            await groupDetailPage.openHistoryIfClosed();
            await groupDetailPage.verifySettlementInHistoryVisible(settlementData.note);
        });
    });

    simpleTest.describe('Multi-User Settlement Scenarios', () => {
        simpleTest('should handle partial settlement with 3 users correctly', async ({ newLoggedInBrowser }) => {
            // Create three browser instances - User 1, User 2, and User 3
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            const { page: user3Page, dashboardPage: user3DashboardPage, user: user3 } = await newLoggedInBrowser();

            // Create page objects
            const groupDetailPage2 = new GroupDetailPage(user2Page);
            const groupDetailPage3 = new GroupDetailPage(user3Page);

            // Verify all 3 users are distinct to prevent flaky test failures
            expect(user1.email).not.toBe(user2.email);
            expect(user1.email).not.toBe(user3.email);
            expect(user2.email).not.toBe(user3.email);

            const user1DisplayName = await user1DashboardPage.header.getCurrentUserDisplayName();
            const user2DisplayName = await user2DashboardPage.header.getCurrentUserDisplayName();
            const user3DisplayName = await user3DashboardPage.header.getCurrentUserDisplayName();

            // Assert all users have different display names
            expect(user1DisplayName).not.toBe(user2DisplayName);
            expect(user1DisplayName).not.toBe(user3DisplayName);
            expect(user2DisplayName).not.toBe(user3DisplayName);

            // 1. Create a group with 3 users
            const groupDetailPage1 = await user1DashboardPage.createGroupAndNavigate(generateTestGroupName('3UserSettle'), 'Testing 3-user settlement');
            const groupId = groupDetailPage1.inferGroupId();

            // Get share link and have users join SEQUENTIALLY (not concurrently)
            const shareLink = await groupDetailPage1.getShareLink();

            // SEQUENTIAL JOIN 1: Second user joins first
            const joinGroupPage2 = new JoinGroupPage(user2Page);
            await joinGroupPage2.joinGroupUsingShareLink(shareLink);

            // Verify second user can actually access the group page
            const page2Url = user2Page.url();
            if (!page2Url.includes(`/groups/${groupId}`)) {
                throw new Error(`Second user join verification failed. Expected to be on /groups/${groupId}, but on: ${page2Url}`);
            }

            // WAIT for second user to be fully synchronized before third user joins
            await groupDetailPage1.waitForPage(groupId, 2);
            await groupDetailPage2.waitForPage(groupId, 2);

            // SEQUENTIAL JOIN 2: Third user joins ONLY AFTER second user is fully synchronized
            const joinGroupPage3 = new JoinGroupPage(user3Page);
            await joinGroupPage3.joinGroupUsingShareLink(shareLink);

            // Verify third user can actually access the group page
            const page3Url = user3Page.url();
            if (!page3Url.includes(`/groups/${groupId}`)) {
                throw new Error(`Third user join verification failed. Expected to be on /groups/${groupId}, but on: ${page3Url}`);
            }

            // Synchronize all pages to see all 3 members
            await groupDetailPage1.waitForPage(groupId, 3);
            await groupDetailPage2.waitForPage(groupId, 3);
            await groupDetailPage3.waitForPage(groupId, 3);

            // 2. User 1 makes a expense for 120, split equally
            // DEBT CALCULATION:
            // - Total expense: $120
            // - Split 3 ways: $120 / 3 = $40 per person
            // - User1 paid full $120, but only owes $40 share
            // - User1 is owed: $120 - $40 = $80 total
            // - User2 owes: $40 to User1
            // - User3 owes: $40 to User1

            await groupDetailPage1.addExpense(
                {
                    description: 'Group dinner expense',
                    amount: 120,
                    paidByDisplayName: user1DisplayName,
                    currency: 'USD',
                    splitType: 'equal',
                },
                3,
            );

            // Synchronize all pages to see the expense
            await groupDetailPage1.waitForPage(groupId, 3);
            await groupDetailPage2.waitForPage(groupId, 3);
            await groupDetailPage3.waitForPage(groupId, 3);

            // Verify expense appears across all pages
            await groupDetailPage1.waitForExpense('Group dinner expense');
            await groupDetailPage2.waitForExpense('Group dinner expense');
            await groupDetailPage3.waitForExpense('Group dinner expense');

            // 3. Assert initial balances after first expense
            // EXPECTED STATE:
            // - User1 is owed $80 total ($40 from User2 + $40 from User3)
            // - User2 owes $40 to User1
            // - User3 owes $40 to User1
            // This represents the initial debt distribution after the group dinner

            // Verify both debts exist across all pages
            await groupDetailPage1.verifyDebt(user2DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage2.verifyDebt(user2DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage3.verifyDebt(user2DisplayName, user1DisplayName, '$40.00');

            // 4. User 2 makes partial settlement of 30
            // SETTLEMENT CALCULATION:
            // - User2 current debt: $40
            // - Payment amount: $30
            // - Remaining debt after payment: $40 - $30 = $10

            await groupDetailPage1.recordSettlement(
                {
                    payerName: user2DisplayName,
                    payeeName: user1DisplayName,
                    amount: '30',
                    note: 'Partial payment from user2',
                },
                3,
            );

            // Synchronize all pages to see the settlement
            await groupDetailPage1.waitForPage(groupId, 3);
            await groupDetailPage2.waitForPage(groupId, 3);
            await groupDetailPage3.waitForPage(groupId, 3);

            // Verify settlement appears in history across all pages
            await groupDetailPage1.verifySettlementInHistory('Partial payment from user2');
            await groupDetailPage2.verifySettlementInHistory('Partial payment from user2');
            await groupDetailPage3.verifySettlementInHistory('Partial payment from user2');

            // 5. Assert updated balances after partial settlement
            // EXPECTED STATE AFTER $30 PAYMENT:
            // - User1 is now owed $50 total (was $80, received $30)
            // - User2 now owes $10 to User1 (was $40, paid $30)
            // - User3 still owes $40 to User1 (unchanged)
            // The partial payment reduces User2's debt but doesn't fully settle

            // Verify updated debts across all pages
            await groupDetailPage1.verifyDebt(user2DisplayName, user1DisplayName, '$10.00');
            await groupDetailPage2.verifyDebt(user2DisplayName, user1DisplayName, '$10.00');
            await groupDetailPage3.verifyDebt(user2DisplayName, user1DisplayName, '$10.00');

            await groupDetailPage1.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage2.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage3.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');

            // 6. User 2 makes final settlement of remaining $10
            // FINAL SETTLEMENT CALCULATION:
            // - User2 remaining debt: $10
            // - Payment amount: $10
            // - User2 will be fully settled after this payment

            await groupDetailPage1.recordSettlement(
                {
                    payerName: user2DisplayName,
                    payeeName: user1DisplayName,
                    amount: '10',
                    note: 'Final payment from user2 - all settled!',
                },
                3,
            );

            // Synchronize all pages to see the final settlement
            await groupDetailPage1.waitForPage(groupId, 3);
            await groupDetailPage2.waitForPage(groupId, 3);
            await groupDetailPage3.waitForPage(groupId, 3);

            // 7. Assert final state after all settlements
            // EXPECTED FINAL STATE:
            // - User1 is now owed only $40 (from User3)
            // - User2 is FULLY SETTLED (paid $30 + $10 = $40 total)
            // - User3 still owes $40 to User1 (no payments made)
            // This verifies that partial settlements work correctly in 3-user groups

            // User2 should no longer appear in debt list (settled up)
            await expect(groupDetailPage1.getDebtInfo(user2DisplayName, user1DisplayName)).not.toBeVisible();

            // User3 should still owe $40
            await groupDetailPage1.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage2.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');
            await groupDetailPage3.verifyDebt(user3DisplayName, user1DisplayName, '$40.00');

            // Verify both settlements appear in history
            await groupDetailPage1.verifySettlementInHistory("Partial payment from user2");
            await groupDetailPage1.verifySettlementInHistory("Final payment from user2 - all settled!");

            await groupDetailPage2.verifySettlementInHistory("Partial payment from user2");
            await groupDetailPage2.verifySettlementInHistory("Final payment from user2 - all settled!");

            await groupDetailPage3.verifySettlementInHistory("Partial payment from user2");
            await groupDetailPage3.verifySettlementInHistory("Final payment from user2 - all settled!");

        });
    });
});
