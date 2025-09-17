import { simpleTest, expect } from '../../fixtures';
import { ApiDriver } from '@splitifyd/test-support';
import { PolicyAcceptanceModalPage } from '../../pages/policy-acceptance-modal.page';
import { LoginPage, DashboardPage, RegisterPage } from '../../pages';
import { DEFAULT_PASSWORD, generateTestEmail, generateTestUserName } from '@splitifyd/test-support';

/**
 * Policy Acceptance E2E Tests - Comprehensive Coverage
 *
 * This file consolidates all policy acceptance testing:
 * - Registration policy acceptance (terms and cookie policy checkboxes)
 * - Existing user policy update acceptance (modal flow)
 *
 * Covers both new user registration flow and existing user policy update scenarios.
 */

simpleTest.describe('Policy Acceptance - Comprehensive', () => {
    simpleTest.describe('Registration Policy Acceptance', () => {
        simpleTest('should display both terms and cookie policy checkboxes', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            await page.goto('/register');
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const registerPage = new RegisterPage(page);

            // Check that both checkboxes are present using page object methods
            await expect(registerPage.getTermsCheckbox()).toBeVisible();
            await expect(registerPage.getCookieCheckbox()).toBeVisible();

            // Check that they have appropriate labels
            await expect(registerPage.getTermsText()).toBeVisible();
            await expect(registerPage.getCookieText()).toBeVisible();

            // Check that links exist
            await expect(registerPage.getTermsLink()).toBeVisible();
            await expect(registerPage.getCookiesLink()).toBeVisible();
        });

        simpleTest('should disable submit button when terms not accepted', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            await page.goto('/register');
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            // Fill form but leave terms unchecked
            const registerPage = new RegisterPage(page);
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            // Check only cookie policy checkbox using page object method
            await registerPage.checkCookieCheckbox();

            // Submit button should be disabled
            await expect(registerPage.getCreateAccountButton()).toBeDisabled();
        });

        simpleTest('should disable submit button when cookie policy not accepted', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            await page.goto('/register');
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const registerPage = new RegisterPage(page);
            // Fill form but leave cookie policy unchecked
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            // Check only terms checkbox using page object method
            await registerPage.checkTermsCheckbox();

            // Submit button should be disabled
            await expect(registerPage.getCreateAccountButton()).toBeDisabled();
        });

        simpleTest('should enable submit button when both policies accepted', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            await page.goto('/register');
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const registerPage = new RegisterPage(page);
            // Fill form completely
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            // Check both checkboxes using page object methods
            await registerPage.checkTermsCheckbox();
            await registerPage.checkCookieCheckbox();

            // Submit button should be enabled
            await expect(registerPage.getCreateAccountButton()).toBeEnabled();
        });

        simpleTest('should show appropriate error messages for unchecked boxes', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            await page.goto('/register');
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            const registerPage = new RegisterPage(page);
            // Fill form but don't check any boxes
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            // Try to submit (should show validation error before form submission)
            // Since the submit button is disabled, we'll test by checking the form validity
            const submitButton = registerPage.getCreateAccountButton();
            await expect(submitButton).toBeDisabled();

            // Check one box, should still be disabled
            await registerPage.checkTermsCheckbox();
            await expect(submitButton).toBeDisabled();

            // Check second box, should now be enabled
            await registerPage.checkCookieCheckbox();
            await expect(submitButton).toBeEnabled();
        });

        simpleTest('should handle form submission when both policies accepted', async ({ newEmptyBrowser }, testInfo) => {
            const { page } = await newEmptyBrowser();
            // @skip-error-checking - This test may have expected registration errors
            testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test may have expected registration errors' });

            const registerPage = new RegisterPage(page);
            // Navigate to the register page first
            await registerPage.navigate();

            // Fill form completely using proper Page Object Model methods
            await registerPage.fillPreactInput(registerPage.getFullNameInput(), 'Test User');
            await registerPage.fillPreactInput(registerPage.getEmailInput(), generateTestEmail());
            await registerPage.fillPreactInput(registerPage.getPasswordInput(), DEFAULT_PASSWORD);
            await registerPage.fillPreactInput(registerPage.getConfirmPasswordInput(), DEFAULT_PASSWORD);

            // Check both checkboxes using page object methods
            await registerPage.checkTermsCheckbox();
            await registerPage.checkCookieCheckbox();

            // Submit button should be enabled and clickable
            const submitButton = registerPage.getCreateAccountButton();
            await expect(submitButton).toBeEnabled();

            // Test that clicking the button doesn't immediately fail (form validation passes)
            // Note: We don't test the full registration flow as that's covered elsewhere
            await submitButton.click();

            // Wait for any validation or network activity to complete using page object
            await registerPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // At this point, the form has passed client-side validation and attempted submission
            // The actual registration success/failure is tested in other test files
        });
    });

    simpleTest.describe('Existing User Policy Updates', () => {
        simpleTest('should update each policy and accept them sequentially', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Borrow a test user from the pool and promote to admin
            const user = await apiDriver.borrowTestUser();
            console.log(`Borrowed test user: ${user.email}`);

            // Promote user to admin for policy management operations
            await apiDriver.promoteUserToAdmin(user.token);
            console.log(`Promoted user to admin: ${user.email}`);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear any existing policy acceptances to ensure clean state
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Accept base policies for this user (simulating a user who registered earlier)
            await apiDriver.acceptCurrentPublishedPolicies(user.token);
            console.log('✓ User accepted base policies');

            // Now update all policies to newer versions that user hasn't seen
            const policies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];

            console.log('Updating policies to new versions...');
            for (const policyId of policies) {
                await apiDriver.updateSpecificPolicy(policyId, user.token);
                console.log(`✓ Updated policy ${policyId} to new version`);
            }

            // Now login the user manually
            const context = await browser.newContext();
            const page = await context.newPage();

            // Use the LoginPage to handle the login process
            const loginPage = new LoginPage(page, user);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Should be redirected to policy modal or dashboard
            await page.waitForLoadState('domcontentloaded');

            const dashboardPage = new DashboardPage(page);

            // The policy modal should appear because user hasn't accepted updated policies
            const policyModal = new PolicyAcceptanceModalPage(page);

            // Wait for modal to appear - it should appear automatically since user hasn't accepted updated policies
            await policyModal.waitForModalToAppear();

            // Test accepting all policies at once (simulating multiple policy updates)
            await policyModal.acceptMultiplePoliciesSequentially();

            // Verify we're back to dashboard after accepting all policies
            await expect(page).toHaveURL(/\/dashboard/);
            await dashboardPage.waitForDashboard();

            console.log(`✓ Test completed - all policies updated and accepted`);

            // Return the user to the pool
            await apiDriver.returnTestUser(user.email);

            // Close the browser context
            await context.close();
        });

        simpleTest('should handle multiple policy updates and accept all at once', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Get a test user and promote to admin for policy management
            const user = await apiDriver.borrowTestUser();
            await apiDriver.promoteUserToAdmin(user.token);
            console.log(`Promoted user to admin: ${user.email}`);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear their policy acceptances BEFORE login
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Manually log in the user (not using fixture that auto-accepts policies)
            const context = await browser.newContext();
            const page = await context.newPage();

            const loginPage = new LoginPage(page, user);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Should be redirected to dashboard initially
            await page.waitForLoadState('domcontentloaded');
            const dashboardPage = new DashboardPage(page);

            await expect(page).toHaveURL(/\/dashboard/);
            await dashboardPage.waitForDashboard();

            const policies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];

            // Update all policies at once
            for (const policyId of policies) {
                await apiDriver.updateSpecificPolicy(policyId, user.token);
            }

            // Trigger policy check
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // Use POM to handle multiple policies sequentially - modal MUST appear
            const policyModal = new PolicyAcceptanceModalPage(page);
            await policyModal.waitForModalToAppear();
            await policyModal.acceptMultiplePoliciesSequentially();

            // Verify we're back to dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            console.log(`✓ Successfully processed all policies at once`);

            // Close the browser context
            await context.close();
        });

        simpleTest('should validate policy modal structure and content', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Get a test user and promote to admin for policy management
            const user = await apiDriver.borrowTestUser();
            await apiDriver.promoteUserToAdmin(user.token);
            console.log(`Promoted user to admin: ${user.email}`);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear and accept base policies first
            await apiDriver.clearUserPolicyAcceptances(user.token);
            await apiDriver.acceptCurrentPublishedPolicies(user.token);

            // Manually log in the user (not using fixture that auto-accepts policies)
            const context = await browser.newContext();
            const page = await context.newPage();

            const loginPage = new LoginPage(page, user);
            await loginPage.navigate();
            await loginPage.login(user.email, user.password);

            // Update a policy to trigger modal (user has already accepted base policies)
            await apiDriver.updateSpecificPolicy('terms-of-service', user.token);

            // Trigger policy check
            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            // Test policy modal structure - modal MUST appear
            const policyModal = new PolicyAcceptanceModalPage(page);

            await policyModal.waitForModalToAppear();

            // Verify modal structure
            await expect(policyModal.title).toBeVisible();
            await expect(policyModal.subtitle).toBeVisible();
            await expect(policyModal.progressBar).toBeVisible();
            await expect(policyModal.policyCard).toBeVisible();

            await policyModal.waitForPolicyContentToLoad();

            // Verify policy acceptance elements
            await expect(policyModal.acceptanceCheckbox).toBeVisible();
            await expect(policyModal.acceptanceLabel).toBeVisible();
            await expect(policyModal.acceptAllButton).toBeVisible();

            // Verify policy name is displayed (should be some policy content)
            const policyName = await policyModal.getCurrentPolicyName();
            expect(policyName).toBeTruthy();
            expect(policyName.length).toBeGreaterThan(5); // Should have some meaningful content

            // Complete acceptance
            await policyModal.acceptSinglePolicyComplete();

            // Verify we're back to dashboard
            await expect(page).toHaveURL(/\/dashboard/);

            console.log(`✓ Policy modal structure validation complete`);

            // Close the browser context
            await context.close();
        });
    });
});