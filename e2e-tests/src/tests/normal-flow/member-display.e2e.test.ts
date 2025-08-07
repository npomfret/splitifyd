import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { SELECTORS, ARIA_ROLES, PLACEHOLDERS } from '../../constants/selectors';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Member Management E2E', () => {
  test('should display current group members', async ({ authenticatedPage, dashboardPage }) => {
    const { page, user } = authenticatedPage;
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Create a group
    const groupName = 'Members Display Group';
    await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member display');
    
    // Should show the current user as a member in the main content area
    await expect(page.getByRole(ARIA_ROLES.MAIN).getByText(user.displayName)).toBeVisible();
    
    // Look for members section showing 1 member
    await expect(page.getByText(/1 member/i)).toBeVisible({ timeout: TIMEOUT_CONTEXTS.ELEMENT_VISIBILITY });
  });

  test('should show member in expense split options', async ({ authenticatedPage, dashboardPage }) => {
    const { page, user } = authenticatedPage;
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Create a group
    const groupName = 'Split Test Group';
    await dashboardPage.createGroupAndNavigate(groupName, 'Test group for split options');
    
    // Navigate to add expense
    const addExpenseButton = page.getByRole(ARIA_ROLES.BUTTON, { name: /add expense/i });
    await addExpenseButton.click();
    
    // Wait for expense form
    await expect(page.getByPlaceholder(PLACEHOLDERS.EXPENSE_DESCRIPTION)).toBeVisible();
    
    // Member should be visible in split section
    const splitHeading = page.getByRole(ARIA_ROLES.HEADING, { name: /split between/i });
    await expect(splitHeading).toBeVisible();
    
    // Find the card containing the split options by looking for checkboxes near the heading
    const splitCard = splitHeading.locator('..').locator('..');
    
    // The current user should be included and checked by default (payer is auto-selected)
    const userCheckbox = splitCard.locator(SELECTORS.CHECKBOX).first();
    await expect(userCheckbox).toBeVisible();
    await expect(userCheckbox).toBeChecked();
    
    // User name should be visible in split section
    await expect(splitCard.getByText(user.displayName)).toBeVisible();
  });

  test('should show creator as admin', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Create a group
    const groupName = 'Admin Test Group';
    await dashboardPage.createGroupAndNavigate(groupName, 'Test group for admin badge');
    
    // Creator should have admin badge - we expect a specific UI element
    // The UI must show "admin" text for the group creator
    await expect(page.getByText(/admin/i).first()).toBeVisible();
  });

  test('should show share functionality', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Create a group
    const groupName = 'Share Test Group';
    await dashboardPage.createGroupAndNavigate(groupName, 'Test group for sharing');
    
    // Share button should be visible
    const shareButton = page.getByRole(ARIA_ROLES.BUTTON, { name: /share/i });
    await expect(shareButton).toBeVisible();
    
    // Click share to open modal
    await shareButton.click();
    
    // Share modal should open with link
    const shareModal = page.getByRole(ARIA_ROLES.DIALOG, { name: /share group/i });
    await expect(shareModal).toBeVisible();
    
    // Should show share link
    const shareLink = shareModal.getByRole(ARIA_ROLES.TEXTBOX);
    await expect(shareLink).toBeVisible();
    
    // Link should contain the join URL with linkId parameter
    const linkValue = await shareLink.inputValue();
    expect(linkValue).toMatch(/\/join\?linkId=/);
  });

  test('should handle member count display', async ({ authenticatedPage, dashboardPage }) => {
    const { page } = authenticatedPage;
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await dashboardPage.waitForDashboard();
    
    // Create a group
    const groupName = 'Member Count Group';
    await dashboardPage.createGroupAndNavigate(groupName, 'Test group for member count');
    
    // Should show member count
    const memberCount = page.getByText(/1 member/i);
    await expect(memberCount).toBeVisible();
    
    // Note: Balance display testing is centralized in balance-settlement.e2e.test.ts
  });
});