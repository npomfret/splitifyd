import { expect } from '@playwright/test';
import { authenticatedPageTest } from '../../../fixtures/authenticated-page-test';
import { multiUserTest } from '../../../fixtures/multi-user-test';

authenticatedPageTest.describe('Authentication Security', () => {
    authenticatedPageTest('should redirect unauthenticated users to login', async ({ page }) => {
        // Clear authentication by going to login and not logging in
        await page.goto('/login');

        // Try to access protected dashboard directly
        await page.goto('/dashboard');

        // Should be redirected to login
        await expect(page).toHaveURL(/\/login/);
    });

    authenticatedPageTest('should protect group pages from unauthorized access', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
        const { page } = authenticatedPage;

        // Create a group while authenticated
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Security Test Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await page.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = page.url().split('/groups/')[1];

        // Navigate back to dashboard and log out properly
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();
        await dashboardPage.logout();

        // Try to access the group page directly while logged out
        await page.goto(`/groups/${groupId}`);

        // Should be redirected to login (may take a few seconds for auth check)
        await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 15000 });
    });
});

multiUserTest.describe('Multi-User Security', () => {
    multiUserTest('should prevent users from accessing other users groups', async ({ authenticatedPage, secondUser, dashboardPage, createGroupModalPage }) => {
        const { page: page1 } = authenticatedPage;
        const { page: page2 } = secondUser;

        // User 1 creates a private group using POMs
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm('Private Group');
        await createGroupModalPage.submitForm();

        // Wait for group creation and get the group ID from URL
        await page1.waitForURL(/\/groups\/[a-zA-Z0-9]+/);
        const groupId = page1.url().split('/groups/')[1];

        // User 2 tries to access User 1's group directly
        await page2.goto(`/groups/${groupId}`);

        // Should be redirected away (either to dashboard or 404)
        await expect(page2).not.toHaveURL(new RegExp(`/groups/${groupId}`));
    });
});
