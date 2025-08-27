import { expect } from '@playwright/test';
import { authenticatedPageTest } from '../../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from '../../../helpers';

setupMCPDebugOnFailure();

authenticatedPageTest.describe('Input Validation Security', () => {
    authenticatedPageTest('should validate group name inputs', async ({ 
        authenticatedPage, 
        dashboardPage, 
        createGroupModalPage 
    }) => {
        const { page } = authenticatedPage;
        
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();
        
        // Open create group modal
        await dashboardPage.openCreateGroupModal();
        
        // Test empty group name
        await createGroupModalPage.fillGroupForm('');
        await createGroupModalPage.submitForm();
        
        // Should still be on the modal (form validation should prevent submission)
        expect(await createGroupModalPage.isOpen()).toBe(true);
        
        // Test extremely long group name
        const longName = 'A'.repeat(1000);
        await createGroupModalPage.fillGroupForm(longName);
        await createGroupModalPage.submitForm();
        
        // Should either limit input or show validation error
        const modalVisible = await createGroupModalPage.isOpen();
        if (!modalVisible) {
            // If form submitted, check that name was truncated
            await page.waitForURL(/\/groups\//);
            const pageContent = await page.textContent('body');
            expect(pageContent).not.toContain(longName);
        }
    });

    authenticatedPageTest('should handle special characters in group names safely', async ({ 
        authenticatedPage, 
        dashboardPage,
        createGroupModalPage 
    }) => {
        const { page } = authenticatedPage;
        
        await dashboardPage.navigate();
        await dashboardPage.waitForDashboard();
        
        // Test group name with special characters (potential XSS)
        const specialName = '<script>alert("xss")</script>';
        
        await dashboardPage.openCreateGroupModal();
        await createGroupModalPage.fillGroupForm(specialName, 'Test group');
        await createGroupModalPage.submitForm();
        
        // Wait for group creation - may redirect or stay on same page
        await page.waitForTimeout(1000);
        
        // Check that the script tags are properly escaped/sanitized
        const pageContent = await page.textContent('body');
        
        // Script should not execute - check that we can see the literal text or it's escaped
        // If properly sanitized, we either see escaped content or the script is stripped
        expect(pageContent).not.toContain('alert("xss")'); // Script shouldn't be executable
    });

    authenticatedPageTest('should prevent malicious input in group descriptions', async ({ 
        authenticatedPage, 
        dashboardPage, 
        createGroupModalPage 
    }) => {
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
        
        // Wait a moment for any potential redirect (if script executed)
        await page.waitForTimeout(1000);
        
        // Check that we're still on the legitimate site, not redirected to evil.com
        // This is the key security test - script shouldn't have executed
        expect(page.url()).toContain('localhost:8005');
        expect(page.url()).not.toContain('evil.com');
        
        // Also check that script didn't execute by looking for any javascript: protocol
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('javascript:');
    });
});