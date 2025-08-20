import { expect, multiUserTest as test } from '../../fixtures/multi-user-test';
import { setupMCPDebugOnFailure } from '../../helpers';
import { GroupWorkflow } from '../../workflows';
import { generateTestGroupName } from '../../utils/test-helpers';
import { GroupDetailPage } from '../../pages/group-detail.page';
import { SettlementFormPage } from '../../pages/settlement-form.page';

setupMCPDebugOnFailure();

test.describe('Settlement Edit and Delete', () => {
    test('should edit a settlement successfully', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditSettlement'), 'Testing settlement editing');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create an initial settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const initialSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '100.50',
            note: 'Initial test payment'
        };

        await settlementForm.submitSettlement(initialSettlement, memberCount);

        // Wait for settlement to propagate via real-time updates
        await page.waitForLoadState('domcontentloaded');

        // Verify settlement appears in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Initial test payment/);
        await groupDetailPage.closeModal();

        // Click edit button for the settlement
        await groupDetailPage.clickEditSettlement(initialSettlement.note);

        // Verify the form is in update mode
        const settlementFormPage = new SettlementFormPage(page);
        const modal = settlementFormPage.getModal();
        await expect(modal.getByRole('heading', { name: 'Update Payment' })).toBeVisible();

        // Verify current values are populated
        const amountInput = settlementFormPage.getAmountInput();
        const noteInput = settlementFormPage.getNoteInput();
        
        await expect(amountInput).toHaveValue('100.50');
        await expect(noteInput).toHaveValue('Initial test payment');

        // Update the settlement with new values
        await settlementFormPage.fillPreactInput(amountInput, '150.75');
        await settlementFormPage.fillPreactInput(noteInput, 'Updated test payment');

        // Submit the update
        const updateButton = settlementFormPage.getUpdatePaymentButton();
        await expect(updateButton).toBeEnabled();
        await groupDetailPage.clickButton(updateButton, { buttonName: 'Update Payment' });

        // Wait for modal to close
        await expect(modal).not.toBeVisible();

        // Wait for settlement update to propagate
        await page.waitForLoadState('domcontentloaded');

        // Verify the updated settlement appears in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Updated test payment/);
        await groupDetailPage.closeModal();
    });

    test('should delete a settlement successfully', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('DeleteSettlement'), 'Testing settlement deletion');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create an initial settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const testSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '75.00',
            note: 'Payment to be deleted'
        };

        await settlementForm.submitSettlement(testSettlement, memberCount);

        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded');

        // Verify settlement appears in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Payment to be deleted/);
        await groupDetailPage.closeModal();

        // Click delete button for the settlement (this will open history modal)
        await groupDetailPage.clickDeleteSettlement(testSettlement.note, true);

        // Wait for deletion to propagate
        await page.waitForLoadState('domcontentloaded');

        // Verify the settlement is removed from history by checking history modal
        // If there are no settlements, the history should show 'No payment history'
        const showHistoryButton = groupDetailPage.getShowHistoryButton();
        await groupDetailPage.clickButton(showHistoryButton, { buttonName: 'Show History' });
        
        // Check if settlement is gone - either no history message or settlement not visible
        const hasNoHistory = await page.getByText(/no payment history/i).isVisible({ timeout: 1000 });
        if (!hasNoHistory) {
            await expect(page.getByText(/Payment to be deleted/i)).not.toBeVisible();
        }
        await groupDetailPage.closeModal();
    });

    test('should cancel settlement deletion when user clicks cancel', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('CancelDelete'), 'Testing cancel deletion');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create an initial settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const testSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '50.00',
            note: 'Payment to keep'
        };

        await settlementForm.submitSettlement(testSettlement, memberCount);

        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded');

        // Verify settlement appears in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Payment to keep/);
        await groupDetailPage.closeModal();

        // Click delete button but cancel
        await groupDetailPage.clickDeleteSettlement(testSettlement.note, false);

        // Click cancel in the confirmation dialog
        const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Delete Payment' });
        await groupDetailPage.clickButton(confirmDialog.getByRole('button', { name: 'Cancel' }), { buttonName: 'Cancel' });

        // Wait for confirmation dialog to close
        await expect(confirmDialog).not.toBeVisible();

        // Verify the settlement is still in history
        await groupDetailPage.openHistoryAndVerifySettlement(/Payment to keep/);
        await groupDetailPage.closeModal();
    });

    test('should prevent non-creators from editing settlements', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditPermissions'), 'Testing edit permissions');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create a settlement as user1 (authenticated user)
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const testSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '25.00',
            note: 'Creator only payment'
        };

        await settlementForm.submitSettlement(testSettlement, memberCount);
        
        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded');
        
        // Verify settlement is visible to creator
        await groupDetailPage.openHistoryAndVerifySettlement(/Creator only payment/);
        await groupDetailPage.closeModal();

        // Switch to second user's view
        await page2.bringToFront();
        const groupDetailPage2 = new GroupDetailPage(page2);
        
        // Verify the settlement is visible to second user and check edit button availability
        const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
        await groupDetailPage2.clickButton(showHistoryButton2, { buttonName: 'Show History' });
        
        // Verify settlement is visible to second user
        await expect(page2.getByText(/Creator only payment/i)).toBeVisible();
        
        // Verify that edit button is not available for non-creator
        // The edit button should not exist for settlements created by others
        const editButton = groupDetailPage2.getSettlementEditButton(testSettlement.note);
        await expect(editButton).not.toBeVisible();
        
        await groupDetailPage2.closeModal();
    });

    test('should prevent non-creators from deleting settlements', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('DeletePermissions'), 'Testing delete permissions');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create a settlement as user1 (authenticated user)
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const testSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '35.00',
            note: 'Creator only delete'
        };

        await settlementForm.submitSettlement(testSettlement, memberCount);
        
        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded');
        
        // Verify settlement is visible to creator
        await groupDetailPage.openHistoryAndVerifySettlement(/Creator only delete/);
        await groupDetailPage.closeModal();

        // Switch to second user's view
        await page2.bringToFront();
        const groupDetailPage2 = new GroupDetailPage(page2);
        
        // Verify the settlement is visible to second user and check delete button availability
        const showHistoryButton2 = groupDetailPage2.getShowHistoryButton();
        await groupDetailPage2.clickButton(showHistoryButton2, { buttonName: 'Show History' });
        
        // Verify settlement is visible to second user
        await expect(page2.getByText(/Creator only delete/i)).toBeVisible();
        
        // Verify that delete button is not available for non-creator
        // The delete button should not exist for settlements created by others
        const deleteButton = groupDetailPage2.getSettlementDeleteButton(testSettlement.note);
        await expect(deleteButton).not.toBeVisible();
        
        await groupDetailPage2.closeModal();
    });

    test('should handle settlement editing with form validation', async ({ authenticatedPage, groupDetailPage, secondUser }) => {
        const { page } = authenticatedPage;
        const groupWorkflow = new GroupWorkflow(page);
        const memberCount = 2;

        // Create group and add second user
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('EditValidation'), 'Testing edit form validation');

        // Share and join
        const page2 = secondUser.page;
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Create an initial settlement
        const settlementForm = await groupDetailPage.clickSettleUpButton(memberCount);
        await settlementForm.waitForFormReady(memberCount);

        const initialSettlement = {
            payerName: authenticatedPage.user.displayName,
            payeeName: secondUser.user.displayName,
            amount: '80.00',
            note: 'Validation test payment'
        };

        await settlementForm.submitSettlement(initialSettlement, memberCount);
        
        // Wait for settlement to propagate
        await page.waitForLoadState('domcontentloaded');
        
        // Verify settlement is visible
        await groupDetailPage.openHistoryAndVerifySettlement(/Validation test payment/);
        await groupDetailPage.closeModal();

        // Click edit button
        await groupDetailPage.clickEditSettlement(initialSettlement.note);

        // Verify form is in update mode
        const settlementFormPage = new SettlementFormPage(page);
        const modal = settlementFormPage.getModal();
        await expect(modal.getByRole('heading', { name: 'Update Payment' })).toBeVisible();

        // Test negative amount validation
        const amountInput = settlementFormPage.getAmountInput();
        await settlementFormPage.fillPreactInput(amountInput, '-10');

        // Update button should be disabled
        const updateButton = settlementFormPage.getUpdatePaymentButton();
        await expect(updateButton).toBeDisabled();

        // Fix the amount
        await settlementFormPage.fillPreactInput(amountInput, '90.00');
        await expect(updateButton).toBeEnabled();

        // Test empty amount validation
        await settlementFormPage.fillPreactInput(amountInput, '');
        await expect(updateButton).toBeDisabled();

        // Close modal without saving
        await groupDetailPage.closeModal();
        await expect(modal).not.toBeVisible();

        // Verify original settlement is unchanged
        await groupDetailPage.openHistoryAndVerifySettlement(/Validation test payment/);
        await groupDetailPage.closeModal();
    });
});