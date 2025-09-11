import { simpleTest as test, expect } from '../../../fixtures/simple-test.fixture';
import { GroupWorkflow } from '../../../workflows';
import { GroupDetailPage } from '../../../pages';
import { generateTestGroupName } from '../../../../../packages/test-support/test-helpers.ts';

test.describe('Settlement Management', () => {
    // Note: Basic settlement creation and balance update tests have been removed
    // as they are better covered by the comprehensive three-user-settlement test

    test('should validate settlement form', async ({ newLoggedInBrowser }) => {
        // Create two browser instances - user 1 and user 2
        const { page: page1, dashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: page2, user: user2 } = await newLoggedInBrowser();

        const groupWorkflow = new GroupWorkflow(page1);
        const groupDetailPage = new GroupDetailPage(page1, user1);
        const memberCount = 2;

        // Create group and navigate to it
        await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Validation'), 'Testing form validation');

        // Share and join with second user
        await groupDetailPage.shareGroupAndWaitForJoin(page2);

        // Open settlement form
        const settlementFormPage = await groupDetailPage.clickSettleUpButton(memberCount);
        const modal = settlementFormPage.getModal();
        await expect(modal).toBeVisible();

        // Test negative amount
        const amountInput = settlementFormPage.getAmountInput();
        await settlementFormPage.fillPreactInput(amountInput, '-10');

        // Try to submit - should be disabled due to validation
        const submitButton = settlementFormPage.getRecordPaymentButton();
        await expect(submitButton).toBeDisabled();

        // Fix amount
        await settlementFormPage.fillPreactInput(amountInput, '10');

        // Test same payer and payee by directly setting form state
        const payerSelect = settlementFormPage.getPayerSelect();

        // Get the first user value from payer select
        await payerSelect.selectOption({ index: 1 });
        const selectedPayerValue = await payerSelect.inputValue();

        // Manually set the payee to the same value using JavaScript to bypass filtering
        await page1.evaluate((payerValue: string) => {
            const payeeSelect = document.querySelector('select[id="payee"]') as HTMLSelectElement;
            if (payeeSelect) {
                payeeSelect.value = payerValue;
                payeeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, selectedPayerValue);

        // Should be disabled due to same person validation
        await expect(submitButton).toBeDisabled();

        // Close modal by clicking close button or outside
        await groupDetailPage.closeModal();
        await expect(modal).not.toBeVisible();
    });
});
