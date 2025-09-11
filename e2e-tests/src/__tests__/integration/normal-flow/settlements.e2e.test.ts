import { simpleTest } from '../../../fixtures/simple-test.fixture';
import { GroupDetailPage, JoinGroupPage } from '../../../pages';
import { GroupWorkflow } from '../../../workflows';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';

simpleTest.describe('Settlements - Complete Functionality', () => {
    simpleTest.describe('Settlement Creation and History', () => {
        simpleTest('should create settlement and display in history with proper formatting', async ({ newLoggedInBrowser }) => {
            // Create two browser instances - User 1 and User 2
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            const groupDetailPage2 = new GroupDetailPage(user2Page, user2);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and add second user
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('SettlementHistory'), 'Testing settlement history');

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            // Create settlement
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData = {
                payerName: await groupDetailPage.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.getCurrentUserDisplayName(),
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
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and add second user
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('PayeeCreator'), 'Testing payee as creator');

            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            // Create settlement where creator is the payee (receives money)
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData = {
                payerName: await user2DashboardPage.getCurrentUserDisplayName(),
                payeeName: await groupDetailPage.getCurrentUserDisplayName(),
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
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and setup
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditSettlement'), 'Testing settlement editing');
            
            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            // Create initial settlement
            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const initialData = {
                payerName: await groupDetailPage.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.getCurrentUserDisplayName(),
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
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and settlement
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('ValidationTest'), 'Testing form validation');
            
            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const initialData = {
                payerName: await groupDetailPage.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.getCurrentUserDisplayName(),
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
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and settlement
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('DeleteSettlement'), 'Testing settlement deletion');
            
            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData = {
                payerName: await groupDetailPage.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.getCurrentUserDisplayName(),
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
            const { page: user1Page, dashboardPage: user1DashboardPage, user: user1 } = await newLoggedInBrowser();
            const { page: user2Page, dashboardPage: user2DashboardPage, user: user2 } = await newLoggedInBrowser();
            
            // Create page objects
            const groupDetailPage = new GroupDetailPage(user1Page, user1);
            
            const groupWorkflow = new GroupWorkflow(user1Page);
            const memberCount = 2;

            // Create group and settlement
            const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('CancelDelete'), 'Testing deletion cancellation');
            
            // Share and join
            const shareLink = await groupDetailPage.getShareLink();
            const joinGroupPage = new JoinGroupPage(user2Page);
            await user2Page.goto(shareLink);
            await joinGroupPage.getJoinGroupButton().click();

            const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
            await settlementForm.waitForFormReady(memberCount);

            const settlementData = {
                payerName: await groupDetailPage.getCurrentUserDisplayName(),
                payeeName: await user2DashboardPage.getCurrentUserDisplayName(),
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
});
