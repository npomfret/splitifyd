import { simpleTest, expect } from '../../fixtures';
import { ApiDriver } from '@splitifyd/test-support';
import { PolicyAcceptanceModalPage } from '../../pages/policy-acceptance-modal.page';
import { LoginPage, DashboardPage, RegisterPage, HomepagePage } from '../../pages';
import { DEFAULT_PASSWORD, generateTestEmail } from '@splitifyd/test-support';

/**
 * Policy Acceptance E2E Tests
 *
 * This file consolidates all policy acceptance testing:
 * - Policy page navigation and loading
 * - Registration policy acceptance (terms and cookie policy checkboxes)
 * - Existing user policy update acceptance (modal flow)
 */

simpleTest.describe('Policy Acceptance', () => {
    simpleTest.describe('Policy Page Navigation', () => {
        simpleTest('should load and navigate between policy pages without errors', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const homepagePage = new HomepagePage(page);

            // Test all three policy pages load properly
            const policyPages = [
                { path: '/terms', heading: /Terms of Service|Terms and Conditions/ },
                { path: '/privacy', heading: /Privacy Policy|Privacy/ },
                { path: '/cookies', heading: /Cookie Policy|Cookie/ },
            ];

            for (const { path, heading } of policyPages) {
                await homepagePage.navigateToStaticPath(path);
                await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
                await homepagePage.getHeadingByLevel(1).filter({ hasText: heading }).first().waitFor();

                // Wait for policy content to fully load - the loading spinner should disappear
                await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 5000 });
            }

            // Test footer navigation from login page
            await page.goto('/login');
            await homepagePage.getTermsLink().click();
            await expect(page).toHaveURL(/\/terms/);

            await page.goto('/login');
            await homepagePage.getPrivacyLink().click();
            await expect(page).toHaveURL(/\/privacy/);
        });
    });
    simpleTest.describe('Registration Policy Acceptance', () => {
        simpleTest('should require both policy checkboxes for registration', async ({ newEmptyBrowser }) => {
            const { page } = await newEmptyBrowser();
            const registerPage = new RegisterPage(page);
            await registerPage.navigate();

            // Verify both checkboxes and links are present
            await expect(registerPage.getTermsCheckbox()).toBeVisible();
            await expect(registerPage.getCookieCheckbox()).toBeVisible();
            await expect(registerPage.getTermsLink()).toBeVisible();
            await expect(registerPage.getCookiesLink()).toBeVisible();

            // Fill form completely
            await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
            await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
            await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
            await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

            const submitButton = registerPage.getCreateAccountButton();

            // Submit should be disabled with no checkboxes
            await expect(submitButton).toBeDisabled();

            // Submit should be disabled with only terms checked
            await registerPage.checkTermsCheckbox();
            await expect(submitButton).toBeDisabled();

            // Submit should be disabled with only cookie policy checked
            await registerPage.uncheckTermsCheckbox();
            await registerPage.checkCookieCheckbox();
            await expect(submitButton).toBeDisabled();

            // Submit should be enabled with both checked
            await registerPage.checkTermsCheckbox();
            await expect(submitButton).toBeEnabled();
        });
    });

    simpleTest.describe('Existing User Policy Updates', () => {
        simpleTest('should update each policy and accept them sequentially', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Borrow a test user from the pool and promote to admin
            const user = await apiDriver.borrowTestUser();

            // Promote user to admin for policy management operations
            await apiDriver.promoteUserToAdmin(user.token);

            // Clean up test environment to remove any non-standard policies
            await apiDriver.cleanupTestEnvironment(user.token);

            // Ensure base policies exist before testing
            await apiDriver.ensurePoliciesExist();

            // Clear any existing policy acceptances to ensure clean state
            await apiDriver.clearUserPolicyAcceptances(user.token);

            // Accept base policies for this user (simulating a user who registered earlier)
            await apiDriver.acceptCurrentPublishedPolicies(user.token);

            // Now update all policies to newer versions that user hasn't seen
            const policies = ['terms-of-service', 'privacy-policy', 'cookie-policy'];

            for (const policyId of policies) {
                await apiDriver.updateSpecificPolicy(policyId, user.token);
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

            // Close the browser context
            await context.close();
        });

        simpleTest('should validate policy modal structure and content', async ({ browser }) => {
            const apiDriver = new ApiDriver();

            // Get a test user and promote to admin for policy management
            const user = await apiDriver.borrowTestUser();
            await apiDriver.promoteUserToAdmin(user.token);

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

            // Close the browser context
            await context.close();
        });
    });
});
