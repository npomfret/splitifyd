import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Member Management E2E', () => {
  test('should display current group members', async ({ page }) => {
    const user = await createAndLoginTestUser(page);
    
    // Create a group using page objects
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Members Display Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Should show the current user as a member
    const userIdentifier = page.getByText(user.displayName)
      .or(page.getByText(user.email));
    
    await expect(userIdentifier.first()).toBeVisible();
    
    // Look for members section or member count
    const memberIndicator = page.getByText(/1 member/i)
      .or(page.getByRole('heading', { name: /member/i }));
    
    // Wait for at least one member indicator to be visible
    await expect(memberIndicator.first()).toBeVisible({ timeout: 500 });
  });

  test('should show member in expense split options', async ({ page }) => {
    const user = await createAndLoginTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Split Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Navigate to add expense
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.click();
    
    // Wait for expense form
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    // Member should be visible in split section
    const splitHeading = page.getByRole('heading', { name: /split between/i });
    await expect(splitHeading).toBeVisible();
    
    // Find the card containing the split options by looking for checkboxes near the heading
    const splitCard = splitHeading.locator('..').locator('..');
    
    // The current user should be included and checked by default (payer is auto-selected)
    const userCheckbox = splitCard.getByRole('checkbox').first();
    await expect(userCheckbox).toBeVisible();
    await expect(userCheckbox).toBeChecked();
    
    // User name should be visible in split section
    await expect(splitCard.getByText(user.displayName)).toBeVisible();
  });

  test('should show creator as admin', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Admin Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Creator should have admin badge
    const adminIndicator = page.getByText(/admin/i)
      .or(page.locator('[data-testid="admin-badge"]'));
    
    await expect(adminIndicator.first()).toBeVisible();
  });

  test('should show share functionality', async ({ page }) => {
    await createAndLoginTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Share Test Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Share button should be visible
    const shareButton = page.getByRole('button', { name: /share/i });
    await expect(shareButton).toBeVisible();
    
    // Click share to open modal
    await shareButton.click();
    
    // Share modal should open with link
    const shareModal = page.getByRole('dialog', { name: /share group/i });
    await expect(shareModal).toBeVisible();
    
    // Should show share link
    const shareLink = shareModal.getByRole('textbox');
    await expect(shareLink).toBeVisible();
    
    // Link should contain the join URL with linkId parameter
    const linkValue = await shareLink.inputValue();
    expect(linkValue).toMatch(/\/join\?linkId=/);
  });

  test('should handle member count display', async ({ page }) => {
    const user = await createAndLoginTestUser(page);
    
    // Create a group
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Member Count Group');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Should show member count
    const memberCount = page.getByText(/1 member/i);
    await expect(memberCount).toBeVisible();
    
    // Verify balance section shows settled state for single member
    const balanceSection = page.getByRole('heading', { name: /balance/i }).locator('..');
    await expect(balanceSection.getByText(/all settled up/i)).toBeVisible();
  });
});