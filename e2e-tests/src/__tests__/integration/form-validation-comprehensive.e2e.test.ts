import { expect, simpleTest } from '../../fixtures/simple-test.fixture';
import { CreateGroupModalPage } from '../../pages';
import { generateTestGroupName } from '@splitifyd/test-support';
/**
 * Comprehensive Form Validation Test Suite
 * Consolidates validation testing from:
 * - form-validation.e2e.test.ts
 * - auth-validation.e2e.test.ts
 * - negative-value-validation.e2e.test.ts (partial)
 */
simpleTest.describe('Comprehensive Form Validation E2E', () => {
    // Note: Basic authentication form validation (login/register) is tested in auth-and-registration.e2e.test.ts

    simpleTest.describe('Expense Form Validation', () => {
        simpleTest('Expense form required fields and negative values', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('Validation'), 'Testing form validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Test 1: Empty form - submit disabled
            const submitButton = expenseFormPage.getSaveButtonForValidation();
            await expect(submitButton).toBeDisabled();

            // Test 2: Negative amount validation
            const amountField = expenseFormPage.getAmountInput();
            const minValue = await amountField.getAttribute('min');
            expect(minValue).toBe('0.01');

            // Fill description to enable the button (required field)
            await expenseFormPage.fillDescription('Test description');

            // Try to enter negative amount
            await amountField.fill('-50');

            // Try to submit with negative value
            await submitButton.click();

            // Form should not submit - still on add expense page
            await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/add-expense/);

            // Browser validation message should exist
            const validationMessage = await amountField.evaluate((el: HTMLInputElement) => el.validationMessage);
            expect(validationMessage).toBeTruthy();

            // Test 3: Valid positive amount enables submission
            await expenseFormPage.fillAmount('50');
            await expenseFormPage.fillDescription('Valid expense');

            // Select participants if needed
            await expenseFormPage.selectAllParticipants();

            // Should now be able to submit
            await expect(submitButton).toBeEnabled();
        });

        simpleTest('Exact split validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('ExactSplit'), 'Testing exact split validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Split Test Expense');
            await expenseFormPage.fillAmount('100');

            // Switch to exact amounts using page object method
            await expenseFormPage.selectExactAmountsSplit();

            // Modify split amount to create invalid total using page object method
            await expenseFormPage.fillSplitAmount(0, '60'); // Make total = 160 instead of 100

            // Submit should be disabled when exact amounts don't add up correctly
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeDisabled();
        });

        simpleTest('Percentage split validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();

            // Create group and navigate to it
            const groupDetailPage = await dashboardPage.createGroupAndNavigate(generateTestGroupName('PercentSplit'), 'Testing percentage split validation');
            const groupId = groupDetailPage.inferGroupId();
            const memberCount = 1;

            // Navigate to expense form with proper waiting
            const expenseFormPage = await groupDetailPage.clickAddExpenseButton(memberCount);

            // Fill basic expense details using page object methods
            await expenseFormPage.fillDescription('Percentage Test Expense');
            await expenseFormPage.fillAmount('200');

            // Switch to percentage using page object method
            await expenseFormPage.selectPercentageSplit();

            // For a single member, percentage split should be valid by default (100%)
            // Submit should remain enabled since all required fields are filled and percentages are valid
            await expect(expenseFormPage.getSaveButtonForValidation()).toBeEnabled();
        });
    });

    simpleTest.describe('Group Creation Validation', () => {
        simpleTest('Create group form validation', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();
            const createGroupModalPage = new CreateGroupModalPage(page, user);

            await dashboardPage.openCreateGroupModal();
            await expect(createGroupModalPage.isOpen()).resolves.toBe(true);

            // Test 1: Empty form - submit disabled
            const submitButton = createGroupModalPage.getCreateGroupFormButton();
            await expect(submitButton).toBeVisible();
            await expect(submitButton).toBeDisabled();

            // Test 2: Name is required
            await createGroupModalPage.fillGroupForm('', 'Optional description');
            await expect(submitButton).toBeDisabled();

            // Test 3: Valid name enables submit
            await createGroupModalPage.fillGroupForm('Valid Group Name');
            await expect(submitButton).toBeEnabled();
        });

        simpleTest('Group input validation and security', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();
            const createGroupModalPage = new CreateGroupModalPage(page, user);

            await dashboardPage.navigate();
            await dashboardPage.waitForDashboard();

            // Open create group modal
            await dashboardPage.openCreateGroupModal();

            // Test 1: Empty group name - should throw error due to validation
            await createGroupModalPage.fillGroupForm('');
            await expect(createGroupModalPage.trySubmitForm()).rejects.toThrow(/validation errors|disabled/i);

            // Modal should still be open after validation error
            expect(await createGroupModalPage.isOpen()).toBe(true);

            // Test 2: Extremely long group name - should also throw validation error
            const longName = 'A'.repeat(1000);
            await createGroupModalPage.fillGroupForm(longName);
            await expect(createGroupModalPage.trySubmitForm()).rejects.toThrow(/validation errors|disabled/i);

            // Modal should still be open after validation error
            expect(await createGroupModalPage.isOpen()).toBe(true);

            // Check for validation error message (may be slightly different text)
            const errorMessages = await page.locator('[role="alert"], .error-message, .text-red-500, .alert, .validation-error').count();
            expect(errorMessages).toBeGreaterThan(0);
        });

        simpleTest('XSS protection in group names', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();
            const createGroupModalPage = new CreateGroupModalPage(page, user);

            await dashboardPage.navigate();
            await dashboardPage.waitForDashboard();

            // Test group name with special characters (potential XSS)
            const specialName = '<script>alert("xss")</script>';

            await dashboardPage.openCreateGroupModal();
            await createGroupModalPage.fillGroupForm(specialName, 'Test group');
            await createGroupModalPage.submitForm();

            // Wait for group creation to complete - check for expected navigation or modal closure
            await expect(async () => {
                const isModalOpen = await createGroupModalPage.isOpen();
                const isDashboardUrl = page.url().includes('/dashboard');
                const isGroupUrl = page.url().includes('/groups/');

                // Either modal should close OR we should navigate to a group page
                if (isModalOpen && !isDashboardUrl && !isGroupUrl) {
                    throw new Error('Group creation not yet completed');
                }
            }).toPass({ timeout: 2000, intervals: [100, 250] });

            // Check that the script tags are properly escaped/sanitized
            const pageContent = await page.textContent('body');

            // Script should not execute - check that we can see the literal text or it's escaped
            // If properly sanitized, we either see escaped content or the script is stripped
            expect(pageContent).not.toContain('alert("xss")'); // Script shouldn't be executable
        });

        simpleTest('XSS protection in group descriptions', async ({ newLoggedInBrowser }) => {
            const { page, dashboardPage, user } = await newLoggedInBrowser();
            const createGroupModalPage = new CreateGroupModalPage(page, user);

            await dashboardPage.navigate();
            await dashboardPage.waitForDashboard();

            // Open create group modal
            await dashboardPage.openCreateGroupModal();

            // Test potentially malicious description
            const maliciousDescription = '<script>window.location="http://evil.com"</script>';

            await createGroupModalPage.fillGroupForm('Security Test', maliciousDescription);

            // Try to submit - the key test is that malicious script shouldn't execute
            await createGroupModalPage.submitForm();

            // Wait for form submission to complete and check for any malicious redirects
            await expect(async () => {
                const currentUrl = page.url();
                // If we're being redirected to evil.com, that indicates XSS execution
                if (currentUrl.includes('evil.com') || currentUrl.includes('javascript:')) {
                    throw new Error('Malicious redirect detected - XSS vulnerability!');
                }

                // Check that we're in a legitimate state (either still on dashboard or on a group page)
                const isLegitimate = currentUrl.includes('/dashboard') || currentUrl.includes('/groups/');
                if (!isLegitimate) {
                    throw new Error('Unexpected navigation state');
                }
            }).toPass({ timeout: 2000, intervals: [100, 250] });

            // Check that we're still on the legitimate site, not redirected to evil.com
            // This is the key security test - script shouldn't have executed
            expect(page.url()).toContain('/dashboard');
            expect(page.url()).not.toContain('evil.com');

            // Also check that script didn't execute by looking for any javascript: protocol
            const currentUrl = page.url();
            expect(currentUrl).not.toContain('javascript:');
        });
    });
});
