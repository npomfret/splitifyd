import { expect } from '@playwright/test';
import { authenticatedPageTest } from '../../../fixtures/authenticated-page-test';

authenticatedPageTest.describe('Input Validation Security', () => {
    authenticatedPageTest('should validate group name inputs', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
        const { page } = authenticatedPage;

        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();

        // Open create group modal
        await dashboardPage.openCreateGroupModal();

        // Test empty group name - should throw error due to validation
        await createGroupModalPage.fillGroupForm('');
        await expect(createGroupModalPage.trySubmitForm()).rejects.toThrow(/validation errors|disabled/i);

        // Modal should still be open after validation error
        expect(await createGroupModalPage.isOpen()).toBe(true);

        // Test extremely long group name - should also throw validation error
        const longName = 'A'.repeat(1000);
        await createGroupModalPage.fillGroupForm(longName);
        await expect(createGroupModalPage.trySubmitForm()).rejects.toThrow(/validation errors|disabled/i);

        // Modal should still be open after validation error
        expect(await createGroupModalPage.isOpen()).toBe(true);

        // Check for validation error message (may be slightly different text)
        const errorMessages = await page.locator('[role="alert"], .error-message, .text-red-500, .alert, .validation-error').count();
        expect(errorMessages).toBeGreaterThan(0);
    });

    authenticatedPageTest('should handle special characters in group names safely', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
        const { page } = authenticatedPage;

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

    authenticatedPageTest('should prevent malicious input in group descriptions', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
        const { page } = authenticatedPage;

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
