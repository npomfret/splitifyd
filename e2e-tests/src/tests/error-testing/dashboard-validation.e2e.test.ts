import { authenticatedPageTest, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { generateTestGroupName } from '../../utils/test-helpers';

setupMCPDebugOnFailure();
setupConsoleErrorReporting();

authenticatedPageTest.describe('Dashboard Validation E2E', () => {
  authenticatedPageTest('should validate group form fields', async ({ authenticatedPage, dashboardPage, createGroupModalPage }) => {
    const { page } = authenticatedPage;
    
    await dashboardPage.openCreateGroupModal();
    
    await expect(createGroupModalPage.isOpen()).resolves.toBe(true);
    
    const submitButton = createGroupModalPage.getSubmitButton();
    
    await expect(submitButton).toBeDisabled();
    
    const nameInput = createGroupModalPage.getGroupNameInput();
    await nameInput.click();
    await nameInput.type('T');
    await page.keyboard.press('Tab');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(submitButton).toBeDisabled();
    
    await nameInput.clear();
    await nameInput.type(generateTestGroupName());
    await page.keyboard.press('Tab');
    await page.waitForLoadState('domcontentloaded');
    
    await expect(submitButton).toBeEnabled();
  });
});