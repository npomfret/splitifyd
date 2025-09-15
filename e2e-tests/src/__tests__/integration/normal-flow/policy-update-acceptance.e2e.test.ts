import { simpleTest, expect } from '../../../fixtures';
import { ApiDriver } from '@splitifyd/test-support';
import { PolicyAcceptanceModalPage } from '../../../pages/policy-acceptance-modal.page';
import { LoginPage } from '../../../pages/login.page';
import { DashboardPage } from '../../../pages/dashboard.page';

simpleTest.describe('Policy Update Acceptance Modal E2E', () => {
    simpleTest('should update each policy and accept them sequentially', async ({ browser }) => {
        const apiDriver = new ApiDriver();

        // Clean up test environment to remove any non-standard policies
        await apiDriver.cleanupTestEnvironment();

        // Ensure base policies exist before testing
        await apiDriver.ensurePoliciesExist();

        // Borrow a test user from the pool
        const user = await apiDriver.borrowTestUser();
        console.log(`Borrowed test user: ${user.email}`);

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
        await expect(dashboardPage.getWelcomeMessage()).toBeVisible();

        console.log(`✓ Test completed - all policies updated and accepted`);

        // Return the user to the pool
        await apiDriver.returnTestUser(user.email);

        // Close the browser context
        await context.close();
    });

    simpleTest('should handle multiple policy updates and accept all at once', async ({ browser }) => {
        const apiDriver = new ApiDriver();

        // Clean up test environment to remove any non-standard policies
        await apiDriver.cleanupTestEnvironment();

        // Ensure base policies exist before testing
        await apiDriver.ensurePoliciesExist();

        // Get a test user and clear their policy acceptances BEFORE login
        const user = await apiDriver.borrowTestUser();
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
        await expect(dashboardPage.getWelcomeMessage()).toBeVisible();

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
        await expect(dashboardPage.getWelcomeMessage()).toBeVisible();

        console.log(`✓ Successfully processed all policies at once`);

        // Close the browser context
        await context.close();
    });

    simpleTest('should validate policy modal structure and content', async ({ browser }) => {
        const apiDriver = new ApiDriver();

        // Clean up test environment to remove any non-standard policies
        await apiDriver.cleanupTestEnvironment();

        // Ensure base policies exist before testing
        await apiDriver.ensurePoliciesExist();

        // Get a test user and accept base policies first
        const user = await apiDriver.borrowTestUser();
        await apiDriver.clearUserPolicyAcceptances(user.token);
        await apiDriver.acceptCurrentPublishedPolicies(user.token);

        // Manually log in the user (not using fixture that auto-accepts policies)
        const context = await browser.newContext();
        const page = await context.newPage();

        const loginPage = new LoginPage(page, user);
        await loginPage.navigate();
        await loginPage.login(user.email, user.password);

        const dashboardPage = new DashboardPage(page);

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
        await expect(dashboardPage.getWelcomeMessage()).toBeVisible();

        console.log(`✓ Policy modal structure validation complete`);

        // Close the browser context
        await context.close();
    });

});