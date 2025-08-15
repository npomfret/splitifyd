import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupMCPDebugOnFailure } from "../../helpers";
import { TIMEOUT_CONTEXTS } from '../../config/timeouts';
import { generateTestGroupName } from '../../utils/test-helpers';
import { waitForURLWithContext, groupDetailUrlPattern } from '../../helpers/wait-helpers';
import { GroupWorkflow } from '../../workflows';

setupMCPDebugOnFailure();

test.describe('Add Expense E2E', () => {
  test('should add new expense with equal split', async ({ authenticatedPage, dashboardPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Expense'), 'Testing expense creation');
    
    // Wait for page to be fully loaded after group creation
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for group data to be loaded
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    
    await expect(addExpenseButton).toBeVisible();
    await addExpenseButton.click();
    
    // Wait for navigation to add expense page
    await page.waitForURL(`**/groups/${groupId}/add-expense`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify members have loaded in the expense form
    await groupDetailPage.waitForMembersInExpenseForm();
    
    await expect(groupDetailPage.getExpenseDescriptionField()).toBeVisible();
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    const amountField = groupDetailPage.getExpenseAmountField();
    const categorySelect = groupDetailPage.getCategorySelect();
    
    await expect(descriptionField).toBeVisible();
    await groupDetailPage.fillPreactInput(descriptionField, 'Test Dinner');
    
    await expect(amountField).toBeVisible();
    await groupDetailPage.fillPreactInput(amountField, '50');
    
    await expect(categorySelect).toBeVisible();
    await groupDetailPage.typeCategoryText('dinner');
    
    const submitButton = groupDetailPage.getSaveExpenseButton();
    
    await expect(submitButton).toBeVisible();
    
    // Check if button is enabled and get validation errors if not
    await groupDetailPage.expectSubmitButtonEnabled();
    
    await submitButton.click();
    
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(groupDetailPage.getExpenseByDescription('Test Dinner')).toBeVisible();
    await expect(groupDetailPage.getExpenseAmount('$50.00')).toBeVisible();
  });

  // Form validation tests moved to form-validation.e2e.test.ts

  test('should allow selecting expense category', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Category'), 'Testing expense categories');
    
    // Wait for page to be fully loaded after group creation
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for group data to be loaded
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.first().click();
    
    // Wait for navigation to add expense page
    await page.waitForURL(`**/groups/${groupId}/add-expense`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify members have loaded in the expense form
    await groupDetailPage.waitForMembersInExpenseForm();
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    const categorySelect = groupDetailPage.getCategorySelect();
    await expect(categorySelect).toBeVisible();
    
    const initialCategory = await categorySelect.inputValue();
    
    await groupDetailPage.typeCategoryText('Bills & Utilities');
    
    const newCategory = await categorySelect.inputValue();
    expect(newCategory).not.toBe(initialCategory);
    
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Dinner with category');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '45');
    
    await groupDetailPage.getSaveExpenseButton().click();
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}$`));
    await expect(groupDetailPage.getExpenseByDescription('Dinner with category')).toBeVisible();
  });

  test('should show expense in group after creation', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('Display'), 'Testing expense display');
    
    // Wait for page to be fully loaded after group creation
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for group data to be loaded (members, balances, etc.)
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    // Click add expense button
    await groupDetailPage.clickAddExpenseButton();
    
    // Wait for navigation to add expense page
    await page.waitForURL(`**/groups/${groupId}/add-expense`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify members have loaded in the expense form
    // This also clicks Select all if needed
    await groupDetailPage.waitForMembersInExpenseForm();
    
    // Fill in the expense details
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Movie Tickets');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '25');
    
    // Now the save button should be enabled
    await expect(groupDetailPage.getSaveExpenseButton()).toBeEnabled();
    await groupDetailPage.getSaveExpenseButton().click();
    
    await page.waitForLoadState('domcontentloaded');
    
    await expect(groupDetailPage.getExpenseByDescription('Movie Tickets')).toBeVisible();
    
    const amountText = groupDetailPage.getExpenseAmount('$25.00');
    await expect(amountText).toBeVisible();
    
    await expect(groupDetailPage.getExpensePaidByText()).toBeVisible();
  });

  test('should allow custom category input', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    const groupId = await groupWorkflow.createGroupAndNavigate(generateTestGroupName('CustomCategory'), 'Testing custom category input');
    
    // Wait for page to be fully loaded after group creation
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for group data to be loaded
    await groupDetailPage.waitForBalancesToLoad(groupId);
    
    const addExpenseButton = groupDetailPage.getAddExpenseButton();
    await addExpenseButton.first().click();
    
    // Wait for navigation to add expense page
    await page.waitForURL(`**/groups/${groupId}/add-expense`);
    await page.waitForLoadState('domcontentloaded');
    
    // Verify members have loaded in the expense form
    await groupDetailPage.waitForMembersInExpenseForm();
    
    const descriptionField = groupDetailPage.getExpenseDescriptionField();
    await expect(descriptionField).toBeVisible();
    
    // Test custom category input
    await groupDetailPage.typeCategoryText('Custom Office Supplies');
    
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseDescriptionField(), 'Custom category expense');
    await groupDetailPage.fillPreactInput(groupDetailPage.getExpenseAmountField(), '16');
    
    await groupDetailPage.getSaveExpenseButton().click();
    
    await waitForURLWithContext(page, groupDetailUrlPattern(), { timeout: TIMEOUT_CONTEXTS.PAGE_NAVIGATION });
    await page.waitForLoadState('domcontentloaded');
    
    await expect(groupDetailPage.getExpenseByDescription('Custom category expense')).toBeVisible();
  });

});