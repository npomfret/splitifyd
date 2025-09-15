import { expect } from '@playwright/test';
import { simpleTest } from '../../fixtures';
import { CreateGroupModalPage } from '../../pages';

simpleTest.describe('Authentication Security', () => {
    simpleTest('should redirect unauthenticated users to login', async ({ newEmptyBrowser }) => {
        const { page, loginPage } = await newEmptyBrowser();
        // Clear authentication by going to login and not logging in
        await page.goto('/login');

        // Try to access protected dashboard directly
        await page.goto('/dashboard');

        // Should be redirected to login
        await expect(page).toHaveURL(/\/login/);
    });

    simpleTest('should protect group pages from unauthorized access', async ({ newLoggedInBrowser }) => {
        const { page, dashboardPage, user } = await newLoggedInBrowser();
        const createGroupModalPage = new CreateGroupModalPage(page, user);

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

simpleTest.describe('Multi-User Security', () => {
    simpleTest('should prevent users from accessing other users groups', async ({ newLoggedInBrowser }, testInfo) => {
        // Skip error checking - unauthorized user will get expected 404s when trying to access private group
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'Expected 404 errors when unauthorized user tries to access private group' });
        // Create two browser instances - User 1 and User 2
        const { page: page1, dashboardPage, user: user1 } = await newLoggedInBrowser();
        const { page: page2, user: user2 } = await newLoggedInBrowser();

        // Create page objects
        const createGroupModalPage = new CreateGroupModalPage(page1, user1);

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
